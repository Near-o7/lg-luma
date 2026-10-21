# Luma agent context

## Checks

Use pnpm, Oxlint, and Oxfmt. Node.js 22+ and pnpm 10 are required; `package.json` pins the pnpm version.
`nix develop` provides the pinned web/native toolchain. Use `nix develop --command <command>` for
one-off checks. `flake.lock` pins Nixpkgs and the Rust overlay; `nix fmt` formats `flake.nix`.

```sh
pnpm check
pnpm format:check
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:browser
```

`pnpm check` runs Oxlint and TypeScript. Run `pnpm lint:fix` to apply automatic lint fixes. Oxlint checks TypeScript, React, hooks, and accessibility rules; generated output is excluded. Formatting uses Oxfmt: `pnpm format` writes formatting changes and `pnpm format:check` verifies them.

Build before running browser tests so packaged `file://` tests exercise the current code. Browser checks cover remote navigation, hold-OK options, favorites, settings, input visibility modes, search, persistence, focus restoration, weather configuration, temperature units, caching, and TV-service failure behavior with a mock bridge. Weather APIs are mocked; tests do not connect to a TV. On Linux, install Chromium's dependencies with `pnpm exec playwright install --with-deps chromium`.

## Structure

`src/` contains React/TypeScript UI, spatial navigation, local preferences, and the webOS bridge. `public/` contains locally bundled assets. `tools/` builds a classic-script app and IPK. `tv/autostart.sh` is the optional boot hook.

Project filenames use lowercase kebab-case, including React components (for example, `app-tile.tsx`). Keep `package.json` and `appinfo.json` versions synchronized; change the version only when requested.

## Native prototype

`native/` is an experimental Rust/SDL2/GLES2 launcher with independent UI, platform and persistence
layers. See `native/README.md`. Run `pnpm native:check` for Rust changes and `pnpm native:smoke`
after generating native assets to exercise desktop OpenGL screenshots and interaction/persistence.
These commands need Rust, pkg-config and SDL2; asset generation also needs woff2_decompress and
Python/fontTools. Prefer `nix develop` to provide these, along with Node/pnpm and Rust 1.93 with
the ARMv7 soft-float target. The external webOS NDK is still required for TV cross-builds.
`pnpm native:compare` produces fixed-time web/native side-by-side screenshots under
`.build/native/comparison` (Playwright Chromium required); use it when matching the web design.
Native preferences and app ID
are separate from the web app. TV builds use the `webos` feature and must never fall back to demo
inventory. Keep platform work off the SDL thread and pointer focus free of scrolling side effects.
Native text uses drawable-aware grayscale glyphs; layout stays in 1920×1080 logical coordinates.
`--capture-scale 2` exercises a separate 4K framebuffer. `--resolution 4k` is an experimental
surface request; use `--diagnostics PATH` to distinguish actual drawable size from capture size.
Use `--profile-frames N` for presentation pacing; `--frames N` counts event-loop iterations.
Native and web UI strings share `src/messages.json`. Native language preferences are `en`, `de`,
and `zh`; CJK fallback fonts are generated from the bundled, licensed Noto Sans SC source.
Native weather uses ureq/rustls background workers and a separate Celsius cache. The native smoke
suite includes mocked weather HTTP, language persistence, localized geocoding, and CJK/4K renders.
No test should contact real weather APIs or a TV. Match the web UI without on-screen weather credits.

## Collecting app icons from a webOS TV

The optional installed-app artwork prototype can collect icons from a developer's own rooted TV over SSH. Set `TV_IP` to the TV's address and run these commands from the repository root:

```sh
ssh root@TV_IP node < tools/collect-tv-icons.js
ssh root@TV_IP 'tar -cf - -C /tmp/luma-artwork .' > icons.tar
mkdir -p public/app-icons
tar -xf icons.tar -C public/app-icons
mv public/app-icons/app-icons.json src/app-icons.json
node tools/icon-colours.mjs
pnpm build
```

