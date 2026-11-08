"""The one place where chord symbols are read and written (see docs/CHORD_NOTATION.md).

The catalog stores every chord in canonical Harte notation, whatever corpus it
comes from, so that one chord has one spelling:

- parse_harte reads any Harte symbol written by ChoCo's corpora (absolute
  root "Eb:min7/b7" or Roman root "IIb:7"); write_harte writes the canonical
  form; canonical_harte does both.
- parse_chart reads chart symbols, the iReal Pro notation also used by the
  Studio ("Eb-7/Db", "F7b9", "Bh7"); write_chart writes them. chart_to_harte
  and harte_to_chart convert between the two notations.

A chord is a root, a set of intervals above it (tokens: degree and semitones,
e.g. (9, 13) for b9) and an optional bass interval. Both notations are read
into that form and written from it, so converting never depends on how a
source happened to spell a chord.
"""

import re
from dataclasses import dataclass
from functools import lru_cache


NOTES = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
LETTERS = "CDEFGAB"
MAJOR_STEPS = (0, 2, 4, 5, 7, 9, 11)
ROMAN = ("I", "II", "III", "IV", "V", "VI", "VII")
NOTE_ROOT = re.compile(r"([A-G])([#b]*)")
CHART_ROOT = re.compile(r"[A-G][#b]?")
ROMAN_ROOT = re.compile(r"(VII|VI|V|IV|III|II|I)([#b]*)")
INTERVAL = re.compile(r"(\*?)([#b]*)(\d+)")
NO_CHORD = ("N", "X")  # N: no chord is played; X: the chord is unknown
ROOT_TOKEN = (1, 0)
FIFTH = (5, 7)


class NotationError(ValueError):
    """A chord symbol that cannot be read; the message says why."""


# ---------- Intervals ----------

def natural_semitones(degree):
    """Semitones of an unaltered degree above the root: 3 -> 4, 9 -> 14."""
    octave, step = divmod(degree - 1, 7)
    return MAJOR_STEPS[step] + 12 * octave


def read_interval(text):
    """Read a Harte interval such as b9, #11 or *5 into (degree, semitones, omitted)."""
    match = INTERVAL.fullmatch(text.strip())
    if not match or int(match.group(3)) < 1:
        raise NotationError(f"unreadable interval {text!r}")
    omitted, accidentals, degree = match.group(1), match.group(2), int(match.group(3))
    shift = accidentals.count("#") - accidentals.count("b")
    return degree, natural_semitones(degree) + shift, bool(omitted)


def interval_name(token):
    """Write an interval token as Harte spells it: (9, 13) -> b9, (7, 9) -> bb7."""
    degree, semitones = token
    shift = semitones - natural_semitones(degree)
    return ("b" * -shift if shift < 0 else "#" * shift) + str(degree)


def simple_token(token):
    """Bring a compound interval within the octave: (9, 14) -> (2, 2)."""
    degree, semitones = token
    while degree > 7:
        degree, semitones = degree - 7, semitones - 12
    return degree, semitones


def _tokens(*names):
    """Build a token set from interval names, the root included."""
    return frozenset([ROOT_TOKEN] + [read_interval(name)[:2] for name in names])


# Harte shorthands, as defined by Harte (2005) and mir_eval, in tie-break order
HARTE_SHORTHANDS = (
    ("maj", _tokens("3", "5")), ("min", _tokens("b3", "5")),
    ("dim", _tokens("b3", "b5")), ("aug", _tokens("3", "#5")),
    ("maj7", _tokens("3", "5", "7")), ("min7", _tokens("b3", "5", "b7")),
    ("7", _tokens("3", "5", "b7")), ("dim7", _tokens("b3", "b5", "bb7")),
    ("hdim7", _tokens("b3", "b5", "b7")), ("minmaj7", _tokens("b3", "5", "7")),
    ("maj6", _tokens("3", "5", "6")), ("min6", _tokens("b3", "5", "6")),
    ("9", _tokens("3", "5", "b7", "9")), ("maj9", _tokens("3", "5", "7", "9")),
    ("min9", _tokens("b3", "5", "b7", "9")),
    ("sus2", _tokens("2", "5")), ("sus4", _tokens("4", "5")),
    ("11", _tokens("3", "5", "b7", "9", "11")), ("min11", _tokens("b3", "5", "b7", "9", "11")),
    ("13", _tokens("3", "5", "b7", "9", "11", "13")),
    ("maj13", _tokens("3", "5", "7", "9", "11", "13")),
    ("min13", _tokens("b3", "5", "b7", "9", "11", "13")),
    ("1", _tokens()), ("5", _tokens("5")),
)
SHORTHAND_TOKENS = dict(HARTE_SHORTHANDS)
# Non-standard shorthands found in ChoCo's corpora, read as the standard one
HARTE_ALIASES = {"hdim": "hdim7", "6": "maj6"}


