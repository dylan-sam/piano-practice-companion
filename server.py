"""Serve the Ear Training web app and its local ChoCo score API."""

import argparse
import errno
import json
import mimetypes
import os
import signal
import socket
import subprocess
import sys
import time
import traceback
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit
from urllib.request import urlopen

from score_search import (catalog_progressions, random_score_group,
                          search_score_groups, tracks_with_progressions)
from studio_bridge import choco_chart


PROJECT_ROOT = Path(__file__).resolve().parent
DEFAULT_DATABASE = PROJECT_ROOT / "data" / "progressions.sqlite"
CATALOG = PROJECT_ROOT / "data" / "common_progressions.json"
APP_DIR = PROJECT_ROOT / "studio" / "dist"
APP_ID = "ear-training-web-app"
# Servers of this project that may still hold the port after an earlier session
PROJECT_SERVER_SCRIPTS = ("preview_gui.py", "server.py")
PORT_RELEASE_SECONDS = 5
APP_MIME_TYPES = {
    ".js": "text/javascript", ".css": "text/css", ".html": "text/html",
    ".svg": "image/svg+xml", ".woff": "font/woff",
    ".woff2": "font/woff2", ".wasm": "application/wasm",
    ".sf3": "application/octet-stream", ".zip": "application/zip",
    ".json": "application/json", ".png": "image/png",
}


def app_content_type(path):
    """Use reliable module MIME types despite Windows registry overrides."""
    return (APP_MIME_TYPES.get(path.suffix.lower())
            or mimetypes.guess_type(path.name)[0]
            or "application/octet-stream")


def app_file(request_path, app_dir=APP_DIR):
    """Map a URL path to a built file, using index.html for app routes."""
    root = Path(app_dir).resolve()
    relative = request_path.lstrip("/")
    target = (root / relative).resolve() if relative else root / "index.html"
    if not target.is_relative_to(root):
        return None
    if target.is_file():
        return target
    # Paths without a file extension are client-side routes such as /studio.
    return root / "index.html" if not Path(relative).suffix else None


class AppServer(ThreadingHTTPServer):
    """Hold the ChoCo database path used by HTTP requests."""

    allow_reuse_address = False

    def __init__(self, address, database=DEFAULT_DATABASE):
        """Bind the app service to one local network address."""
        self.database = Path(database)
        super().__init__(address, AppHandler)

    def server_bind(self):
        """Prevent parallel server processes from sharing a Windows port."""
        if hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        super().server_bind()


class AppHandler(BaseHTTPRequestHandler):
    """Serve the built web app and read-only ChoCo score queries."""

    def do_GET(self):
        """Route score API requests and app files."""
        request = urlsplit(self.path)
        query = parse_qs(request.query)
        if request.path == "/api/health":
            self._send_json({"app": APP_ID})
            return
        if request.path == "/api/scores":
            self._send_scores(query)
            return
        if request.path == "/api/progressions":
            self._send_json(catalog_progressions(CATALOG))
            return
        if request.path == "/api/random-score":
            try:
                group = random_score_group(self.server.database, CATALOG,
                                           query.get("progression", [""])[0])
            except ValueError as error:
                self._send_json({"error": str(error)}, 400)
                return
            self._send_json(group or {"error": "No matching score"},
                            200 if group else 404)
            return
        if request.path == "/api/studio/chart":
            try:
                self._send_json(choco_chart(self.server.database,
                                            query.get("id", [""])[0]))
            except ValueError as error:
                self._send_json({"error": str(error)}, 404)
            return
        if request.path.startswith("/api/"):
            self._send_json({"error": "Unknown API endpoint"}, 404)
            return
        target = app_file(request.path)
        if target is None:
            self.send_error(404, "Not found")
            return
        self._send_file(target, app_content_type(target))

    def _send_scores(self, query):
        """Search scores by title, optionally keeping songs that contain chosen progressions.

        `progressions` is a comma-separated list of catalog ids; `match=any`
        keeps songs with at least one of them instead of all of them.
        """
        text = query.get("q", [""])[0]
        chosen = [pid for pid in query.get("progressions", [""])[0].split(",") if pid]
        track_ids = None
        if chosen:
            try:
                track_ids = tracks_with_progressions(
                    CATALOG, chosen, query.get("match", ["all"])[0] != "any")
            except ValueError as error:
                self._send_json({"error": str(error)}, 400)
                return
        self._send_json(search_score_groups(self.server.database, text, track_ids=track_ids))

    def _send_json(self, value, status=200):
        """Send a compact JSON response without browser caching."""
        payload = json.dumps(value).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(payload)

    def _send_file(self, path, content_type):
        """Send one built app file."""
        try:
            payload = path.read_bytes()
        except FileNotFoundError:
            self.send_error(404, "Not found")
            return
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(payload)