The collector checks `/media/developer/apps/usr/palm/applications`, `/media/cryptofs/apps/usr/palm/applications`, and `/usr/palm/applications`, preferring each app's `largeIcon`, then `icon`, then `icon.png`. It copies image files into `/tmp/luma-artwork` on the TV and writes an app-ID-to-image map. After copying that output into `public/app-icons/`, the map points to the bundled paths and `tools/icon-colours.mjs` generates matching tile background colors in `src/icon-colours.css`. Only icons found in those locations are collected; no icon set is supplied by the repository, so `src/app-icons.json` can be empty until collection is run. The collector requires SSH/root access to the developer's own TV.

## Performance

Keep focus feedback immediate. Spatial navigation caches control geometry and invalidates it on DOM/layout changes, scrolling, resizing, and font loads; fully visible targets do not call `scrollIntoView`. New focusable controls must use `data-focusable` and explicit routes where appropriate.

`data-focus-scroll-top="true"` normalizes the Apps toolbar's scroll position only during remote navigation. Do not scroll the toolbar from a generic focus handler: pointer-down focuses a button before pointer-up, so moving it at that point can swallow the click.

Clock components update at minute boundaries and pause while hidden, independently of the launcher and app sorting. Library filtering/sorting is memoized and only runs on the Apps page. Concurrent inventory refreshes are deduplicated. Use small CSS opacity animations instead of a JavaScript animation runtime, and avoid live backdrop blur or full-screen filter textures in foreground controls. Reduced-motion preferences apply through CSS.

The top navigation uses one persistent selection pill. CSS transitions animate its transform and width; JavaScript measures the selected tab only on selection changes and resize/font-size changes. Initial positioning and resizing are immediate. Both the saved and system reduced-motion preferences disable the pill transition.

Settings uses bundled 480×270 photo thumbnails rather than decoding the full wallpapers for every gallery card. `pnpm assets` regenerates thumbnails. Run `pnpm benchmark` after installing Playwright Chromium to measure a 120-app library with 6× desktop CPU throttling; compare bundle size, keyboard-handler timings, geometry reads, and scroll calls. These measurements are a desktop proxy, not TV frame-rate claims.

Gallery previews use clipped image elements with an inset border, avoiding repeated background-image strips at fractional-sized edges. Neutral interface text, surfaces, icons, and focus rings use gray rather than cream/gold tints. App-action rows have contained focus rings and synchronize pointer hover with keyboard focus; closing the menu restores the selected app, or its nearest surviving neighbor after hiding, after the React commit.

## CI and releases

`.github/workflows/ci.yml` checks pull requests and pushes to `main` on Ubuntu with Node.js 24. It checks formatting, runs unit tests, builds and verifies the IPK, and runs Chromium browser tests. Successful builds upload the release files as a workflow artifact. Successful `main` builds publish new versions using `GITHUB_TOKEN`, automatically creating the version tag at the tested commit. Published versions are skipped; a draft can be resumed when its tag matches that commit. An existing tag pointing elsewhere stops publication. `workflow_dispatch` on `main` provides a manual retry without a tag input. Main runs are serialized so new pushes do not interrupt publication; outdated PR runs can be cancelled.

`tools/repository.mjs` runs after packaging. It creates `dist/repo.json` in Homebrew Channel's paginated package format and copies the native large icon into `dist/`. The feed uses version-specific release URLs and the SHA-256 and size of the normalized IPK. It rejects mismatched package/app versions and release tags, and exposes its validated version tag through `GITHUB_OUTPUT` for the release job. The install URL is `https://github.com/ecklf/lg-luma/releases/latest/download/repo.json`; it requires public repository/release access and an initial published release. Publishing the feed as a release asset avoids bot commits to the default branch.

## Remote and pointer controls

| Input                  | Action                                                     |
| ---------------------- | ---------------------------------------------------------- |
| Arrow keys             | Spatial navigation between tiles and controls              |
| OK / Enter             | Open the focused app, input, or control                    |
| Hold OK                | Home favorite: move mode; library app: options             |
| Menu / right-click / M | Options for the focused app                                |
| Back / Escape          | Close the current panel; return from Apps/Settings to Home |
| Back on Home           | webOS's normal platform Back behavior                      |
| Magic Remote pointer   | Point, click, or hold a tile for options                   |

From the top navigation, Down enters Home at the first visible favorite, Apps at the first matching app, and Settings at General. Empty Home enters its primary action; Apps with no matching results enters the first category. In Background settings, Left/Right step through backgrounds in gallery order; Left from the first column returns to the section list, and OK applies the focused background. Up/Down follow the gallery columns, and Back returns focus to the Background category.