# ---------- Chords ----------

@dataclass(frozen=True)
class Chord:
    """A chord: root as written, its intervals and its bass interval.

    The bass sounds below the chord and belongs to it (Harte); it is kept
    apart from the tokens so that C:min/b7 (C-/Bb) and C:min7/b7 (C-7/Bb)
    keep the spelling of their source.
    """

    root: str
    tokens: frozenset
    bass: tuple | None = None

    @property
    def root_pc(self):
        """Pitch class of an absolute root (C = 0); raises for a Roman root."""
        return note_pc(self.root)

    @property
    def bass_pc(self):
        """Pitch class of the bass note, the root when there is no slash bass."""
        return (self.root_pc + (self.bass or ROOT_TOKEN)[1]) % 12

    def has(self, name):
        """Tell whether the chord has an interval, given by name (b3, 7, #11)."""
        return read_interval(name)[:2] in self.tokens

    def semitones(self, degree):
        """Semitones of the chord's interval on a degree (lowest first), or None."""
        found = sorted(s for d, s in self.tokens if d == degree)
        return found[0] if found else None


def note_pc(name):
    """Pitch class of a note name such as Eb or F#."""
    match = NOTE_ROOT.fullmatch(name)
    if not match:
        raise NotationError(f"unreadable note {name!r}")
    letter, accidentals = match.groups()
    return (NOTES[letter] + accidentals.count("#") - accidentals.count("b")) % 12


def spell_note(root, token):
    """Name the note an interval above a root, spelled by its degree: (Eb, b7) -> Db."""
    match = NOTE_ROOT.fullmatch(root)
    if not match:
        raise NotationError(f"cannot spell a note above {root!r}")
    degree, semitones = simple_token(token)
    letter = LETTERS[(LETTERS.index(match.group(1)) + degree - 1) % 7]
    shift = (note_pc(root) + semitones - NOTES[letter] + 6) % 12 - 6
    if abs(shift) > 2:
        raise NotationError(f"cannot spell {interval_name(token)} above {root}")
    return letter + ("b" * -shift if shift < 0 else "#" * shift)


def _apply_changes(base, changes):
    """Apply Harte changes (added and omitted intervals) to a shorthand's tokens.

    Omissions apply first (*5 removes the fifth). An added altered interval
    replaces the shorthand's natural interval on the same degree (7(b5) is
    C E Gb Bb), which is how ChoCo's corpora use alterations; strict Harte
    writers add the omission themselves (7(b5,*5)), which reads the same.
    Listing the natural interval as well keeps it (13(5,b5) has both fifths).
    """
    listed = {(d, s) for d, s, omitted in changes if not omitted}
    tokens = set(base)
    for degree, semitones, omitted in changes:
        if omitted:
            exact = (degree, semitones)
            tokens -= {exact} if exact in tokens else {t for t in base if t[0] == degree}
    altered = {d for d, s in listed if s != natural_semitones(d)}
    replaced = {t for t in base if t[0] in altered and t[1] == natural_semitones(t[0])} - listed
    return frozenset((tokens - replaced) | listed)


