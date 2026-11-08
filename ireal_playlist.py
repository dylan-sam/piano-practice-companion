"""Read iReal Pro charts (irealb:// links) into catalog tracks, with an import log.

A source is a playlist file (.txt or .html holding irealb:// or the older
irealbook:// links, as iReal Pro exports and forums share them), a forum dump
(.csv files with an "ireal_charts" column, as in ChoCo's raw forum data), a
folder of such files, or a zip of them. Every song becomes a Track for
track_store.add_track: chords in canonical Harte (via chord_notation), each at
its bar and beat (beats counted from 0 here, from 1 once stored, as for every
source; any number of beats per bar), one key (iReal keys state the mode: "C-" is
C minor) and one time signature.

The chart layout follows ChoCo's iReal conversion (ChoCoTune, CC BY 4.0,
itself based on pyRealParser by Daniel R. Stephan, MIT): repeats, numbered
endings, codas and one- and two-bar repeat signs are written out. Unlike
ChoCo, a chord lasts as long as the cells it fills in its bar, as iReal Pro
plays it (see bar_beats and docs/CHORD_NOTATION.md, "Chord lengths in iReal
bars"); ChoCo shares every bar evenly, so three chords in 4/4 last 1 1/3
beats each. Three ChoCo clean-up errors are avoided:
comments are removed before anything else (they may hold "*", "Q" or chord
names), custom chord text (G*m7*) is kept rather than losing its first
letter, and the small/large cell markers s and l are removed without
damaging "sus" and "alt".

Songs are grouped as in the rest of the catalog: a chart with the same bars and
chords as one seen earlier in the import is not imported, whatever its title; other charts of the same song stay as versions and are grouped by
score_search.song_key. A trailing copy number ("Autumn Leaves 2") is dropped
from the title when the song is also present without it.

A source may be curated (the forum charts are): a chart is left out when it
comes from a practice or exercise thread, has an exercise or placeholder title,
is under 4 bars or a single chord, or is a version of a song the catalog already
has from another source and was posted in fewer than `min_threads` forum
threads. Titles listed in the source's `keep` list are never left out.

Each import writes a log: one line per song (OK, DUPLICATE or ERROR with the
reason; a chart with an unreadable chord is not imported), WARNING lines for layout read with a fallback, and a summary.
"""

import csv
import io
import itertools
import re
import urllib.parse
import zipfile
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

from chord_notation import NotationError, chart_key, chart_spelling, chart_to_harte
from score_search import song_key
from track_store import Track, position_key


LINK = re.compile(r'(irealb(?:ook)?://[^\s"<>]+)')
CHORDS_PREFIX = "1r34LbKcu7"
# One chord of a bar, as in ChoCo: a root (or n for no chord), its quality, an optional bass
CHORD_TOKEN = re.compile(r"(?<!/)([A-Gn][^A-G/]*(?:/[A-G][#b]?)?)")
ENDING_MARK = re.compile(r"([{\[|]?)[\s_]*N(\d)")
BLANK_BAR = re.compile(r"\|[\s_]*\|")  # a bar holding nothing but empty cells
COMPLEX_REPEAT = re.compile(r"{.+?N\d.+?}")
REPEAT_COUNT = re.compile(r"<\s*(\d+)\s*x\s*>", re.IGNORECASE)
# Custom chord text written between asterisks after a root: G*m7*, Bb*sus4*
# (also after an invisible root, W*.*/G; spaces and dots in the text mean nothing)
CUSTOM_QUALITY = re.compile(r"([A-GW][b#]?)\*([^*A-G|\[\]{},]*)\*")
COPY_NUMBER = re.compile(r"^(.*\S)\s+([1-9])$")
TEXT_SUFFIXES = (".txt", ".html", ".htm")
# Longest chart, in characters once repeats are written out; a few malformed
# charts nest repeats so that they grow without end
MAX_EXPANDED = 20000
# Most a chart with unpaired repeat signs may grow when written out (its normal repeats double
# it, a coda adds a part); unpaired signs make charts grow 10 to 50 times
MAX_GROWTH = 4
# Curation of user-contributed charts (forum): practice threads, and exercise or placeholder titles
PRACTICE_THREAD = re.compile(r"exercis|practi[cs]e|drill|lesson|etude|\bscales?\b|warm[ -]?up|\blicks?\b|"
                             r"\btests?\b|how (?:do|to|can)", re.IGNORECASE)
