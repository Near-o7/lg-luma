# Near-o7's Luma fork

This fork adds **Settings → Interface → Favorite rows → One row / Two rows**.
The default remains the official one-row layout, and existing favorites keep their order.
Two rows fill six cards from left to right, followed by the second row. Further favorites
continue horizontally in groups of twelve. Up/Down moves between rows; reordering works
with the same arrows. Inputs remain below the favorites and can be reached with Down.

## Branches and updates

- `main` mirrors `ecklf/lg-luma`. Keep personal changes out of it.
- `personal/home-grid` contains this optional layout and its tests.
- `origin` points to `Near-o7/lg-luma`; `upstream` points to `ecklf/lg-luma`.

To incorporate the latest stable official release:

```sh
git switch personal/home-grid
sh tools/sync-upstream.sh
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

Fork synchronization does not update an installed TV app. Installing an official IPK
would replace the customized executable and remove this layout option; use a package
built from `personal/home-grid` instead. Preferences remain under the same app ID.
Package versions follow upstream and the checked commit identifies the custom build.

The layout is isolated from Home takeover and the TV service code to reduce conflicts.
Future official Home/settings refactors can still require a manual merge. If the author
adds an equivalent option, remove the personal patch and return to official packages.