@lru_cache(maxsize=None)
def parse_harte(symbol):
    """Read a Harte symbol (Eb:min7/b7, IIb:7, C, C:(3,5,b7)); None for N or X."""
    symbol = symbol.strip()
    if symbol in NO_CHORD:
        return None
    head, slash, bass_text = symbol.partition("/")
    root, colon, quality = head.partition(":")
    if not (NOTE_ROOT.fullmatch(root) or ROMAN_ROOT.fullmatch(root)):
        raise NotationError(f"unreadable chord root in {symbol!r}")
    bass = None
    if slash:
        degree, semitones, omitted = read_interval(bass_text)
        if omitted:
            raise NotationError(f"omitted bass interval in {symbol!r}")
        bass = simple_token((degree, semitones))
        bass = None if bass == ROOT_TOKEN else bass
    name, opening, rest = (quality if colon else "maj").partition("(")
    name = HARTE_ALIASES.get(name, name)
    if name == "" and opening:
        base = frozenset([ROOT_TOKEN])
    elif name in SHORTHAND_TOKENS:
        base = SHORTHAND_TOKENS[name]
    else:
        raise NotationError(f"unknown Harte shorthand {name!r} in {symbol!r}")
    changes = []
    if opening:
        if not rest.endswith(")"):
            raise NotationError(f"unclosed interval list in {symbol!r}")
        changes = [read_interval(part) for part in rest[:-1].split(",") if part.strip()]
    return Chord(root, _apply_changes(base, changes), bass)


def _cover(tokens, table, alterations_replace):
    """Choose the table entry that best names a token set.

    The entry must be contained in the tokens, except that its fifth and
    its root may be missing, and, with alterations_replace, any interval an
    alteration on the same degree replaces (chart notation writes 13b9 and
    7#5). It covers as many tokens as possible; ties go to the entry that
    leaves fewer intervals to write as omitted, then to table order. Without
    alterations_replace (Harte), a replaced fifth is an omission to write,
    so Harte prefers aug(b7) to 7(#5,*5).
    """
    best, best_score = None, None
    altered = {d for d, s in tokens if s != natural_semitones(d)} if alterations_replace else set()
    for order, (name, shape) in enumerate(table):
        missing = shape - tokens
        replaced = {t for t in missing if t[0] in altered and t[1] == natural_semitones(t[0])}
        if missing - replaced - {FIFTH, ROOT_TOKEN}:
            continue
        unexplained = len(missing - replaced)
        score = (len(shape & tokens), -unexplained, -order)
        if best_score is None or score > best_score:
            best, best_score = (name, shape), score
    return best


def _sorted(tokens):
    """Order intervals by degree, then flat before natural before sharp."""
    return sorted(tokens, key=lambda token: (token[0], token[1]))


def write_harte(chord):
    """Write a chord in canonical Harte notation (see docs/CHORD_NOTATION.md)."""
    if chord is None:
        return "N"
    tokens = chord.tokens
    name, shape = _cover(tokens, HARTE_SHORTHANDS, alterations_replace=False)
    extra = tokens - shape
    altered = {d for d, s in extra if s != natural_semitones(d)}
    # A natural interval kept beside an alteration of its degree is listed, or the alteration would replace it
    extra |= {t for t in shape & tokens if t[0] in altered and t[1] == natural_semitones(t[0])}
    extras = [interval_name(t) for t in _sorted(extra)]
    omitted = ["*" + interval_name(t) for t in _sorted(shape - tokens)]
    listed = extras + omitted
    text = f"{chord.root}:{name}" + (f"({','.join(listed)})" if listed else "")
    return text + (f"/{interval_name(chord.bass)}" if chord.bass else "")


@lru_cache(maxsize=None)
def canonical_harte(symbol):
    """Rewrite a Harte symbol in canonical form; N and X stay as they are."""
    symbol = symbol.strip()
    return symbol if symbol in NO_CHORD else write_harte(parse_harte(symbol))


# ---------- Chart (iReal Pro) notation ----------

