"""Bundle the corresponding source for the modified OpenStand Studio."""

from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo


ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / "studio" / "dist" / "source.zip"
SOURCE_DIRECTORIES = ("docs", "studio/src", "studio/public",
                      "studio/tests", "studio/scripts", "studio/android", "studio/ios")
# Generated data and native build output inside the source folders
EXCLUDED = ("studio/public/catalog/", "studio/public/leadsheets/", "studio/android/app/build/", "studio/android/.gradle/",
            "studio/android/build/", "studio/ios/App/build/", "studio/ios/DerivedData/",
            # copies of the built web app that cap sync puts into the native projects
            "studio/android/app/src/main/assets/public/", "studio/ios/App/App/public/")
SOURCE_FILES = ("README.md", "AGENTS.md", "LICENSE", "PATTERN_AUDIT.md", ".gitignore",
                "data/CHOCO_LICENSE.md", "data/LICENSE.md", "data/sources.json",
                "data/left_hand_patterns.json",
                "studio/LICENSE", "studio/README.md",
                "studio/package.json", "studio/pnpm-lock.yaml",
                "studio/vite.config.ts", "studio/index.html",
                "studio/pnpm-workspace.yaml", "studio/capacitor.config.ts")


def source_paths():
    """Select editable project files without generated builds or datasets."""
    selected = {ROOT / name for name in SOURCE_FILES if (ROOT / name).is_file()}
    selected.update(ROOT.glob("*.py"))
    selected.update(ROOT.glob("tests/*.py"))
    selected.update(ROOT.glob("*.bat"))
    selected.update(ROOT.glob("studio/tsconfig*.json"))
    for name in SOURCE_DIRECTORIES:
        selected.update(path for path in (ROOT / name).rglob("*") if path.is_file())
    selected = {path for path in selected
                if not path.relative_to(ROOT).as_posix().startswith(EXCLUDED)}
    return sorted(selected, key=lambda path: path.relative_to(ROOT).as_posix())


def main():
    """Write a deterministic source archive served by the local Studio."""
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(OUTPUT, "w", ZIP_DEFLATED, compresslevel=6) as archive:
        for path in source_paths():
            name = path.relative_to(ROOT).as_posix()
            info = ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
            info.compress_type = ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            archive.writestr(info, path.read_bytes())
    print(f"Studio source archive: {OUTPUT}")


if __name__ == "__main__":
    main()
