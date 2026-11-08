"""Build the curated progression list in the database's Roman numeral notation."""

import re


ARTICLE = "https://www.native-instruments.com/blogs/blog/common-chord-progressions"

# Preserve the user's order. I-IV-V appears once; its linked source is attached here.
PROGRESSIONS = [
    ("I IV V", ARTICLE + "#i-iv-v"),
    ("ii V I", None),
    ("I V vi IV", None),
    ("vi IV I V", None),
    ("vi ii V I", None),
    ("ii–IIb7–I", None),
    ("I-vi—IV—V", ARTICLE + "#i-vi-iv-v"),
    ("IV-V-I-vi", ARTICLE + "#iv-v-i-vi"),
    ("i—VIIb—VIb—V", ARTICLE + "#i-vii-vi-v"),
    ("I—III—IV—iv", ARTICLE + "#i-iii-iv-iv"),
    ("i-VIIb-VIb-VIIb", ARTICLE + "#i-vii-vi-vii"),
    ("ii–VIIb7-I", None),
    ("VIb VIIb I", None),
    ("I V vi iii IV I IV V", None),
    ("I V IV IV I V I V", None),
    ("IV–V–I", None),
    ("V–iv–I", None),
    ("I:maj – VIIb:maj – IV:maj – I:maj", None),
    ("II:maj – V:maj – I:maj", None),
    ("IV:min – V:maj – I:min", None),
]

TOKEN = re.compile(r"^(VII|III|VI|IV|II|V|I|vii|iii|vi|iv|ii|v|i)(b|#)?(7|:(?:maj|min|7))?$")


def convert_token(token):
    """Convert one shorthand or canonical Roman chord to the catalog notation."""
    match = TOKEN.fullmatch(token)
    if not match:
        raise ValueError(f"Unsupported progression token: {token!r}")
    numeral, accidental, suffix = match.groups()
    if suffix and suffix.startswith(":"):
        quality = suffix[1:]
    elif suffix == "7":
        quality = "7"
    else:
        quality = "min" if numeral.islower() else "maj"
    # A written 7 specifies a dominant seventh, rather than a generic major triad.
    return f"{numeral.upper()}{accidental or ''}:{quality}"


# Typeset signs for labels, written as escapes to keep this file ASCII
FLAT, SHARP, DASH = "\u266d", "\u266f", " \u2013 "


def roman_label(chords):
    """Write catalog chords as readable numerals: II:min V:maj IIb:7 -> ii - V - bII7."""
    labels = []
    for chord in chords:
        match = TOKEN.fullmatch(chord)
        if not match or not (match.group(3) or "").startswith(":"):
            raise ValueError(f"Unsupported catalog chord: {chord}")
        numeral, accidental, suffix = match.groups()
        quality = suffix[1:]
        if quality == "min":
            numeral = numeral.lower()
        labels.append((accidental or "").replace("b", FLAT).replace("#", SHARP)
                      + numeral + ("" if quality in ("maj", "min") else quality))
    return DASH.join(labels)


def convert_progression(progression):
    """Convert a progression string to an ordered list of canonical Roman chords."""
    tokens = [token for token in re.split(r"[\s\-\u2013\u2014]+", progression.strip()) if token]
    return [convert_token(token) for token in tokens]


def build_catalog():
    """Build the curated catalog while removing duplicate chord sequences."""
    seen = set()
    entries = []
    for original, source_url in PROGRESSIONS:
        chords = convert_progression(original)
        signature = tuple(chords)
        if signature in seen:
            continue
        seen.add(signature)
        entries.append({
            "id": f"progression-{len(entries) + 1:02d}",
            "original": original,
            "chords": chords,
            "label": roman_label(chords),
            "source_url": source_url,
        })
    return entries