# Quality markers at the start of a chart suffix, longest first:
# marker -> (intervals of the triad or seventh it names, seventh a number adds)
CHART_MARKERS = (
    ("-^", ("b3", "5", "7"), "7"), ("^", ("3", "5", "7"), "7"),
    ("-", ("b3", "5"), "b7"), ("h", ("b3", "b5", "b7"), "b7"),
    ("o", ("b3", "b5"), "bb7"), ("+", ("3", "#5"), "b7"), ("", ("3", "5"), "b7"),
)
CHART_ALT = _tokens("3", "b5", "b7", "b9", "b13")  # 7alt, as ChoCo and music21 read it
CHART_MODIFIER = re.compile(r"sus2|sus4|sus|no\d+|add(?:#{1,2}|b{1,2})?\d+|alt|(?:#{1,2}|b{1,2})\d+")
# Spellings typed by people rather than by iReal Pro, read as iReal's own
# (maj7 is a major seventh, maj alone a major triad: Gmaj is G)
CHART_SPELLINGS = (("\u00f8", "h"), ("\u2206", "^"), ("\u0394", "^"), ("min", "-"),
                   ("maj7", "^7"), ("maj9", "^9"), ("maj13", "^13"), ("maj", ""), ("M7", "^7"),
                   ("dim", "o"), ("aug", "+"), ("o^7", "oadd7"))


def chart_spelling(quality):
    """Rewrite a typed chord suffix in iReal Pro's own spelling: min7 -> -7, maj7 -> ^7, m -> -."""
    text = quality
    for typed, chart in CHART_SPELLINGS:
        text = text.replace(typed, chart)
    if text.startswith("m") and not text.startswith("ma"):
        text = "-" + text[1:]
    return text


def _chart_quality_tokens(quality):
    """Read a chart suffix (-7, ^9#11, 7b9sus, h, 13, 7alt) into interval tokens."""
    text = chart_spelling(quality)
    marker, triad, seventh = next(m for m in CHART_MARKERS if text.startswith(m[0]))
    rest = text[len(marker):]
    tokens = set(_tokens(*triad))
    number = re.match(r"69|13|11|9|7|6|5|2|1", rest)
    if number:
        value, rest = number.group(0), rest[len(number.group(0)):]
        if value == "1" and marker == "":
            tokens = {ROOT_TOKEN}  # the root alone, as Harte's C:1
        elif value == "1":
            raise NotationError(f"unreadable chart quality {quality!r}")
        elif value == "5" and marker == "":
            tokens = set(_tokens("5"))  # power chord
        elif value == "2" and marker == "":
            tokens = set(_tokens("2", "5"))  # iReal "2" is sus2, as ChoCo reads it
        elif value in ("6", "69"):
            tokens.add(read_interval("6")[:2])
        elif value in ("5", "2"):
            tokens.add(read_interval(value)[:2])
        # ^ and h already hold their seventh: ^ alone is a major seventh, h a half-diminished one
        if value in ("7", "9", "11", "13") and not any(d == 7 for d, _ in tokens):
            tokens.add(read_interval(seventh)[:2])
        # Stacked numbers include the degrees below them, as in Harte: 13 is 1 3 5 b7 9 11 13
        for degree in {"9": ("9",), "69": ("9",), "11": ("9", "11"), "13": ("9", "11", "13")}.get(value, ()):
            tokens.add(read_interval(degree)[:2])
    base = frozenset(tokens)
    while rest:
        step = CHART_MODIFIER.match(rest)
        if not step:
            raise NotationError(f"unreadable chart quality {quality!r}")
        word, rest = step.group(0), rest[len(step.group(0)):]
        if word.startswith("sus"):
            tokens -= {t for t in tokens if t[0] == 3}
            tokens.add(read_interval("2" if word == "sus2" else "4")[:2])
        elif word.startswith("no"):
            degree = int(word[2:])
            tokens -= {t for t in tokens if t[0] == degree}
        elif word.startswith("add"):
            tokens.add(read_interval(word[3:])[:2])
        elif word == "alt":
            tokens = set(CHART_ALT)
        else:
            token = read_interval(word)[:2]
            tokens -= {t for t in base if t[0] == token[0] and t[1] == natural_semitones(t[0])}
            tokens.add(token)
    return frozenset(tokens)


