"""The app's icons and splash screens, drawn from one picture: the music stand of the app
(public/favicon.svg, the StandIcon of src/ui/AppLink.tsx), dark ink on the paper colour with the
yellow line of a staff on its desk.

Writes, under the studio folder given (default: the folder above this script):
  - Android: the launcher icons (square and round, every density), the adaptive icon's
    foreground (the stand alone, inside the safe zone) and background colour, the splash screens
  - iOS: the 1024 px app icon (no transparency, iOS rounds the corners) and the splash screens
  - the web app: icon-192, icon-512, the maskable icon and the Apple touch icon

Run it after changing the picture:  python scripts/build_app_icons.py
It needs cairosvg and Pillow (pip install cairosvg pillow).
"""

import io
import sys
from pathlib import Path

import cairosvg
from PIL import Image

PAPER = '#fbf8f1'
INK = '#1c1a17'
YELLOW = '#ffde3b'
NAME = 'Piano Practice Companion'

# The stand on a 32-unit grid, as in favicon.svg: its desk, the ledge, the pole and the feet,
# and the yellow staff line across the desk. BOX is the part of the grid it covers.
STAND = (
    f'<g fill="none" stroke="{INK}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">'
    '<path d="M8 6h16l-1.6 9H9.6z"/><path d="M7 15h18"/><path d="M16 15v10M16 25l-5 2.5M16 25l5 2.5"/></g>'
    f'<path d="M10.5 9.2h11" stroke="{YELLOW}" stroke-width="2.6" stroke-linecap="round"/>'
)
BOX = (5.9, 4.9, 26.1, 28.6)  # left, top, right, bottom, strokes included

ANDROID_DENSITIES = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}


def stand_group(width: float, height: float, size: float, centre_y: float | None = None) -> str:
    """The stand scaled so that its height is `size` pixels, centred in a picture of width x height."""
    left, top, right, bottom = BOX
    scale = size / (bottom - top)
    x = width / 2 - (left + right) / 2 * scale
    y = (centre_y if centre_y is not None else height / 2) - (top + bottom) / 2 * scale
    return f'<g transform="translate({x:.3f} {y:.3f}) scale({scale:.5f})">{STAND}</g>'


def svg(width: int, height: int, body: str) -> str:
    """An SVG document of some pixel size."""
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">{body}</svg>'


def icon(size: int, shape: str, stand: float) -> str:
    """A square icon: a paper background (`shape` square, rounded, circle or none) and the stand, `stand` of its height."""
    background = {
        'square': f'<rect width="{size}" height="{size}" fill="{PAPER}"/>',
        'rounded': f'<rect width="{size}" height="{size}" rx="{size * 0.22:.2f}" fill="{PAPER}"/>',
        'circle': f'<circle cx="{size / 2}" cy="{size / 2}" r="{size / 2}" fill="{PAPER}"/>',
        'none': '',
    }[shape]
    return svg(size, size, background + stand_group(size, size, size * stand))


def splash(width: int, height: int) -> str:
    """A splash screen: the stand in the middle of the paper, the app's name under it."""
    short = min(width, height)
    size = short * 0.22
    centre = height / 2 - short * 0.04
    text_y = centre + size * 0.5 + short * 0.09
    name = (f'<text x="{width / 2}" y="{text_y:.1f}" text-anchor="middle" fill="{INK}" '
            f'font-family="Georgia, \'DejaVu Serif\', serif" font-size="{short * 0.05:.1f}">{NAME}</text>')
    return svg(width, height, f'<rect width="{width}" height="{height}" fill="{PAPER}"/>' + stand_group(width, height, size, centre) + name)


def write(path: Path, document: str, opaque: bool = False) -> None:
    """Draw an SVG document into a PNG file (without transparency when `opaque`)."""
    png = cairosvg.svg2png(bytestring=document.encode())
    image = Image.open(io.BytesIO(png))
    image = image.convert('RGB') if opaque else image.convert('RGBA')
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, optimize=True)


def main(studio: Path) -> None:
    """Write every icon and splash screen of the app under the studio folder."""
    res = studio / 'android/app/src/main/res'
    for density, factor in ANDROID_DENSITIES.items():
        launcher = round(48 * factor)
        write(res / f'mipmap-{density}/ic_launcher.png', icon(launcher, 'rounded', 0.62))
        write(res / f'mipmap-{density}/ic_launcher_round.png', icon(launcher, 'circle', 0.56))
        # The adaptive icon: 108 dp, of which the launcher may show only the middle 66 dp
        write(res / f'mipmap-{density}/ic_launcher_foreground.png', icon(round(108 * factor), 'none', 0.40))
    (res / 'values/ic_launcher_background.xml').write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
        f'    <color name="ic_launcher_background">{PAPER.upper()}</color>\n</resources>\n', encoding='utf-8')
    for path in sorted(res.glob('drawable*/splash.png')):
        width, height = Image.open(path).size
        write(path, splash(width, height), opaque=True)

    assets = studio / 'ios/App/App/Assets.xcassets'
    write(assets / 'AppIcon.appiconset/AppIcon-512@2x.png', icon(1024, 'square', 0.6), opaque=True)
    for path in sorted((assets / 'Splash.imageset').glob('*.png')):
        width, height = Image.open(path).size
        write(path, splash(width, height), opaque=True)

    public = studio / 'public'
    write(public / 'icon-192.png', icon(192, 'rounded', 0.62))
    write(public / 'icon-512.png', icon(512, 'rounded', 0.62))
    write(public / 'icon-maskable-512.png', icon(512, 'square', 0.5), opaque=True)  # the stand inside the 80% safe zone
    write(public / 'apple-touch-icon.png', icon(180, 'square', 0.6), opaque=True)


if __name__ == '__main__':
    main(Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent)
