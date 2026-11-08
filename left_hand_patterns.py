"""Define the piano patterns offered in Studio and export their catalog."""

import json
from dataclasses import dataclass
from pathlib import Path


PHILIP = "Philip Wesley article"
TOPMUSIC = "Left Hand Pattern Worksheet"
CREATIVE = "Creative Piano Teacher patterns"
MELLIS = "Index of Left-hand Accompaniment Patterns"
BASIC_VOICING = "Berklee basic piano voicing techniques"
BOSSA_COMP = "Rhythm Dictionary bossa piano comp; Yamaha Exploring Latin Rhythms"
SON_MONTUNO = "Rhythm Dictionary son montuno 2-3; Midwest Clinic rhythm patterns"
SHUFFLE_POSITIONS = (0, .1875, .25, .4375, .5, .6875, .75, .9375)
SHUFFLE_DURATIONS = (.1875, .0625) * 4
SHELL_PATTERN_IDS = frozenset(("boogie_walking_shells",))
# Positions are quarter notes from the bar start; negative positions count back from its end.
SHELL_COMP_RHYTHMS = (
    ("charleston", ((0.0, 1.5), (1.5, .5))),
    ("shifted_charleston", ((.5, .5), (2.0, 1.0))),
    ("red_garland", ((1.5, .5), (-.5, .5))),
    ("three_and_hold", ((0.0, .75), (2.5, 1.25))),
    ("beat_two_push", ((1.0, .75), (-.5, .5))),
    ("sparse_and_three", ((2.5, 1.25),)),
)


@dataclass(frozen=True)
class PatternStep:
    """Place one piano role at a fraction of a measure."""

    position: float
    role: str
    duration: float | None = None
    grace: bool = False
    initial_only: bool = False


@dataclass(frozen=True)
class LeftHandPattern:
    """Describe a repeatable piano motif and its useful style categories."""

    id: str
    name: str
    categories: tuple[str, ...]
    sources: tuple[str, ...]
    steps: tuple[PatternStep, ...]
    cycle_bars: int = 1
    transcribed: bool = False
    source_meter: str | None = None
    beat_interval_quarters: float | None = None


def _make_pattern(identifier, name, categories, sources, roles, positions=None):
    """Build a pattern from roles placed evenly or at supplied bar fractions."""
    role_list = roles.split()
    if positions is None:
        positions = [index / len(role_list) for index in range(len(role_list))]
    if len(positions) != len(role_list) or any(not 0 <= pos < 1 for pos in positions):
        raise ValueError(f"Invalid steps for pattern {identifier}")
    if list(positions) != sorted(positions):
        raise ValueError(f"Pattern steps must be ordered: {identifier}")
    return LeftHandPattern(
        identifier, name, tuple(categories.split()), tuple(sources),
        tuple(PatternStep(pos, role) for pos, role in zip(positions, role_list)),
    )


def _make_scored_pattern(identifier, name, categories, sources, notes,
                         cycle_bars=1, source_meter="4/4", transcribed=True,
                         beat_interval_quarters=None):
    """Store timed attacks and lengths, with optional cycle pickup and beat pulse."""
    if cycle_bars < 1 or not isinstance(cycle_bars, int):
        raise ValueError(f"Invalid cycle for {identifier}")
    if beat_interval_quarters is not None and beat_interval_quarters <= 0:
        raise ValueError(f"Invalid beat interval for {identifier}")
    steps = tuple(PatternStep(float(note[0]), note[2], float(note[1]),
                              bool(note[3]) if len(note) >= 4 else False,
                              bool(note[4]) if len(note) >= 5 else False)
                  for note in notes)
    if not steps or any(not 0 <= step.position < cycle_bars or step.duration <= 0
                        for step in steps):
        raise ValueError(f"Invalid scored notes for {identifier}")
    if tuple(step.position for step in steps) != tuple(sorted(step.position for step in steps)):
        raise ValueError(f"Scored notes must be time ordered: {identifier}")
    return LeftHandPattern(identifier, name, tuple(categories.split()), tuple(sources),
                           steps, cycle_bars, transcribed, source_meter,
                           beat_interval_quarters)


def _shuffle_notes(roles):
    """Build a written dotted-eighth and sixteenth shuffle measure."""
    role_list = roles.split()
    if len(role_list) != len(SHUFFLE_POSITIONS):
        raise ValueError("A shuffle measure needs eight written attacks")
    return tuple(zip(SHUFFLE_POSITIONS, SHUFFLE_DURATIONS, role_list))