PLACEHOLDER_TITLE = re.compile(
    r"exercis|practi[cs]e|drill|warm[ -]?up|^new song\b|untitled|^(?:song|tune|chart)\s*\d*$|"
    r"^(?:a |the )?(?:slow |fast |minor |jazz )?blues(?: in [a-g][b#]?\b.*)?$|^rhythm changes\b|"
    r"(?:^|\s)(?:i{1,3}|iv|vi{0,2}|v)7?\s*[-\u2013/]\s*(?:i{1,3}|iv|vi{0,2}|v)7?\b", re.IGNORECASE)
MIN_BARS = 4  # shorter charts are fragments; 4-bar loops of real songs stay
# An empty cell of a bar while a chart is laid out: iReal writes one as a space (XyQ is three)
EMPTY_CELL = "_"

# iReal time signature codes: T44 is 4/4, T12 is 12/8
TIME_SIGNATURES = {"T22": (2, 2), "T32": (3, 2), "T24": (2, 4), "T34": (3, 4), "T44": (4, 4),
                   "T54": (5, 4), "T64": (6, 4), "T74": (7, 4), "T38": (3, 8), "T58": (5, 8),
                   "T68": (6, 8), "T78": (7, 8), "T98": (9, 8), "T12": (12, 8)}


class ChartError(ValueError):
    """A song that cannot be read; the message says why."""


# ---------- Import log ----------

@dataclass
class ImportLog:
    """Collect the outcome of every song of an import and write it as a text log."""

    path: Path
    lines: list = field(default_factory=list)
    imported: int = 0
    duplicates: int = 0
    failed: int = 0
    curations: int = 0
    warnings: int = 0

    def ok(self, where, title, detail):
        """Record a song imported successfully."""
        self.imported += 1
        self.lines.append(f"OK        {where} | {title} | {detail}")

    def duplicate(self, where, title, first):
        """Record a chart identical to one already imported, which is merged into it."""
        self.duplicates += 1
        self.lines.append(f"DUPLICATE {where} | {title} | same chart as {first}")

    def error(self, where, title, reason):
        """Record a song that could not be imported."""
        self.failed += 1
        self.lines.append(f"ERROR     {where} | {title} | {reason}")

    def curated(self, where, title, reason):
        """Record a chart left out by the source's curation rules."""
        self.curations += 1
        self.lines.append(f"CURATED   {where} | {title} | {reason}")

    def warning(self, where, title, message):
        """Record something read with a fallback inside an imported song."""
        self.warnings += 1
        self.lines.append(f"WARNING   {where} | {title} | {message}")

    def summary(self):
        """One line counting the outcomes."""
        return (f"Summary: {self.imported} imported, {self.duplicates} duplicates merged, "
                f"{self.curations} left out by curation, {self.failed} failed, {self.warnings} warnings")

    def write(self, header):
        """Write the log with a header and the summary at both ends; return its path."""
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text("\n".join([header, self.summary(), ""] + self.lines + ["", self.summary(), ""]),
                             encoding="utf-8")
        return self.path


def new_log(folder, source_name):
    """Create the log of one import, named after the source and the time."""
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    slug = re.sub(r"[^A-Za-z0-9]+", "-", source_name).strip("-") or "playlist"
    return ImportLog(Path(folder) / f"ireal-import-{slug}-{stamp}.log")


# ---------- Links and unscrambling ----------

def links_in(text):
    """Return the irealb:// and irealbook:// links found in a text or HTML document."""
    return [match.group(1) for match in LINK.finditer(text)]


def _obfusc50(block):
    """Undo iReal Pro's character swaps within one 50-character block."""
    result = list(block)
    for i in range(5):
        result[i], result[49 - i] = block[49 - i], block[i]
    for i in range(10, 24):
        result[i], result[49 - i] = block[49 - i], block[i]
    return "".join(result)


def unscramble(scrambled):
    """Unscramble the chord string of one irealb:// song."""
    plain = ""
    while len(scrambled) > 50:
        block, scrambled = scrambled[:50], scrambled[50:]
        plain += block if len(scrambled) < 2 else _obfusc50(block)
    return plain + scrambled