def parse_args(argv=None):
    """Read the database, port, and browser launch options."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database", type=Path, default=DEFAULT_DATABASE)
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--no-open", action="store_true",
                        help="Do not launch the default browser")
    return parser.parse_args(argv)


def _chrome_executable():
    """Find Chrome from the Windows app registry when it is installed."""
    if os.name != "nt":
        return None
    import winreg

    app_key = r"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe"
    for hive in (winreg.HKEY_CURRENT_USER, winreg.HKEY_LOCAL_MACHINE):
        try:
            with winreg.OpenKey(hive, app_key) as key:
                executable = winreg.QueryValueEx(key, "")[0]
            if Path(executable).is_file():
                return executable
        except OSError:
            continue
    return None


def _open_app_tab(url):
    """Open the app in Chrome, falling back to the system browser."""
    chrome = _chrome_executable()
    if chrome:
        try:
            subprocess.Popen([chrome, url], stdout=subprocess.DEVNULL,
                             stderr=subprocess.DEVNULL)
            return
        except OSError:
            pass
    webbrowser.open_new_tab(url)


def _existing_app(url):
    """Recognize this app's server, not an older preview server, on a busy port."""
    try:
        with urlopen(url + "api/health", timeout=2) as response:
            return json.load(response).get("app") == APP_ID
    except (OSError, ValueError, TypeError, AttributeError):
        return False


def _port_in_use(error):
    """Tell whether a bind error means another process listens on the port."""
    return error.errno == errno.EADDRINUSE or getattr(error, "winerror", None) == 10048


def _console_encoding():
    """Name the encoding Windows console tools write in (the OEM code page), else UTF-8."""
    if os.name == "nt":
        try:
            import codecs

            return codecs.lookup("oem").name
        except LookupError:
            pass
    return "utf-8"


def _run_text(command):
    """Run a short system command and return its output as text, or "" when it fails.

    Output is decoded in the console's code page; bytes it cannot decode are
    replaced, since localized tools (a French netstat, say) print accented text.
    """
    try:
        output = subprocess.run(command, capture_output=True, timeout=15, check=False).stdout
    except (OSError, subprocess.SubprocessError):
        return ""
    return (output or b"").decode(_console_encoding(), errors="replace")


def _listening_process(port):
    """Return (process id, command line) of the program listening on a port, or None.

    On Windows the listening row is found by its unconnected remote address
    (0.0.0.0:0 or [::]:0), which does not depend on the language of netstat.
    """
    if os.name == "nt":
        pid = None
        for line in _run_text(["netstat", "-ano", "-p", "TCP"]).splitlines():
            parts = line.split()
            if (len(parts) >= 5 and parts[1].rsplit(":", 1)[-1] == str(port)
                    and parts[2] in ("0.0.0.0:0", "[::]:0") and parts[-1].isdigit()):
                pid = int(parts[-1])
                break
        if pid is None:
            return None
        command_line = _run_text([
            "powershell", "-NoProfile", "-Command",
            f"(Get-CimInstance Win32_Process -Filter 'ProcessId={pid}').CommandLine"])
    else:
        pids = _run_text(["lsof", "-t", f"-iTCP:{port}", "-sTCP:LISTEN"]).split()
        if not pids or not pids[0].isdigit():
            return None
        pid = int(pids[0])
        command_line = _run_text(["ps", "-o", "command=", "-p", str(pid)])
    return pid, command_line.strip()