ALL_PATTERN_LIST = (
    _make_scored_pattern("block_chords", "Blocked chords", "ballad straight", (PHILIP, TOPMUSIC, CREATIVE),
                         ((0, 1, "chord"),), transcribed=False,
                         beat_interval_quarters=4),
    _make_scored_pattern("broken_chords", "Broken chords", "ballad straight", (PHILIP, CREATIVE),
                         tuple((index / 4, .25, role) for index, role in enumerate(
                             "root third fifth third".split()))),
    _make_scored_pattern("arpeggio_ascending", "Ascending arpeggio", "ballad classical", (PHILIP, TOPMUSIC),
                         tuple((index / 8, .125, role) for index, role in enumerate(
                             "root third fifth octave root third fifth octave".split()))),
    _make_scored_pattern("rolled_chords", "Rolled chords", "ballad classical", (CREATIVE,),
                         ((0, 1, "rolled"),)),
    _make_scored_pattern("stride", "Stride bass", "swing blues", (PHILIP, TOPMUSIC, CREATIVE, MELLIS),
                         ((0, .25, "octaves"), (.25, .25, "stride_chord"),
                          (.5, .25, "fifth_octaves"), (.75, .25, "stride_chord"))),
    _make_scored_pattern("walking_bass", "Walking bass", "swing blues", (PHILIP, TOPMUSIC, CREATIVE),
                         tuple((index / 4, .25, role) for index, role in enumerate(
                             "root second third fourth sharp_fourth fourth third second".split())),
                         cycle_bars=2),
    _make_scored_pattern("tango", "Tango bass", "latin", (TOPMUSIC, CREATIVE),
                         ((0, .375, "root"), (.375, .125, "fifth"),
                          (.5, .25, "octave"), (.75, .25, "fifth"))),
    _make_pattern("bossa_bass", "Bossa bass", "latin", (),
                  "root chord fifth root chord", (0, 0.375, 0.5, 0.75, 0.875)),
    _make_scored_pattern("bossa_chord_comp", "Bossa chord comp 2", "latin", (BOSSA_COMP,),
                         ((0, .5, "root"), (0, .375, "upper_shell"),
                          (.375, .125, "upper_shell"), (.5, .5, "fifth"),
                          (.75, .25, "upper_shell"), (1, .5, "root"),
                          (1.25, .375, "upper_shell"), (1.5, .5, "fifth"),
                          (1.625, .375, "upper_shell")),
                         cycle_bars=2, transcribed=False),
    _make_scored_pattern("latin_montuno", "Latin montuno (2-3 clave)", "latin", (SON_MONTUNO,),
                         ((0, .25, "octaves_up", False, True),
                          (.25, .125, "third_octaves_up"),
                          (.375, .25, "fifth_octaves_up"),
                          (.625, .25, "third_octaves_up"),
                          (.875, .25, "octaves_up"),
                          (1.125, .25, "third_octaves_up"),
                          (1.375, .25, "fifth_octaves_up"),
                          (1.625, .25, "third_octaves_up"),
                          (1.875, .25, "octaves_up")),
                         cycle_bars=2, transcribed=False),
    _make_scored_pattern("pop_rock", "Pop and rock bass", "straight", (CREATIVE,),
                         tuple((index / 8, .125, "octaves") for index in range(8))),
    _make_scored_pattern("boogie_simple", "Simple boogie / barrelhouse shuffle", "blues straight swing", (CREATIVE, MELLIS),
                         ((0, .25, "power"), (.25, .25, "sixth_power"),
                          (.5, .25, "power"), (.75, .25, "sixth_power"))),
    _make_scored_pattern("boogie_walking", "Boogie walking bass", "blues", (MELLIS,),
                         tuple((index / 4, .25, role) for index, role in enumerate(
                             "root third fifth sixth flat_seventh sixth fifth third".split())),
                         cycle_bars=2),
    _make_scored_pattern("left_hand_shuffle", "Left hand shuffle", "blues swing", (MELLIS,),
                         _shuffle_notes("power_up power_up sixth_power_up sixth_power_up power_up power_up sixth_power_up sixth_power_up")),
    _make_scored_pattern("new_orleans_bass", "New Orleans bass", "blues swing", (MELLIS,),
                         ((0, .375, "root_up"), (.375, .015625, "flat_third_up", True),
                          (.375, .375, "third_up"), (.75, .25, "fifth_up"))),
)


def _with_shell_comp(base, identifier, name, categories):
    """Layer short upper guide-tone chords over an unchanged bass cycle."""
    shell_steps = tuple(
        PatternStep(bar + position, "upper_shell", .125)
        for bar in range(base.cycle_bars)
        for position in (.375, .875)
    )
    steps = tuple(sorted(base.steps + shell_steps, key=lambda step: step.position))
    return LeftHandPattern(identifier, name, tuple(categories.split()),
                           base.sources + (BASIC_VOICING,), steps,
                           base.cycle_bars, False, base.source_meter)