@dataclass
class RawSong:
    """The fields of one iReal song before its chords are read."""

    title: str
    composer: str
    style: str
    key: str
    chords: str | None  # unscrambled chord string
    tempo: str = ""


def raw_songs(link):
    """Split a link into its songs; the playlist name, if any, is returned too.

    irealb:// songs are Title=Composer=(unused)=Style=Key=Transpose=Music=
    CompStyle=Tempo=Repeats, the music starting with 1r34LbKcu7; the older
    irealbook:// songs are Title=Composer=Style=Key=n=Chords, unscrambled.
    """
    body = urllib.parse.unquote(link.strip())
    scrambled = body.startswith("irealb://")
    parts = [part for part in body.split("://", 1)[1].split("===") if part]
    playlist = parts.pop().strip() if parts and "=" not in parts[-1] else None
    songs = []
    for part in parts:
        fields = part.split("=")
        if scrambled:
            music = next((i for i, f in enumerate(fields) if f.startswith(CHORDS_PREFIX)), None)
            chords = unscramble(fields[music][len(CHORDS_PREFIX):]) if music is not None else None
            get = lambda i: fields[i] if len(fields) > i else ""
            tempo = get(music + 2) if music is not None else ""
            songs.append(RawSong(get(0), get(1), get(3), get(4), chords, tempo))
        else:
            fields += [""] * 6
            songs.append(RawSong(fields[0], fields[1], fields[2], fields[3], fields[5] or None))
    return songs, playlist


# ---------- Chart layout (adapted from ChoCoTune and pyRealParser) ----------

def _pad(text, pattern, replacement=None):
    """Surround every match of a pattern with spaces."""
    return re.sub(pattern, lambda m: f" {replacement or m.group(0)} ", text)


def _remove_markers(text):
    """Remove end, segno, coda and ending markers from repeated material."""
    return re.sub(r"U|S|Q|N\d", "", text)


def _join(*parts):
    """Join chord strings with a bar line between them unless one is already there."""
    pieces = [part for part in parts if part.strip()]
    if not pieces:
        return ""
    out = pieces[0]
    for piece in pieces[1:]:
        out += ("|" if out.rstrip()[-1] != "|" and piece.lstrip()[0] != "|" else "") + piece
    return out


def clean_chord_string(text):
    """Normalise bar lines and spacing, and drop annotations the catalog does not use."""
    counts = []
    text = REPEAT_COUNT.sub(lambda m: counts.append(m.group(1)) or "\x00", text)
    text = re.sub(r"<[^>]*>?", ",", text)  # comments, even unclosed ones at the end (no cell)
    text = re.sub("\x00", lambda _: f"<{counts.pop(0)}x>", text)
    text = CUSTOM_QUALITY.sub(lambda m: m.group(1) + chart_spelling(re.sub(r"[\s.]", "", m.group(2))), text)
    text = text.replace("LZ", " |").replace("K", "|")  # bar lines; LZ stands for " |", its space a cell
    text = re.sub(r"cl", "x", text)  # one-bar repeat sign
    text = re.sub(r"\*\s*\*", "", text)
    text = re.sub(r"Y+", "", text)  # vertical spacers
    # Cells: every space is an empty cell (it lengthens the chord before it), XyQ is three,
    # a comma separates two chords without one; from here on a space only separates tokens
    text = text.replace("XyQ", "   ").replace(" ", f" {EMPTY_CELL} ").replace(",", " ")
    text = BLANK_BAR.sub("|", text)
    text = text.replace("Z", "")  # final bar line
    text = _pad(text, r"W(?:/[A-G][#b]?)?")  # invisible chords (bass only)
    text = re.sub(r"\|\s+", "|", text)
    text = re.sub(r"\s+", " ", text).rstrip()
    if text.find("}") > -1 and (text.find("{") == -1 or text.find("{") > text.find("}")):
        text = "{" + text  # a repeat that starts at the top of the chart
    text = re.sub(r"[\[\]]", "|", text)
    text = BLANK_BAR.sub("|", text)  # a bar of empty cells only is not played
    text = re.sub(r"\([^)]*\)", " ", text)  # alternative chords
    text = re.sub(r"\*[A-Za-z]", "", text)  # section marks (*A, *i)
    text = re.sub(r"(?<!a)l|l(?!t)", "", text)  # large cells, keeping "alt"
    text = re.sub(r"(?<!su)s(?!us)", "", text)  # small cells, keeping "sus"
    text = text.replace("f", "")  # fermatas
    return re.sub(r"T\d\d", "", text)  # time signatures