Repeated Up returns to the active top navigation tab before other header controls. Settings subpages use Left or Back to return to the parent setting and restore its focus, without a visible Back button. Up from the first option goes to the Settings tab. The app search and city/postcode fields let Up/Left move focus out of the field; Left from app search enters Hidden when available, otherwise Utilities, and Left from the location query returns to its parent setting. Up from the first app enters the first category.

Back from a Settings sidebar category focuses the Settings navigation tab while keeping Settings open. Back again from that tab returns Home.

Back from the Apps search field or its clear button clears the query and focuses the Apps tab while keeping the library open. Back again from that tab returns Home.

On Home, hold OK on a favorite to enter move mode, press Left/Right to change its position, then press Back to finish. The new order is saved immediately and the selected app stays focused. Apps → select an app → hold OK to add/remove favorites or hide apps. The action menu shows the app name and category, and closes after either action. Favorites have a filled-heart badge and sort first in the saved Home order; other apps sort alphabetically. Hidden apps remain installed and can be restored from the **Hidden (count)** category pill, which shows only hidden apps. Choose a category beside search to filter the library; select it again or use the × button to clear the filter. Long app names wrap instead of being truncated.

Home shows Favorites and Inputs without a recent-app section or permanent control hints. App names beneath Home cards are hidden by default; enable **Settings → General → Show app names** to display them. The Apps library always shows names. The header clock is at the top left.

The top navigation contains **Home**, **Apps**, and a full-page **Settings** view. Settings has sidebar sections for **General**, **Background**, **Weather**, and **Inputs**. The sliders icon at the top right opens **TV settings** directly. General controls Home app names, 12/24-hour time, reduced motion, and refresh. Back returns to Home, and the version number appears at the bottom right of Settings.

Inputs are launched from Home and configured in **Settings → Inputs**. Every detected physical input has a submenu with **On** (always show), **Off** (never show), and **Auto** (show only when the TV reports it connected). Auto is the default; an unknown connection state is not treated as connected. All detected inputs remain in Settings, including hidden and disconnected ones. Choices are saved by the input's stable app ID, so renaming a device keeps its mode. Home shows every eligible input without a three-card limit. **Refresh inputs** updates the inventory and connection states; partial read failures retain the last valid inputs and saved choices.

The nine bundled backgrounds are Slate, Midnight, Prism (saturated red, yellow, and purple), Monument Valley, San Francisco, Summit, Forest, Yosemite, and Northern lights. From the Settings tab, Down enters General; use the sidebar to reach Background, Weather, or Inputs, then Right to enter that section.

Apple TV, Prime Video, Disney+, Jellyfin, Netflix, YouTube, ARTE, ZDF, and Das Erste use bundled SVG logos. Input cards choose connection artwork from the reported device name: PlayStation and Apple TV use their supplied marks, USB uses the USB symbol, unnamed HDMI ports use an HDMI connector, and other devices use a suitable generic icon. Icon selection does not change the input's launch target.

## Weather

Open **Settings → Weather**, enter a city or postcode, press Search, and select the matching place. **Show widget** controls visibility on Home; turning it off keeps your saved city. Choose **°C** or **°F** under **Temperature** to save your preferred unit. Switching units converts the cached reading immediately without another weather request. When enabled, the widget shows the chosen city, temperature, and current conditions. Nothing uses browser geolocation or automatic IP-based location lookup.

Back while editing the city/postcode field leaves the field and keeps Settings open. Press Back again from a button to return Home.

Weather refreshes every 15 minutes while Home is visible. Recent readings are cached locally and reused after reopening the app. If the connection fails, an available cached reading is labeled as saved; otherwise the widget says weather is unavailable. Remove the weather location in Settings to turn it off. API and cached temperatures stay in Celsius; `formatTemperature` converts the unrounded value for display.

Location search calls `geocoding-api.open-meteo.com`, and weather calls `api.open-meteo.com`. Those are the only network origins allowed by the packaged app's Content Security Policy. No API key or account is required. Data attribution: [Open-Meteo](https://open-meteo.com/) / [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