BASE_PATTERNS = {pattern.id: pattern for pattern in ALL_PATTERN_LIST}
ALL_PATTERN_LIST += (
    _with_shell_comp(BASE_PATTERNS["boogie_walking"], "boogie_walking_shells",
                     "Boogie walking with chord shells", "blues"),
)

CURATED_PATTERN_IDS_BY_STYLE = {
    "swing": ("walking_bass", "stride"),
    "blues": ("boogie_simple", "boogie_walking", "boogie_walking_shells",
              "left_hand_shuffle", "new_orleans_bass"),
    "bossa nova": ("bossa_chord_comp", "bossa_bass", "block_chords"),
    "latin": ("latin_montuno", "tango", "bossa_bass"),
    "straight pop/rock": ("pop_rock", "broken_chords"),
    "ballad": ("broken_chords", "arpeggio_ascending", "rolled_chords"),
}
CURATED_PATTERN_IDS = frozenset(
    pattern_id for pattern_ids in CURATED_PATTERN_IDS_BY_STYLE.values()
    for pattern_id in pattern_ids
)
PATTERN_LIST = tuple(pattern for pattern in ALL_PATTERN_LIST
                     if pattern.id in CURATED_PATTERN_IDS)
PATTERNS = {pattern.id: pattern for pattern in ALL_PATTERN_LIST}
CURATED_PATTERNS = {pattern.id: pattern for pattern in PATTERN_LIST}

DEFAULT_PATTERN_BY_STYLE = {
    "swing": "walking_bass",
    "blues": "boogie_simple",
    "bossa nova": "bossa_chord_comp",
    "latin": "latin_montuno",
    "straight pop/rock": "pop_rock",
    "ballad": "arpeggio_ascending",
}

if len({pattern.id for pattern in ALL_PATTERN_LIST}) != len(ALL_PATTERN_LIST):
    raise ValueError("Left-hand pattern IDs must be unique")
if CURATED_PATTERN_IDS - CURATED_PATTERNS.keys():
    raise ValueError("Curated pattern IDs must exist")
if any(len(pattern_ids) > 10 for pattern_ids in CURATED_PATTERN_IDS_BY_STYLE.values()):
    raise ValueError("Each style may offer at most ten piano patterns")


def pattern_fidelity(pattern):
    """Report whether a pattern follows a score, adapts it, or is original."""
    if pattern.transcribed:
        return "scored example"
    if not pattern.sources:
        return "original"
    return "adapted"


def list_patterns(category=None):
    """Return active patterns, optionally limited to a broad category."""
    if category is None:
        return PATTERN_LIST
    return tuple(pattern for pattern in PATTERN_LIST if category in pattern.categories)


def list_patterns_for_style(style):
    """Return the ordered, small set chosen for one playback style."""
    if style not in CURATED_PATTERN_IDS_BY_STYLE:
        raise ValueError(f"Unknown style: {style!r}")
    return tuple(CURATED_PATTERNS[pattern_id]
                 for pattern_id in CURATED_PATTERN_IDS_BY_STYLE[style])


def export_pattern_catalog(output, patterns=None):
    """Export the active pattern metadata used by Studio."""
    path = Path(output)
    path.parent.mkdir(parents=True, exist_ok=True)
    rows = [
        {
            "id": pattern.id,
            "name": pattern.name,
            "categories": pattern.categories,
            "styles": tuple(style for style, pattern_ids in
                            CURATED_PATTERN_IDS_BY_STYLE.items()
                            if pattern.id in pattern_ids),
            "default_for": tuple(style for style, default_id in
                                 DEFAULT_PATTERN_BY_STYLE.items()
                                 if pattern.id == default_id),
            "sources": pattern.sources,
            "fidelity": pattern_fidelity(pattern),
            "cycle_bars": pattern.cycle_bars,
            "source_meter": pattern.source_meter,
            "beat_interval_quarters": pattern.beat_interval_quarters,
            "steps": [{"position": step.position, "duration": step.duration,
                       "role": step.role, "grace": step.grace,
                       "initial_only": step.initial_only}
                      for step in pattern.steps],
            "shell_variations": [
                {"name": name, "hits": [
                    {"position_quarters": abs(position),
                     "from_bar_end": position < 0,
                     "duration_quarters": duration}
                    for position, duration in hits]}
                for name, hits in SHELL_COMP_RHYTHMS
            ] if pattern.id in SHELL_PATTERN_IDS else [],
        }
        for pattern in (PATTERN_LIST if patterns is None else patterns)
    ]
    path.write_text(json.dumps(rows, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    export_pattern_catalog(Path(__file__).resolve().parent / "data/left_hand_patterns.json")