def expand_repeats(text):
    """Write out bracketed repeats, with numbered endings or a repeat count (<3x>)."""
    if len(text) - 2 * text.count(EMPTY_CELL) > MAX_EXPANDED:  # an empty cell was one space
        raise ChartError("repeats expand beyond any song length (malformed repeat signs)")
    match = re.search(r"{(.+?)}", text)
    if match is None:
        return text
    body = match.group(1)
    if re.search(r"N\d", body):
        macros = list(COMPLEX_REPEAT.finditer(text))
        boundary = macros[1].start() if len(macros) > 1 else len(text)
        expanded = _join(text[:match.start()], re.sub(r"N\d", "", body), text[match.end():])
        first_part = re.search(r"([^N]+)N\d", body)
        if first_part is None:
            raise ChartError("numbered ending at the start of a repeat")
        repeated = _remove_markers(first_part.group(1))
        for _ in ENDING_MARK.findall(expanded):
            expanded = ENDING_MARK.sub(
                lambda m: m.group(1) + repeated if m.start() < boundary else m.group(0), expanded)
    else:
        times, body_only = 2, body
        counts = list(re.finditer(r"<(\d+)x>", body))
        if counts:
            times = int(counts[-1].group(1))
            body_only = (body[:counts[-1].start()] + body[counts[-1].end():]).replace("  ", " ")
        expanded = _join(text[:match.start()], body_only,
                         (" |" + _remove_markers(body_only)) * (times - 1), text[match.end():])
    return expand_repeats(expanded)


def expand_codas(text):
    """Write out D.C./D.S. al Coda: play to the first Q, jump back, then take the coda."""
    codas = text.count("Q")
    if codas > 2:
        raise ChartError(f"{codas} coda signs (at most 2 can be read)")
    if codas == 1:
        return text.replace("Q", "")
    if codas == 2:
        first, second = [i for i, c in enumerate(text) if c == "Q"]
        segno = text.find("S")
        segno = 0 if segno == -1 else segno + 1
        text = text[:second] + text[segno:first] + " |" + text[second + 1:]
        return re.sub(r"[QS]", "", text)
    return text


def _fill_bar_repeats(bars):
    """Replace one-bar (x) and two-bar (r) repeat signs with the bars they repeat."""
    split = []
    for bar in bars:
        if re.search(r"[rx]", bar):
            bar = bar.replace(EMPTY_CELL, " ")  # a repeat sign copies whole bars, cells and all
        pieces = re.split(r"[rx]", bar)
        marks = re.findall(r"[rx]", bar)
        split += [value.strip() for pair in zip(pieces, marks + [""]) for value in pair if value.strip()]
    padded = []
    for i, bar in enumerate(split):
        padded.append(bar)
        if bar == "r" and (i + 1 == len(split) or split[i + 1].strip()):
            padded.append(" ")
    for i in range(len(padded)):
        if padded[i] in ("x", "r") and i == 0:
            raise ChartError("repeat sign in the first bar")
        if padded[i] == "x":
            padded[i] = _remove_markers(padded[i - 1])
        elif padded[i] == "r":
            if i < 2 or padded[i + 1].strip():
                raise ChartError("two-bar repeat sign without two bars before and an empty bar after")
            padded[i], padded[i + 1] = _remove_markers(padded[i - 2]), _remove_markers(padded[i - 1])
    return padded


def _fill_slashes(bars):
    """Read slash cells (p), which hold the chord before them, as iReal Pro plays them.

    Inside a bar a slash is an empty cell: the chord before it goes on ("F p Bb p" is F for
    two beats, then Bb). At the start of a bar it repeats the previous bar's last chord.
    """
    for i in range(len(bars)):
        while "p" in bars[i]:
            slash = bars[i].find("p")
            starts_bar = not _has_tokens(bars[i][:slash])
            if not starts_bar and CHORD_TOKEN.findall(bars[i][:slash]):
                bars[i] = bars[i][:slash] + f" {EMPTY_CELL} " + bars[i][slash + 1:]
                continue
            before = CHORD_TOKEN.findall(bars[i - 1]) if starts_bar and i else []
            if not before:
                raise ChartError("repeat slash with no chord before it")
            chord = before[-1].replace(EMPTY_CELL, " ").strip()
            bars[i] = bars[i][:slash] + " " + chord + " " + bars[i][slash + 1:]
    return bars


