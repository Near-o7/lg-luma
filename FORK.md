# Near-o7's Luma fork

This fork adds **Settings → General → Favorite rows → One row / Two rows**.
The default remains the official one-row layout, and existing favorites keep their order.
Two rows fill six cards from left to right, followed by the second row. Further favorites
continue horizontally in groups of twelve. Up/Down moves between rows; reordering works
with the same arrows. Inputs remain below the favorites and can be reached with Down.

**Settings → General → Wallpaper shading** controls Home's wallpaper treatment:
Off, 25%, 50%, 75%, or the original 100%. Existing preferences default to 100%.
Off shows the matching unshaded wallpaper crop; intermediate levels blend it with the
original shaded asset. Apps, Settings, and static launch splashes keep their existing
wallpapers; modal dimming retains its original opacity. The two-row favorites setting remains independent.

Root Home listens for EIM input notifications and immediately requests a fresh snapshot.
Auto visibility accepts an active source with a cable present before signal negotiation completes;
it still displays **No signal** until a real signal is reported. A powered empty dongle
stays hidden. Forced On/Off preferences retain their behavior. Legacy firmware falls back
to its existing signal/cable reports.

EIM does not notify every signal transition on the tested TV. As a fallback, Home reads
input status every two seconds and briefly uses a 250 ms interval for at most ten seconds
while an active source is waiting for signal. Failed reads retain previous data and retry
after ten seconds. A failed notification subscription retries after thirty seconds while
polling continues. All of this pauses while Home is hidden or unfocused; returning messages
from an old subscription are discarded. Jailed tiles retain polling when root events are
unavailable. Events invalidate the cache instead of applying potentially stale snapshots.

The two-row Home reserves space only while an input is visible. When the first input
appears, favorites move smoothly upward over 320 ms, then the complete HDMI row fades
in over 120 ms. When the last visible input disappears, favorites recover the space.
The connected endpoint retains the approved small bottom margin; up to four HDMI ports
share one row. App captions use a more compact header. Reduced motion makes the change
immediate. Pointer holds, app reordering and overlays pause the movement. Returning Home
starts settled, and adding another input does not move the favorite grid again.

The personal branch currently includes official **v2.16.0**, including its System → Text
rendering setting. The fork uses independent setting identifiers to preserve Favorite
rows and Wallpaper shading alongside it.

Screen changes use a short, interruptible fade and slide. Favorites and vertical lists
ease into position, while focus rings, card lighting and press feedback fade between
states. Wallpaper shading also transitions between Home and other screens. These effects
honor **Settings → General → Reduced motion**. Clicking during a scroll stops it at the
displayed position so the selected card stays under the pointer.

## Branches and updates

- `main` mirrors `ecklf/lg-luma`. Keep personal changes out of it.
- `personal/home-grid` contains this optional layout and its tests.
- Feature branches target `personal/home-grid` through reviewed pull requests; keep commits
  scoped to each change. Build previews from the PR before merging, and retain the official
  release on `main` for future synchronization.
- `origin` points to `Near-o7/lg-luma`; `upstream` points to `ecklf/lg-luma`.

To incorporate the latest stable official release:

```sh
git switch personal/home-grid
sh tools/sync-upstream.sh
```

For a fresh checkout, clone this fork and add the official remote first:

```sh
git clone https://github.com/Near-o7/lg-luma.git
cd lg-luma
git remote add upstream https://github.com/ecklf/lg-luma.git
git switch personal/home-grid
```

Pass a tag to select a specific release, for example `sh tools/sync-upstream.sh v2.8.5`.
The script requires a clean working tree, updates the fork's `main` without force, fetches
the official history and merges the release into the personal branch. If Git reports
conflicts, resolve them or use `git merge --abort`; it never discards personal changes.

Then run the checks in `development.md`, commit any conflict resolutions, and push:

```sh
git push origin personal/home-grid
```

Pushing the personal branch runs CI automatically. It checks formatting, lint, unit tests and rendered previews, then builds
the ARM IPK. Download the `luma-release` artifact from the successful run. A manual run
does not publish an official release. Test the package before installing it on the TV.
The upstream PR/comment and release-PR workflows are disabled on this fork; CI remains enabled.
CI follows the official parallel workflow: shared checks/assets, four independent smoke
suites, and ARM packaging. Manual runs validate the branch without publishing a release.

Fork synchronization does not update an installed TV app. Installing an official IPK
would replace the customized executable and remove this layout option; use a package
built from `personal/home-grid` instead. Preferences remain under the same app ID.
Package versions follow upstream and the checked commit identifies the custom build.

Personal layout, settings and input refresh changes do not modify Home takeover.
Future official Home/settings refactors can still require a manual merge. If the author
adds an equivalent option, remove the personal patch and return to official packages.

## Official synchronization: 2.16.0

The October 30 update includes custom wallpaper uploads, rotation and a global gradient
switch; Date/Greeting visibility and date formats; QR-managed webhook shortcuts; app
options and protected uninstall; reliable Home-button routing; shared preference ownership;
verified self-updates; larger text and fixed toolbars; and 13 UI languages.

The official maintainer closed #112 in favor of #117, then closed #117 for scope and
complexity. The released version has no resizable Home grid or optional second favorite
row. This fork therefore retains its two-row grid, adaptive HDMI spacing, early HDMI
source detection and interruptible UI motion.

Global Background → Gradient disables shading on all pages. General → Wallpaper shading
still controls Home strength when the global switch is enabled, including uploaded
wallpapers. Larger official app captions use a recalculated compact Home header so the
complete HDMI row retains its small bottom margin. Personal settings have named focus
targets, preserving the official Text rendering control.

The updater resolves published releases from `Near-o7/lg-luma`, including pre-releases,
and accepts only verified IPKs from that fork. It never installs an official binary over
the personal launcher. The manifest version must increase for an in-app update; builds
with the same internal version still require manual installation. Upstream integration
continues through reviewed feature branches targeting `personal/home-grid`.