@lru_cache(maxsize=None)
def parse_chart(symbol):
    """Read a chart symbol (Eb-7/Db, F7b9, Bh7, C^7#11, N.C.); None for no chord."""
    text = symbol.strip()
    if text.upper().replace(".", "") in ("N", "NC", "X"):
        return None
    head, slash, bass_name = text.partition("/")
    match = CHART_ROOT.match(head)  # one accidental at most: Ab#11 is Ab with a sharp 11th
    if not match:
        raise NotationError(f"unreadable chord root in {symbol!r}")
    root = match.group(0)
    tokens = _chart_quality_tokens(head[len(root):])
    bass = None
    if slash:
        if not NOTE_ROOT.fullmatch(bass_name):
            raise NotationError(f"unreadable bass note in {symbol!r}")
        bass = _bass_token(root, bass_name, tokens)
    return Chord(root, tokens, bass)


def _bass_token(root, bass_name, tokens):
    """The interval from the root to a bass note, spelled by the note's letter."""
    degree = (LETTERS.index(bass_name[0]) - LETTERS.index(root[0])) % 7 + 1
    natural = natural_semitones(degree)
    shift = ((note_pc(bass_name) - note_pc(root)) % 12 - natural + 6) % 12 - 6
    token = (degree, natural + shift)
    return None if token == ROOT_TOKEN else token


def _chart_table():
    """The chart names the writer may use, with the tokens the reader gives them."""
    # The augmented triad comes after the sevenths, so C E G# Bb is 7#5 rather than +b7
    names = ("", "-", "o", "^7", "-7", "7", "o7", "h7", "-^7", "+", "6", "-6", "69", "-69",
             "9", "^9", "-9", "h9", "-^9", "11", "-11", "13", "^13", "-13",
             "sus", "7sus", "9sus", "13sus", "sus2", "5", "7alt", "1")
    return tuple((name, _chart_quality_tokens(name)) for name in names)


CHART_TABLE = _chart_table()
CHART_TOKENS = dict(CHART_TABLE)


def write_chart(chord):
    """Write a chord as a chart symbol (iReal Pro notation); None for no chord.

    Missing intervals of the named chord come first, with "no" (7no5),
    unless an alteration replaces them; extra intervals follow, bare when
    altered (7b9, 7#5: an alteration replaces the named chord's interval on
    its degree) and with "add" otherwise (add9, or add#5 when the natural
    fifth stays), so that parse_chart reads back exactly the same chord.
    """
    if chord is None:
        return None
    name, shape = _cover(chord.tokens, CHART_TABLE, alterations_replace=True)
    extras = _sorted(chord.tokens - shape)
    suffix = name
    for token in _sorted(shape - chord.tokens):
        if not any(d == token[0] and s != natural_semitones(d) for d, s in extras):
            suffix += f"no{token[0]}"
    for token in extras:
        natural = token[1] == natural_semitones(token[0])
        keeps_natural = (token[0], natural_semitones(token[0])) in shape & chord.tokens
        written = ("add" if natural or keeps_natural else "") + interval_name(token)
        if not suffix and written[0] in "b#":
            # Right after the root a flat or sharp would read as the root's accidental (Fb6)
            replaces = (token[0], natural_semitones(token[0])) in shape
            written = (f"no{token[0]}" if replaces else "") + "add" + written
        suffix += written
    root = _chart_root(chord.root)
    text = root + suffix
    if chord.bass:
        text += "/" + spell_note(root, chord.bass)
    return text


# Simplest names of the twelve pitch classes, for roots charts cannot spell
SIMPLE_NAMES = ("C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B")


def _chart_root(root):
    """Respell a root with two or more accidentals (Bbb, F##), which charts cannot write."""
    match = NOTE_ROOT.fullmatch(root)
    if not match:
        raise NotationError(f"a chart needs a note root, not {root!r}")
    return root if len(match.group(2)) <= 1 else SIMPLE_NAMES[note_pc(root)]


@lru_cache(maxsize=None)
def chart_to_harte(symbol):
    """Convert a chart symbol (iReal Pro) to canonical Harte: Bh7 -> B:hdim7."""
    return write_harte(parse_chart(symbol))