def _finish_bars(bars, warn):
    """Separate no-chord marks, fill invisible roots (W) and drop leftover markers."""
    out, last_root = [], None
    for bar in bars:
        bar = _pad(bar, r"n", "N")
        for item in bar.split():
            chord = CHORD_TOKEN.match(item)
            if chord and item != "N":
                last_root = chord.group(1).split("/")[0]
            elif "W" in item:
                if last_root is None:
                    raise ChartError("invisible chord (W) before any chord")
                bar = bar.replace("W", last_root, 1)
        ending = re.search(r"N\d", bar)
        if ending:
            warn(f"ending marker {ending.group(0)} outside a repeat ignored")
        bar = re.sub(r"[US]|N\d", "", bar)
        out.append(re.sub(r"\s\s+", " ", bar).strip())
    return out


def _has_tokens(piece):
    """Tell whether a piece of chart text holds more than empty cells."""
    return bool(piece.replace(EMPTY_CELL, " ").strip())


def _bar_cells(bar):
    """Return the (chord, cells) of a laid-out bar: each chord fills its own cell and the
    empty cells after it. Empty cells before the first chord are skipped, as iReal Pro does."""
    chords = []
    for token in bar.split():
        if token != EMPTY_CELL:
            chords.append([token, 1])
        elif chords:
            chords[-1][1] += 1
    return [tuple(chord) for chord in chords]