def _is_project_server(command_line):
    """Recognize a Python server of this project from its command line."""
    text = command_line.replace("\\", "/").casefold()
    if "python" not in text:
        return False
    if "preview_gui.py" in text:
        return True
    # A bare "server.py" could be another project's; require this project's folder
    return "server.py" in text and PROJECT_ROOT.as_posix().casefold() in text


def _stop_process(pid):
    """End a process and the processes it started."""
    if os.name == "nt":
        _run_text(["taskkill", "/PID", str(pid), "/T", "/F"])
    else:
        try:
            os.kill(pid, signal.SIGTERM)
        except OSError:
            pass


def _bind(port, database):
    """Bind the server, freeing the port from a stale server of this project first.

    Returns None when the current app already runs on the port. Any other
    program on the port is left alone and reported.
    """
    try:
        return AppServer(("127.0.0.1", port), database)
    except OSError as error:
        if not _port_in_use(error):
            raise
    url = f"http://127.0.0.1:{port}/"
    if _existing_app(url):
        return None
    owner = _listening_process(port)
    if owner is None or not _is_project_server(owner[1]):
        program = f" ({owner[1] or 'process ' + str(owner[0])})" if owner else ""
        raise SystemExit(f"Port {port} is used by another program{program}. "
                         f"Close it, or start this one with --port {port + 1}.")
    print(f"Stopping an old Ear Training server on port {port} (process {owner[0]}).", flush=True)
    _stop_process(owner[0])
    deadline = time.monotonic() + PORT_RELEASE_SECONDS
    while True:
        try:
            return AppServer(("127.0.0.1", port), database)
        except OSError as error:
            if not _port_in_use(error) or time.monotonic() > deadline:
                raise
            time.sleep(0.25)


def _stop_on_signal(signum, frame):
    """Turn a termination request (Ctrl+Break, kill) into a clean shutdown."""
    raise KeyboardInterrupt


def main(argv=None):
    """Start the app server, or open its tab if it is already running.

    The listening socket is always closed on the way out, whether the server
    is stopped with Ctrl+C, Ctrl+Break, a kill request, or by an error.
    """
    args = parse_args(argv)
    if not args.database.is_file():
        raise FileNotFoundError(f"ChoCo database not found: {args.database}")
    if not (APP_DIR / "index.html").is_file():
        raise FileNotFoundError("Build the app first: pnpm install && pnpm run build in studio/")
    server = _bind(args.port, args.database)
    if server is None:
        url = f"http://127.0.0.1:{args.port}/"
        print(f"Ear Training already running: {url}", flush=True)
        if not args.no_open:
            _open_app_tab(url)
        return
    for name in ("SIGTERM", "SIGBREAK"):
        if hasattr(signal, name):
            signal.signal(getattr(signal, name), _stop_on_signal)
    with server:  # Closes the socket, freeing the port, however the block ends
        url = f"http://127.0.0.1:{server.server_port}/"
        print(f"Ear Training: {url}  (Ctrl+C to stop)", flush=True)
        if not args.no_open:
            _open_app_tab(url)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
        finally:
            print("Server stopped; port released.", flush=True)


def _owns_console():
    """Report whether this process has its own console window (a double-click on Windows)."""
    if os.name != "nt":
        return False
    try:
        import ctypes

        processes = (ctypes.c_uint * 2)()
        return ctypes.windll.kernel32.GetConsoleProcessList(processes, 2) <= 1
    except (AttributeError, OSError):
        return False


def run():
    """Run the server; keep a double-clicked window open long enough to read an error."""
    try:
        main()
    except SystemExit as stop:
        if stop.code in (None, 0):
            raise
        print(stop.code if isinstance(stop.code, str) else f"Stopped with code {stop.code}",
              file=sys.stderr)
        failed = True
    except Exception:  # Any startup error should be readable before the window closes.
        traceback.print_exc()
        failed = True
    else:
        failed = False
    if failed:
        if _owns_console():
            input("\nPress Enter to close this window.")
        sys.exit(1)


if __name__ == "__main__":
    run()
