# Android and iOS apps

The phone apps are the web app of `studio/` inside a native shell made with
[Capacitor](https://capacitorjs.com) 8. Everything is the same app; only the
song catalog, MIDI input and the screen layout differ.

| | |
|---|---|
| Android project | `studio/android` (Android Studio) |
| iOS project | `studio/ios` (Xcode, Swift Package Manager, no CocoaPods) |
| App id and name | `com.eartraining.app`, "Ear Training" (`studio/capacitor.config.ts`) |
| Minimum system | Android 7.0 (API 24), iOS 15 |
| Status | Android built and run on phones; iOS never built ([testing status](#testing-status)) |

- [What differs from the desktop app](#what-differs-from-the-desktop-app)
- [Building](#building)
- [Common errors](#common-errors)
- [Testing status](#testing-status)

## What differs from the desktop app

### Songs come with the app

On desktop the song search asks the local server (`server.py`). The phone apps
have no server, so the catalog is bundled:

| File | Holds |
|---|---|
| `studio/public/catalog/index.bin` | every song with its versions, in the server's order, and the progressions each version contains |
| `studio/public/catalog/charts-<n>.bin` | the charts of 200 versions each, ready for the app |

Both are gzipped JSON (7 MB in all), written by `python build_mobile_catalog.py`
with the same Python code that answers the server's requests
(`score_search.search_score_groups`, `studio_bridge.score_chart`), so the
results are identical.

`studio/src/library/catalog.ts` answers the search, the progression filter,
random songs and chart loading from these files in the app, and from the server
on desktop. A web build set with `VITE_BUNDLED_CATALOG=1` uses the files too,
for example a static website without `server.py`.

### MIDI comes from a native plugin

Phone web views have no Web MIDI, so the app has its own `Midi` plugin
(`studio/src/audio/nativeMidi.ts`). `useMidiKeyboard` uses it in the app and
Web MIDI in the browser, so Chord Sightreading works the same everywhere.

| Platform | Plugin | Devices |
|---|---|---|
| Android | `android/app/src/main/java/com/eartraining/app/MidiPlugin.java` (`android.media.midi`, registered in `MainActivity`) | USB, Bluetooth and virtual devices; the manifest declares MIDI optional, so phones without it can install the app |
| iOS | `ios/App/App/MidiPlugin.swift` (CoreMIDI, registered by `MainViewController`, set in `Main.storyboard`) | every MIDI source, MIDI 1.0 note messages |

### The Android back button

The back button never quits the app by surprise
(`android/.../MainActivity.java` asks the page, `src/ui/backButton.ts` decides):

| Open now | One press of back |
|---|---|
| a menu, panel or dialog (Settings, Display, Practice, Mixer, ⋯, Share, Export, Import, the tune drawer, the chart editor, the Pattern Creator, loop picking) | closes the last one opened, without saving; press again for the one before |
| nothing, on a screen (player or an exercise) | goes back to the main menu |
| nothing, on the main menu | leaves the app |

Each menu registers itself while it is open (`useBackClose`), so a new menu
gets the same behaviour by calling it.

**In a phone's browser (the web demo)** the browser's own back button (or the
iPhone's swipe back) behaves the same way. The page detects a touch screen
outside the app (`(pointer: coarse)`), and each open menu then adds an entry to
the browser history: back closes the menu instead of leaving the page. A menu
closed with its own button takes its entry back, and a screen opened from a
link goes back to the main menu. On a computer the browser's back button is left
as it is.

### The screen adapts to the phone

The app draws under the status and navigation bars and pads itself by their
height (`--inset-*` in `index.css`; Capacitor gives the height as
`--safe-area-inset-*` on Android and `env(safe-area-inset-*)` on iOS), so
nothing hides behind the phone's own buttons.

| Screen | Size | Layout |
|---|---|---|
| Upright phone | below 820 px wide (or any screen below 600 px) | top-bar buttons in a ⋯ menu; song list in a drawer opened by *Songs*; **2 bars per row**; Settings panel from the bottom |
| Landscape phone | below 500 px high | the desktop layout, made compact: thinner top bar and play bar, short button labels, tune list in a drawer, smaller title and rows, **4 bars per row**; Settings panel at the right, beside the chart |
| Tablet, narrow window | up to 1100 px wide | the desktop layout; Settings panel at the bottom right |
| Desktop | wider | everything in view, no Settings panel |

On every screen except the desktop, the play bar keeps only play, the position
and a **Settings** button. The panel it opens holds style, pattern, key, tempo,
choruses, Practice and Mixer (`ui/TransportSettings.tsx`). The breakpoints live
in `ui/useNarrowScreen.ts`:

| Query | Screens |
|---|---|
| `NARROW_QUERY` | upright phones and narrow windows (menus, drawers) |
| `TWO_BAR_QUERY` | the same (two bars per row) |
| `LANDSCAPE_QUERY` | landscape phones (compact desktop layout) |
| `COMPACT_TRANSPORT_QUERY` | up to 1100 px wide, and landscape phones (Settings panel) |

Everything else (sound bank, exercises, saved tunes and settings, kept in the
web view's storage) runs unchanged.

## Building

### What you need

| | Android | iOS (not tested yet) |
|---|---|---|
| Computer | Windows, macOS or Linux | a Mac |
| Tools | [Android Studio](https://developer.android.com/studio) 2025.2.1 or newer, with its own JDK 21 and the Android SDK platform 36 | Xcode 26 or newer and its command line tools (`xcode-select --install`) |
| For both | Node.js 22 or newer, pnpm, Python 3.10 or newer (how to install them: [README](../README.md#android-build-it-yourself)) | |
| To install on a phone | USB debugging, or copy the APK and allow installing it | an Apple account (free for your own device, paid for the App Store) |

### Steps

From `studio/`:

```sh
pnpm install           # once, and after the dependencies change
pnpm run native        # phone catalog, web build, then copy into android/ and ios/ (cap sync)
pnpm run android       # open in Android Studio
pnpm run ios           # open in Xcode (on a Mac)
```

| Command | Does | Needs |
|---|---|---|
| `pnpm run native` | rebuilds `studio/public/catalog/` from the database, builds the app, copies it into both native projects | `data/progressions.sqlite` |
| `pnpm run sync` | builds the app and copies it, with the catalog already in `studio/public/catalog/` | nothing more (the catalog is in the repository) |

Run one of them again after any change to the app or the data, before building
in Android Studio or Xcode. The copies they make
(`android/app/src/main/assets/public`, `ios/App/App/public`) are generated and
not kept in the repository.

### Android APK

1. In Android Studio, wait for the **Gradle sync** to finish (bottom bar).
2. Choose **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
3. Click **locate** in the message that appears, or open
   `studio/android/app/build/outputs/apk/debug/app-debug.apk`.
4. Copy the APK to the phone and open it (allow installing apps from that
   source). Or connect the phone with USB debugging on and press **Run**.

For the Play Store, build a signed bundle with
**Build → Generate Signed Bundle / APK**.

From the command line instead:

```sh
cd android
./gradlew assembleDebug            # Windows PowerShell: .\gradlew.bat assembleDebug
```

Gradle needs `JAVA_HOME` set to a JDK 21 (or 17), such as Android Studio's own.
On Windows, for the current PowerShell window:

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"   # the default install folder
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
java -version                      # should say 21
```

### iOS app

1. `pnpm run ios` opens the project in Xcode.
2. Select the **App** target, and under **Signing & Capabilities** choose your
   team. Change the bundle id `com.eartraining.app` if Apple says it is taken.
3. Pick a device or a simulator and press **Run**.

The first build is also the first compile of `MidiPlugin.swift`, so expect to
fix small errors.

## Common errors

| Message | Cause | Fix |
|---|---|---|
| *pnpm.ps1 cannot be loaded, running scripts is disabled* | PowerShell blocks scripts by default | run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once, or type `pnpm.cmd` |
| *gradlew.bat is not recognized* | PowerShell does not run programs from the current folder by name | type `.\gradlew.bat`, from `studio\android` |
| *Dependency requires at least JVM runtime version 11* | Gradle found an old Java (often from an old Android Studio) | set `JAVA_HOME` to a JDK 21 as above, or uninstall the old Java |
| *JAVA_HOME is not set*, or points to a missing folder | no Java found | set `JAVA_HOME` as above, or build from Android Studio, which uses its own Java |
| *SDK location not found* | the Android SDK path is unknown | open the project once in Android Studio, which writes `android/local.properties` |
| the APK still shows the old app | the native project was not updated | run `pnpm run native` (or `sync`) before building |

## Testing status

| Platform | Built | Checked on a device |
|---|---|---|
| Android | yes | the app runs on phones, upright and in landscape |
| iOS | never | nothing yet |

The iOS project was generated on Linux, where Xcode is not available. Still to
check on real devices: a USB or Bluetooth MIDI keyboard in Chord Sightreading
(Android and iOS), and everything on iOS. Icons and splash screens are still
Capacitor's defaults.