def even_split(count, beats):
    """Beats of `count` chords sharing a bar of `beats` evenly, as Studio's evenSplit does:
    three chords in 4/4 are 2+1+1 and two in 3/4 are 2+1, otherwise the shares are equal."""
    if count <= 1:
        return [beats]
    if count == 3 and beats == 4:
        return [2, 1, 1]
    if count == 2 and beats == 3:
        return [2, 1]
    return [beats // count if beats % count == 0 else beats / count] * count


def bar_beats(cells, beats):
    """Return the beats of each chord of a bar from the cells it fills (see _bar_cells).

    Each chord starts where its cell lies in the bar: "F Abo,G-7 " (cells 2+1+1) is
    2+1+1 beats and "F,Abo,G-7 " is 1+1+2. When cells and beats do not line up, the
    chords take the whole-beat lengths (at least one beat each) whose starts are closest
    to the cells' positions: "F,Abo G-7 " (1+2+2 of 5 cells, starts 0, 0.8, 2.4) is 1+1+2.
    Evenly spaced chords ("F Abo G-7 ", "F,Abo,G-7"), ties and bars with more chords
    than beats are shared by even_split. Same rule as Studio (studio/src/formats/ireal.ts).
    """
    even = even_split(len(cells), beats)
    if len(set(cells)) == 1 or len(cells) > beats:
        return even
    total = sum(cells)
    starts = [beats * sum(cells[:i]) / total for i in range(len(cells))]

    def distance(lengths):
        """How far the chord starts of some lengths are from the cells' positions."""
        return sum(abs(sum(lengths[:i]) - start) for i, start in enumerate(starts))

    candidates = [[b - a for a, b in zip((0,) + cuts, cuts + (beats,))]
                  for cuts in itertools.combinations(range(1, beats), len(cells) - 1)]
    best = min(distance(lengths) for lengths in candidates)
    closest = [lengths for lengths in candidates if distance(lengths) <= best + 1e-9]
    return even if even in closest or len(closest) > 1 else closest[0]


def chart_bars(chord_string, warn=lambda message: None):
    """Return the bars of a chart, in playing order, each as a list of (chart chord, cells)."""
    cleaned = clean_chord_string(chord_string)
    written = len([piece for piece in re.split(r"[|{}\[\]]", cleaned) if _has_tokens(piece)])
    text = expand_repeats(cleaned)
    if REPEAT_COUNT.search(text):
        warn("repeat count outside a repeat ignored")
        text = REPEAT_COUNT.sub(" ", text)
    text = expand_codas(text)
    pieces = re.split(r"\||{|}|\[|\]", text)
    bars = [piece.strip() for i, piece in enumerate(pieces)
            if _has_tokens(piece) or (i and pieces[i - 1].strip() == "r")]
    bars = [bar.replace("U", "").strip() for bar in bars]
    bars = [_bar_cells(bar) for bar in _finish_bars(_fill_slashes(_fill_bar_repeats(bars)), warn)]
    bars = [bar for bar in bars if bar]
    # Repeat signs that do not pair up are written out over and over (2,000 bars from 40):
    # such a chart cannot be read as its author meant
    if cleaned.count("{") != cleaned.count("}") and len(bars) > MAX_GROWTH * max(written, 1):
        raise ChartError(f"unpaired repeat signs expand {written} written bars to {len(bars)}")
    return bars


def time_signature(chord_string, warn=lambda message: None):
    """Return the chart's first time signature, 4/4 when none is written.

    Like ChoCo, one meter is used for the whole chart; a change is logged.
    """
    codes = re.findall(r"T\d\d", re.sub(r"<[^>]*>?", " ", chord_string))
    if not codes:
        return 4, 4
    unknown = [code for code in codes if code not in TIME_SIGNATURES]
    if unknown:
        raise ChartError(f"unknown time signature {unknown[0]}")
    if len(set(codes)) > 1:
        warn(f"meter changes ({', '.join(dict.fromkeys(codes))}) read as {codes[0]} throughout")
    return TIME_SIGNATURES[codes[0]]


# ---------- Songs to tracks ----------

def song_track(song, track_id, source):
    """Build the Track of one song, or raise ChartError; also return its warnings.

    `source` holds the collection, corpus and license of the import.
    """
    warnings = []
    if not song.chords:
        raise ChartError("no chord data")
    try:
        key = chart_key(song.key)
    except NotationError as error:
        raise ChartError(str(error)) from None
    meter = time_signature(song.chords, warnings.append)
    try:
        bars = chart_bars(song.chords, warnings.append)
    except ChartError:
        raise
    except (IndexError, AttributeError, re.error) as error:
        raise ChartError(f"chart layout could not be read ({type(error).__name__}: {error})") from error
    if not bars:
        raise ChartError("no bars")
    chords, beats = [], meter[0]
    for number, bar in enumerate(bars, 1):
        offset = 0  # beats of the bar already played
        for (symbol, _), length in zip(bar, bar_beats([cells for _, cells in bar], beats)):
            try:
                value = chart_to_harte(symbol)
            except NotationError as error:
                raise ChartError(f"bar {number}: {error}") from None
            chords.append(((number, offset), length, value))
            offset += length
    total = beats * len(bars)
    track = Track(
        id=track_id, title=song.title.strip(), artist=song.composer.strip(),
        composers=song.composer.strip(), genre=song.style.strip(),
        corpus=source["corpus"], collection=source["collection"], license=source["license"],
        chords=chords, keys=[((1, 0), total, key)], meters=[((1, 0), total, f"{meter[0]}/{meter[1]}")],
        first_beat=0,  # positions above are (bar, beats already played)
        duration=float(len(bars)),
        metadata={"source": source["name"], "bars": len(bars), "tempo": song.tempo,
                  "ireal_key": song.key},
    )
    return track, warnings


def source_documents(path, folder=""):
    """Yield (name, text) for each playlist file of a source: a file, a folder or a zip.

    In a zip, only the files under `folder` are read.
    """
    path = Path(path)
    if path.suffix.casefold() == ".zip":
        with zipfile.ZipFile(path) as archive:
            for name in sorted(archive.namelist()):
                if name.startswith(folder) and name.casefold().endswith(TEXT_SUFFIXES + (".csv",)):
                    yield name, archive.read(name).decode("utf-8", errors="replace")
    elif path.is_dir():
        for file in sorted(p for p in path.rglob("*") if p.suffix.casefold() in TEXT_SUFFIXES + (".csv",)):
            yield str(file.relative_to(path)), file.read_text(encoding="utf-8", errors="replace")
    else:
        yield path.name, path.read_text(encoding="utf-8", errors="replace")


def document_links(name, text):
    """The irealb:// links of one document; for a forum dump, those of its ireal_charts column."""
    if name.casefold().endswith(".csv"):
        csv.field_size_limit(1 << 30)
        rows = csv.DictReader(io.StringIO(text))
        if rows.fieldnames and "ireal_charts" in rows.fieldnames:
            return [link for row in rows for link in links_in(row.get("ireal_charts") or "")]
    return links_in(text)


def curation_reason(track, title, threads, known_songs, settings):
    """Why a chart of a curated source is left out, or None to keep it.

    `threads` are the forum threads (file names) the chart was posted in and
    `known_songs` the song keys already in the catalog from other sources.
    """
    if song_key(title) in {song_key(kept) for kept in settings.get("keep", [])}:
        return None
    practice = [thread for thread in threads if PRACTICE_THREAD.search(Path(thread).stem)]
    if practice and len(practice) == len(threads):
        return f"practice or question thread ({Path(practice[0]).stem})"
    if PLACEHOLDER_TITLE.search(title):
        return "exercise or placeholder title"
    if track.metadata["bars"] < MIN_BARS:
        return f"only {track.metadata['bars']} bars"
    if len({value for _, _, value in track.chords if value not in ("N", "X")}) <= 1:
        return "a single chord"
    if song_key(title) in known_songs and len(threads) < settings.get("min_threads", 2):
        return f"song already in the catalog, posted in {len(threads)} thread(s)"
    return None


class IrealImport:
    """Import iReal sources one after the other, merging identical charts across them."""

    def __init__(self):
        """Start with no known chart and no known title."""
        self.charts = {}  # chords -> (track id, title) of the first copy
        self.titles = set()  # song keys of the iReal titles read so far
        self.known_songs = set()  # song keys of every track written to the catalog (note_song)

    def note_song(self, title):
        """Remember a song written to the catalog, from any source, for the curation rules."""
        self.known_songs.add(song_key(title))

    def tracks(self, source, log):
        """Yield the Tracks of one source, logging every song.

        `source` is a dict with path, name, collection, corpus and license
        (and folder, for a zip holding several sources).
        """
        songs = []
        for name, text in source_documents(source["path"], source.get("folder", "")):
            links = document_links(name, text)
            if not links and not name.casefold().endswith(".csv"):
                log.error(name, "-", "no irealb:// link in the file")
            for link_number, link in enumerate(links, 1):
                try:
                    found, _ = raw_songs(link)
                except (ValueError, IndexError) as error:
                    log.error(f"{name} link {link_number}", "-", f"link could not be decoded ({error})")
                    continue
                songs += [(f"{name} link {link_number} song {i}", song) for i, song in enumerate(found, 1)]
        self.titles |= {song_key(song.title) for _, song in songs}
        curate = source.get("curate")
        known_songs = set(self.known_songs)  # songs from earlier sources only
        accepted, threads, number = [], {}, 0
        for where, song in songs:
            title = self._title(song.title)
            song.title, original = title, song.title.strip()
            document = where.rsplit(" link ", 1)[0]
            try:
                track, warnings = song_track(song, f"{source['collection']}_{number + 1}", source)
            except ChartError as error:
                log.error(where, original or "(untitled)", str(error))
                continue
            # Same bars and chords as an earlier chart, whatever its title: not imported
            identity = tuple((position_key(position), v) for position, _, v in track.chords)
            if identity in self.charts:
                log.duplicate(where, original, "%s (%s)" % self.charts[identity])
                threads.get(identity, set()).add(document)
                continue
            number += 1
            self.charts[identity] = (track.id, title)
            threads[identity] = {document}
            if title != original:
                track.metadata["ireal_title"] = original
                warnings.append(f"copy number dropped from the title: {title}")
            accepted.append((where, title, track, warnings, identity))
        # The thread counts are complete only now, so curation comes after reading the whole source
        for where, title, track, warnings, identity in accepted:
            reason = curation_reason(track, title, threads[identity], known_songs, curate) if curate else None
            if reason:
                log.curated(where, title, reason)
                continue
            track.metadata["threads"] = len(threads[identity])
            for warning in warnings:
                log.warning(where, title, warning)
            log.ok(where, title, f"{track.id}, {track.keys[0][2]}, {track.meters[0][2]}, "
                                 f"{track.metadata['bars']} bars, {len(track.chords)} chords")
            yield track

    def _title(self, title):
        """Drop a trailing copy number (Autumn Leaves 2) when the song exists without it."""
        title = (title or "").strip()
        match = COPY_NUMBER.match(title)
        if match and song_key(match.group(1)) in self.titles:
            return match.group(1)
        return title