@lru_cache(maxsize=None)
def harte_to_chart(symbol):
    """Convert a Harte symbol to a chart symbol for the Studio; None for N or X."""
    return write_chart(parse_harte(symbol))


# ---------- Keys and Roman numerals ----------

MODE_WORDS = {"major": "major", "majoror": "major", "maj": "major",
              "minor": "minor", "minoror": "minor", "min": "minor"}


def transpose_from_c(symbol, tonic):
    """Move a Harte chord written in the key of C to the key of `tonic`, spelling the root by
    its degree (Eb:7 in C is Ab:7 in F); the bass is an interval, so it moves with the root."""
    if symbol in NO_CHORD:
        return symbol
    root, rest = re.match(r"([A-G][#b]*)(.*)", symbol).groups()
    # The root as an interval above C (Eb is a minor third), put above the new tonic
    return spell_note(tonic, (LETTERS.index(root[0]) + 1, note_pc(root))) + rest


def canonical_key(value):
    """Write a key as tonic:major, tonic:minor or a bare tonic when the mode is unknown."""
    tonic, separator, mode = str(value).strip().partition(":")
    if not NOTE_ROOT.fullmatch(tonic):
        raise NotationError(f"unreadable key {value!r}")
    if not separator:
        return tonic
    if mode.casefold() not in MODE_WORDS:
        raise NotationError(f"unknown mode in key {value!r}")
    return f"{tonic}:{MODE_WORDS[mode.casefold()]}"


def chart_key(value):
    """Convert an iReal Pro key (Eb, C-) to a catalog key (Eb:major, C:minor)."""
    match = re.fullmatch(r"([A-G][b#]?)(-?)", value.strip())
    if not match:
        raise NotationError(f"unreadable iReal key {value!r}")
    return f"{match.group(1)}:{'minor' if match.group(2) else 'major'}"


@lru_cache(maxsize=None)
def roman_chord(symbol, key):
    """Write a canonical Harte chord with its root as a degree of the key: Gb:7 in F -> IIb:7.

    Degrees follow the tonic's major scale whatever the mode (G in F minor is
    II, Gb is IIb); quality and bass interval are kept.
    """
    if symbol in NO_CHORD:
        return symbol
    root, colon, rest = symbol.partition(":")
    tonic = key.split(":", 1)[0]
    if not NOTE_ROOT.fullmatch(root) or not NOTE_ROOT.fullmatch(tonic):
        raise NotationError(f"cannot romanize {symbol!r} in key {key!r}")
    degree = (LETTERS.index(root[0]) - LETTERS.index(tonic[0])) % 7
    expected = (note_pc(tonic) + MAJOR_STEPS[degree]) % 12
    shift = (note_pc(root) - expected + 6) % 12 - 6
    return ROMAN[degree] + ("b" * -shift if shift < 0 else "#" * shift) + colon + rest


def roman_root_pc(root, key):
    """Pitch class of a Roman root (IIb) in a key (F:minor)."""
    match = ROMAN_ROOT.fullmatch(root)
    if not match:
        raise NotationError(f"unreadable Roman root {root!r}")
    numeral, accidentals = match.groups()
    shift = accidentals.count("#") - accidentals.count("b")
    return (note_pc(key.split(":", 1)[0]) + MAJOR_STEPS[ROMAN.index(numeral)] + shift) % 12


def key_at(keys, onset):
    """The key in force at an onset, from (onset, key) pairs in order; the first key also covers pickup chords."""
    current = keys[0][1]
    for key_onset, value in keys:
        if key_onset > onset:
            break
        current = value
    return current


def roman_rows(chord_rows, keys):
    """Rewrite (ordinal, onset, duration, chord) rows with each chord as a degree of its key.

    `keys` are the song's (onset, key) pairs in order. The Roman chord of a row
    is roman_chord(chord, key in force at its onset): II:min7, V:7, IIb:7/3.
    """
    return [(ordinal, onset, duration, roman_chord(value, key_at(keys, onset)))
            for ordinal, onset, duration, value in chord_rows]
