"""Check app file routing and browser launching for the local server."""

import errno
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

import server

from server import (PROJECT_ROOT, _is_project_server, _listening_process, _open_app_tab, _run_text,
                    app_content_type, app_file, main, run)


class ServerTests(unittest.TestCase):
    """Guard app routes and asset types across Windows MIME configurations."""

    def test_app_modules_have_browser_compatible_types(self):
        """Serve JavaScript modules and styles with explicit media types."""
        self.assertEqual(app_content_type(Path("bundle.js")), "text/javascript")
        self.assertEqual(app_content_type(Path("style.css")), "text/css")
        self.assertEqual(app_content_type(Path("bank.sf3")), "application/octet-stream")

    def test_client_routes_fall_back_to_the_app_shell(self):
        """Serve index.html for app routes, real files directly, and nothing outside."""
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "index.html").write_text("app", encoding="utf-8")
            (root / "assets").mkdir()
            (root / "assets" / "main.js").write_text("js", encoding="utf-8")
            self.assertEqual(app_file("/", root).name, "index.html")
            self.assertEqual(app_file("/studio", root).name, "index.html")
            self.assertEqual(app_file("/assets/main.js", root).name, "main.js")
            self.assertIsNone(app_file("/assets/missing.js", root))
            self.assertIsNone(app_file("/../secret.txt", root))

    def test_existing_server_opens_chrome_tab(self):
        """Reuse a server process when its exclusive port is occupied."""
        with tempfile.TemporaryDirectory() as directory:
            database = Path(directory) / "catalog.sqlite"
            database.touch()
            app_dir = Path(directory) / "dist"
            app_dir.mkdir()
            (app_dir / "index.html").touch()
            with (patch("server.APP_DIR", app_dir),
                  patch("server.AppServer", side_effect=OSError(errno.EADDRINUSE, "Port busy")),
                  patch("server._existing_app", return_value=True),
                  patch("server._open_app_tab") as opener):
                main(["--database", str(database), "--port", "8765"])
            opener.assert_called_once_with("http://127.0.0.1:8765/")

    def test_old_server_on_the_port_is_reported(self):
        """Refuse to open a tab on a port held by a different server."""
        with tempfile.TemporaryDirectory() as directory:
            database = Path(directory) / "catalog.sqlite"
            database.touch()
            app_dir = Path(directory) / "dist"
            app_dir.mkdir()
            (app_dir / "index.html").touch()
            with (patch("server.APP_DIR", app_dir),
                  patch("server.AppServer", side_effect=OSError(errno.EADDRINUSE, "Port busy")),
                  patch("server._existing_app", return_value=False),
                  patch("server._listening_process", return_value=(7, "C:/Apps/other.exe")),
                  patch("server._stop_process") as stop,
                  patch("server._open_app_tab") as opener):
                with self.assertRaises(SystemExit) as raised:
                    main(["--database", str(database), "--port", "8765"])
            self.assertIn("--port 8766", str(raised.exception))
            self.assertIn("other.exe", str(raised.exception))
            opener.assert_not_called()
            stop.assert_not_called()

    def test_stale_project_server_is_stopped_and_its_port_reused(self):
        """Free the port from an old preview server of this project, then serve."""
        with tempfile.TemporaryDirectory() as directory:
            database = Path(directory) / "catalog.sqlite"
            database.touch()
            app_dir = Path(directory) / "dist"
            app_dir.mkdir()
            (app_dir / "index.html").touch()
            running = MagicMock(server_port=8765)
            running.__enter__.return_value = running
            running.serve_forever.side_effect = KeyboardInterrupt
            with (patch("server.APP_DIR", app_dir),
                  patch("server.AppServer", side_effect=[OSError(errno.EADDRINUSE, "Port busy"), running]),
                  patch("server._existing_app", return_value=False),
                  patch("server._listening_process", return_value=(42, "python.exe preview_gui.py")),
                  patch("server._stop_process") as stop,
                  patch("server.signal.signal"),
                  patch("builtins.print")):
                main(["--database", str(database), "--port", "8765", "--no-open"])
            stop.assert_called_once_with(42)
            running.serve_forever.assert_called_once()
            running.__exit__.assert_called_once()  # The socket was closed.

    def test_project_servers_are_recognized_by_command_line(self):
        """Stop only this project's Python servers, never other programs."""
        here = PROJECT_ROOT.as_posix()
        self.assertTrue(_is_project_server('"C:\\Python312\\python.exe" preview_gui.py'))
        self.assertTrue(_is_project_server(f"python {here}/server.py --port 8765"))
        self.assertFalse(_is_project_server("python C:/elsewhere/server.py"))
        self.assertFalse(_is_project_server("C:/Program Files/Tool/tool.exe --port 8765"))

    def test_command_output_in_another_code_page_is_read(self):
        """Read a French netstat (OEM code page bytes such as 0x90) without failing."""
        french = b"  Proto  Adresse locale  \x90tat\r\n  TCP  127.0.0.1:8765  0.0.0.0:0  \x90COUTE  4242\r\n"
        with patch("server.subprocess.run", return_value=MagicMock(stdout=french)):
            text = _run_text(["netstat"])
        self.assertIn("127.0.0.1:8765", text)
        self.assertIn("4242", text)
        with patch("server.subprocess.run", return_value=MagicMock(stdout=None)):
            self.assertEqual(_run_text(["netstat"]), "")

    def test_netstat_listening_row_is_found_in_any_language(self):
        """Use the unconnected remote address, not the localized state word."""
        netstat = (
            "Connexions actives\n\n"
            "  Proto  Adresse locale         Adresse distante       Etat\n"
            "  TCP    127.0.0.1:8765         127.0.0.1:50000        ETABLIE         99\n"
            "  TCP    127.0.0.1:8765         0.0.0.0:0              ECOUTE          4242\n")
        with (patch.object(server.os, "name", "nt"),
              patch("server._run_text", side_effect=[netstat, "python.exe preview_gui.py\n"])):
            self.assertEqual(_listening_process(8765), (4242, "python.exe preview_gui.py"))

    def test_startup_error_waits_in_a_double_clicked_window(self):
        """Show the error and wait for Enter instead of closing the window at once."""
        with (patch("server.main", side_effect=SystemExit("Port 8765 is used")),
              patch("server._owns_console", return_value=True),
              patch("builtins.input") as wait,
              patch("sys.stderr")):
            with self.assertRaises(SystemExit) as raised:
                run()
        self.assertEqual(raised.exception.code, 1)
        wait.assert_called_once()

    def test_chrome_is_preferred_for_tab_opening(self):
        """Launch Chrome explicitly when the Windows app path is known."""
        with (patch("server._chrome_executable", return_value="chrome.exe"),
              patch("server.subprocess.Popen") as launch,
              patch("server.webbrowser.open_new_tab") as fallback):
            _open_app_tab("http://127.0.0.1:8765/")
        self.assertEqual(launch.call_args.args[0],
                         ["chrome.exe", "http://127.0.0.1:8765/"])
        fallback.assert_not_called()


if __name__ == "__main__":
    unittest.main()
