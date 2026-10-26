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

Home refreshes HDMI cable and signal status every two seconds while focused, including
inside Settings. Auto visibility follows signal availability when reported by webOS,
falling back to cable state on older firmware. A connected dongle without a source shows
**No signal**; forced On/Off preferences still take precedence. Failed reads preserve the
last state and retry after ten seconds. Polls pause while Luma is hidden or unfocused.

The two-row Home moves favorites slightly upward, keeping inputs near the bottom.
With app captions enabled, it uses a more compact header to reserve the extra space.
Up to four HDMI ports share
one row below the favorites, including when app captions are enabled. Cable changes do
not move the favorite grid or change input card widths.

## Branches and updates

- `main` mirrors `ecklf/lg-luma`. Keep personal changes out of it.
- `personal/home-grid` contains this optional layout and its tests.
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
For a manually reviewed layout-only adjustment, CI also offers a manual `package_only` input
that builds the IPK without repeating checks or tests. Ordinary pushes and PRs keep full checks.

Fork synchronization does not update an installed TV app. Installing an official IPK
would replace the customized executable and remove this layout option; use a package
built from `personal/home-grid` instead. Preferences remain under the same app ID.
Package versions follow upstream and the checked commit identifies the custom build.

Personal layout, settings and input refresh changes do not modify Home takeover.
Future official Home/settings refactors can still require a manual merge. If the author
adds an equivalent option, remove the personal patch and return to official packages.
