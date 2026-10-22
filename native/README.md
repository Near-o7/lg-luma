# Luma Native

An experimental Rust launcher using SDL2 for windowing/input and a custom OpenGL ES 2 painter.
Screens, layout, focus, animations, preferences and platform coordination are Rust. There is no
browser, LVGL or Qt runtime. This uses the same architectural approach as PlxNative, with an
independent MIT implementation; no PlxNative source is included.

## Desktop preview

From the repository root, enter the pinned development shell and install the project dependencies:

```sh
nix develop
pnpm install --frozen-lockfile
pnpm native:assets
pnpm native:dev
```

The flake supplies Rust 1.93, Cargo, rustfmt, Clippy, Node.js, the pinned pnpm version, SDL2,
pkg-config, CMake, woff2 and Python/fontTools. Without Nix, provide those tools manually
(Rust 1.88+ is supported). The shell also includes the ARMv7 soft-float Rust standard library for
TV cross-builds; the webOS native SDK is configured separately.

To run the preview directly from your current shell:

```sh
nix develop --command sh -c 'pnpm native:assets && pnpm native:dev'
```

The preview opens a resizable 1280×720 window, letterboxing the same 1920×1080 layout used on TV.
HiDPI framebuffer scaling and pointer coordinates are handled independently. Text uses vector
glyph geometry with drawable-aware grayscale coverage antialiasing and pixel-aligned glyph
origins/baselines; text layout and kerning stay in 1920×1080 logical coordinates. `--fullscreen`
opens a fullscreen preview. Rust changes use incremental compilation and a relaunch.

Assets are prepared under `.build/native/assets` from the existing wallpapers, SVG logos, collected
app artwork and Inter font. The font is decompressed to TTF, and bundled SVG icons/logos are
compiled into vector triangle meshes at build time. The variable font is instantiated at the web
UI's weights and optical sizes. A bundled
Noto Sans SC source produces regular/medium Luma CJK fallback subsets for Chinese labels and
common CJK app/location names. No system font is required. `pnpm native:font-assets` can restore
the checksum-pinned source font if deliberately removed. Wallpaper
cropping, saturation, shading and tile gradients are prepared ahead of time from the web design,
and UI/input icons reuse the web components at build time. No asset downloads occur.
Regenerate assets after changing their sources.

### Vector icons and logos

Bundled SVG logos, Lucide controls and input marks use `.lvec` geometry, not PNG textures.
`native/tools/vector-assets/` is a host-only Rust compiler using usvg, tiny-skia-path's stroke
outlines and lyon tessellation. It resolves transforms, fill rules/holes, round strokes and the
bundled linear/radial gradients. Antialiasing geometry is attached only to actual path boundaries;
its fringe stays one physical pixel wide as the drawable density changes. Gradient colors are
adaptively sampled into vertex colors at build time. Original SVGs remain the editable sources.

The TV lazily loads each mesh into a static GPU vertex buffer once. A GLES2 shader applies
placement, scale, tint and edge coverage; it uses no icon texture, SVG parser or icon image
decoder. The SVG compiler is not linked into the TV executable. Its polygon tessellator is shared
with on-demand font outlines. Icon/logo geometry is generated for the bundled TV artwork sizes, including
high-density rendering, rather than retessellated every frame.

`pnpm native:assets` includes this step. To rebuild just the vector artwork:

```sh
nix develop --command pnpm native:vector-assets
```

The packager requires `assets/vector-artwork.json` and valid meshes, and excludes stale generated
icon/logo PNGs. Collected app artwork stays PNG/JPEG, wallpapers and prepared tile backgrounds
remain raster images, and the webOS installation icon remains PNG. These assets do not have SVG
icon/logo rendering work on the TV. Diagnostics report cached vector meshes, GPU bytes and the
number of vector triangles submitted in the frame.

### Vector text

The renderer opens the common Inter 400 face initially, then opens other weights/optical sizes
only when text uses them. CJK fallback faces are opened only when Inter lacks a character in the
text being drawn. Owned TTF faces provide the original advances, kerning and line metrics without
preparing all the font's glyphs. Only requested glyph outlines are converted into geometry.
There are no glyph bitmap atlases or raster-size-dependent font textures.

Individual outlines are cached in font-em coordinates. Complete text runs are combined into
static GPU buffers and cached independently of position, color and drawable density, avoiding
one draw call per letter. The text shader snaps each insertion origin/baseline to physical pixels
and uses hardware multisample coverage of the original glyph outline when available. The window
requests 4× MSAA, then retries with 2× or no MSAA if EGL cannot create that configuration. Text
on multisampled targets omits inset/fringe triangles: moving a thin glyph's opposite edges inward
can invert its fill triangles and produce small-text artifacts. Single-sample targets use a
narrower half-physical-pixel boundary fringe. Icons retain their existing boundary AA. Runs are
cached separately for the multisample and single-sample paths. Outline flattening uses
subpixel precision for the current typography through 256 physical pixels/em. This preserves
the font files and logical layout; it does not add font hinting or complex-script shaping.

Glyph geometry has an 8 MiB/4096-entry CPU cache target and text runs a 32 MiB/512-entry GPU cache
target. Old entries are evicted while the current frame's working set is preserved. A larger
single-frame working set can temporarily exceed those targets. CJK is not exported into a huge
prebaked mesh package or fully tessellated when opening its font. Diagnostics include glyph
tessellations, cached text runs, geometry bytes, triangles, missing/failed glyphs and the actual
`multisample_samples` of the active target. An offscreen capture can be single-sample even when
the TV window uses MSAA; its diagnostics describe its own rendering path.

### HiDPI and 4K

Text density is automatic: the same vector run for a 20px logical label occupies 40 physical
pixels/em on a 2× drawable. Glyph-origin snapping and edge coverage use each drawable axis's
actual fitted density, including letterboxed and fractionally sized windows. Resizing does not
reuse undersized glyph bitmaps because text has no bitmap atlas. There is no RGB subpixel AA;
hardware MSAA is preferred with a single-sample fallback.

Generate optional 3840×2160 wallpaper variants for higher-density surfaces:

```sh
pnpm native:assets --4k
```

TV packaging defaults to 1080p artwork even if older `@2x` files remain in the asset cache. To
include the optional high-resolution wallpapers in the IPK, also run:

```sh
pnpm native:package --4k
```

The renderer selects these at densities above 1× when the GPU supports their texture size, and
otherwise uses the 1080p assets. SVG backgrounds are rasterized at the higher resolution;
photographic detail remains limited by the bundled source photographs. Regenerate and restart
the preview after changing assets. Logos and UI icons use vector geometry at either density.

A 4K offscreen capture works independently of the desktop window's size:

```sh
pnpm native:dev --script 'home,down' --frames 90 \
  --capture-scale 2 --screenshot .build/native/home-4k.png \
  --diagnostics .build/native/render.json
```

`--capture-scale 1` is the default 1920×1080 comparison surface; `2` renders at 3840×2160 with
vector glyphs evaluated at that drawable density. It does not enlarge a 1080p screenshot or force the TV's output.

To request a larger actual window/surface and collect presentation timings:

```sh
pnpm native:dev --resolution 4k --profile-frames 180 \
  --diagnostics .build/native/4k-profile.json
```

`--resolution` accepts `1080p`, `4k`, or `WIDTHxHEIGHT`. An explicit TV request uses a borderless
window, rather than SDL's desktop-fullscreen flag that overrides requested dimensions. This is
experimental on webOS: the compositor can constrain or rescale the surface. Package metadata
still defaults to 1080p. Inspect `drawable`, `drawable_is_4k`, and `last_presented` in the JSON;
`capture` describes the separate offscreen target. A 4K drawable alone does not prove 1:1 panel
presentation. TV compositor behavior and hardware performance need on-device validation.

Profiling forces redraws and measures swap-to-swap pacing after ten warmup presentations. Hidden
window pauses and the final screenshot stall are excluded. `cpu_submission` includes CPU work and
driver waits, not a GPU timestamp. The ordinary `--frames` option counts event-loop iterations and
must not be interpreted as a frame-rate measurement. The report also includes GPU/texture limits,
font density, glyph failures, geometry/image byte estimates and draw calls. Larger framebuffers have
four times the pixel area at 2× density; compare the requested modes on the TV before choosing a
default.

### Controls

| Input                        | Action                                          |
| ---------------------------- | ----------------------------------------------- |
| Arrows                       | Move focus; scroll to keep remote focus visible |
| Enter / OK                   | Activate on release                             |
| Hold Enter / OK for 600 ms   | Move a Home favorite; app options in Apps       |
| M / Menu / right-click       | App options                                     |
| Escape / Back / Backspace    | Dismiss panel, navigate back, or exit from Home |
| Mouse / Magic Remote pointer | Hover, click, hold; wheel to scroll             |
| F5                           | Refresh inventory                               |

Left/Right switches focused top tabs immediately; clicking or OK also selects a tab. Home has
all favorites in one horizontally scrolling row, with eligible physical inputs beneath it.
Left/Right advances through the saved favorite order and reveals the entire selected card;
the strip keeps its position when visiting another page. Down from Home navigation enters the
first fully visible favorite, Up from any favorite returns to Home navigation, and Down enters
the nearest input in the first input row. Hold-OK reordering also reveals the selected card.
The wheel scrolls horizontally when over favorites; elsewhere it scrolls the page vertically.
Pointer hover/down never scrolls the strip. Adding favorites never creates a second app row.
Apps supports
categories, Hidden, favorite-first ordering, wrapped names, and search with the TV's system
keyboard or a physical keyboard. The desktop preview has a remote-operable keyboard panel.
TV text fields retain focus while SDL/webOS owns text entry; Done/Back dismisses editing and
restores the field's next control. Options add/remove favorites or hide/restore apps.
Move mode saves on each Left/Right step. Press OK again or Back to finish, keeping the moved
favorite focused without launching it. General settings control app names, clock format and
reduced motion. Clock format and each input open nested choice pages with checkmarks; Left/Back
returns to the parent row. Background has all nine wallpapers and enters at the currently applied
background. Input choices are On, Off and Auto, with the same descriptions as the web app.
The native webOS Back key uses SDL's webOS-specific keycode and follows the same parent return
routes as Left: Location → Weather's Location row, HDMI choices → that HDMI row, and Background
gallery → Background in the sidebar. Open setting subpages restore their parent even if focus
has moved to the top navigation. Back from the Settings sidebar focuses the Settings tab; Back
again from that tab returns Home. Backspace deletes while editing text and acts as Back elsewhere
in the desktop preview.
General ends with **Quit app**, beneath **Refresh apps & inputs**, using a vector power icon.
OK or a pointer click closes Luma through the normal native shutdown path.
Hidden appears only when needed, and search/category filters have separate clear controls.
Scrolling Apps content fades into the existing wallpaper near the header and footer instead
of exposing a hard clipping edge. The same alpha mask applies to card surfaces, rings, shadows,
vector logos and text; the header and wallpaper are unmasked. Remote focus keeps selected Apps
cards below the top fade region. No blur texture or additional wallpaper decode is used.
Apps Up/Down follows the six-column grid order, including offscreen rows. Up reaches the category
toolbar only from the first row; scrolling cannot cause a mid-grid jump into the fixed header.

Desktop preferences live in `$XDG_CONFIG_HOME/luma-native/preferences.json`, or
`~/.config/luma-native/preferences.json`. `--preferences PATH` isolates a test run. Native preferences
are separate from the web app's local storage. Invalid preference files produce an error instead of
being silently replaced. Writes use a temporary file and atomic rename; run one instance per file.

## Checks and screenshots

```sh
nix develop --command sh -c 'pnpm native:check && pnpm native:smoke'
```

`native:check` runs rustfmt, Clippy (including the webOS feature) and behavior tests.
`native:smoke` needs a desktop display: it opens SDL windows, exercises navigation and persistence,
and reads actual OpenGL framebuffers into `.build/native/*.png`. Captures use an offscreen
1920×1080 framebuffer (or a separate 3840×2160 density check), independent of the desktop window's
HiDPI scale. It also checks alpha compositing, nested settings, real SDL pointer events,
drawable-aware vector text and forced presentation profiling. On Linux it can run under Xvfb
with Mesa software rendering. It does not measure TV performance.
The separate Native prototype GitHub workflow runs these checks on Linux and uploads its screenshots.

`pnpm native:weather:smoke` runs just the mocked HTTP/weather scenarios.
`pnpm native:translations:smoke` checks language selection/persistence, rendered labels, CJK glyph
coverage, localized geocoding, and Chinese 4K captures. Both are included in `native:smoke`.

For a specific screen:

```sh
pnpm native:dev --preferences .build/native/demo.json \
  --script 'apps,down,right,menu' --frames 90 \
  --screenshot .build/native/options.png --dump-state .build/native/state.json
```

Scripts support `home`, `apps`, `settings`, `up`, `down`, `left`, `right`, `enter`, `back`, `menu`,
`hold`, `type:TEXT`, `await-search`, `await-weather`, and `wait`. `type:` edits the app search or
location field according to the current panel. Screenshots are taken before the final buffer swap.
The state dump provides machine-readable focus, filtering, preferences and rendered UI text. The scripts drive the same state
transitions as the interactive UI.

`--time 2026-10-21T20:41:00+02:00` fixes the clock/date for reproducible previews. Scripted
`click:X:Y` uses authored 1920×1080 coordinates and injects actual SDL button-down/up events.
Bounded scripted runs ignore physical pointer/keyboard events so window-entry hover cannot change
the scene during a slow first upload. Unbounded scripts return to normal input after their actions.

### Manual scroll preview with additional apps

`--test-extra-apps N` explicitly appends up to 300 labeled placeholder cards to a successful
inventory read, reusing real apps as artwork/category templates. It never replaces a failed TV
inventory with demo data. Normal launches show the real inventory only. Placeholder cards cannot
send launch requests to the TV; OK displays a short preview notice instead.

The preview defaults to a separate `scroll-preview-preferences.json` beside normal preferences,
initialized from your current choices on its first run. Favoriting/hiding/reordering test cards
there does not modify normal favorites. Use `--preferences PATH` to choose another preview file.
Each successful inventory refresh appends the same requested cards again without duplication.

After installing the updated IPK and closing any running Luma instance, run in root SSH:

```sh
APP=/media/developer/apps/usr/palm/applications/com.luma.launcher.native
XDG_RUNTIME_DIR=/tmp/xdg /usr/bin/jailer \
  -t native_devmode -i com.luma.launcher.native -p "$APP" \
  "$APP/luma-native" \
  '{"@system_native_app":true,"nid":"com.luma.launcher.native"}' \
  --test-extra-apps 120
```

Open Apps and scroll through the added `Scroll test` cards. To try more than six Home favorites,
pin test cards while in this preview. Stop it with Ctrl+C, then launch Luma normally to return
to the regular inventory/preferences. For the desktop preview, use
`pnpm native:dev --test-extra-apps 120`.

### Compare with the web interface

```sh
pnpm exec playwright install chromium
pnpm native:compare
```

Run these inside `nix develop`. Linux already has matching Playwright browsers in the shell;
the browser-install command is needed on macOS. For headless native rendering on Linux, run
`xvfb-run -a pnpm native:smoke`.

The comparison command builds the web app and captures both renderers with the same inventory,
preferences, time and canvas size. It covers Home (with/without captions, weather and empty),
Apps, options, Music, Hidden, search/empty results, General, clock choices, Background, Weather,
Inputs and input choices.

`.build/native/comparison/*-side-by-side.png` shows **web on the left, native on the right**.
Web layout/font measurements and an informational image-difference report are stored alongside
the images. Font antialiasing and shadow rasterization differ across renderers, so the report is
not a pixel-perfect pass/fail gate. During iteration, `node native/tools/compare.mjs --native-only`
reuses existing web references.

## Build for webOS

Use the [unofficial webOS native toolchain](https://github.com/webosbrew/native-toolchain), extracted
and relocated according to its instructions. The target is ARMv7 **soft-float ABI**
(`armv7-unknown-linux-gnueabi`), not `gnueabihf` or an ordinary desktop Linux target.
The `nix develop` shell includes that Rust target. With another Rust toolchain, install the target
before building.

On Apple Silicon macOS, the following SDK release has been cross-linked successfully. From the
repository root, enter `nix develop`, run `pnpm install --frozen-lockfile`, then set up the SDK once:

```sh
mkdir -p .build/native/toolchain
curl --fail --location \
  --output .build/native/toolchain/webos-sdk-darwin-arm64.tar.bz2 \
  https://github.com/webosbrew/native-toolchain/releases/download/webos-d7ed7ee.6/arm-webos-linux-gnueabi_sdk-buildroot_darwin-arm64.tar.bz2
tar -xjf .build/native/toolchain/webos-sdk-darwin-arm64.tar.bz2 -C .build/native/toolchain
export WEBOS_NDK="$PWD/.build/native/toolchain/arm-webos-linux-gnueabi_sdk-buildroot"
sh "$WEBOS_NDK/relocate-sdk.sh"
```

Keep the SDK path free of spaces. Other hosts should use the matching download from upstream.
For each new shell, set `WEBOS_NDK` again. Build and package with:

```sh
pnpm native:assets
pnpm native:build
pnpm native:package
```

The build uses the NDK compiler and explicit sysroot, but **not its SDL runtime**: the macOS SDK's
SDL2 2.24.1 has Wayland disabled and exits with `wayland not available`. The build/package tools
instead prepare [SDL-webOS](https://github.com/webosbrew/SDL-webOS), pinned to
`release-2.30.12-webos.5`, with SHA-256 verification of both its archive and shared library. The
standard-SDL-ABI artifact is required for rust-sdl2; the separate `webos-abi` artifact is not used.
It includes Wayland and LG's webOS shell integration. `pnpm native:runtime` prepares it separately;
the first run downloads about 1.8 MB, then reuses the verified cache in `.build/native/sdl-webos`.
No downloads happen on the TV. The SDK remains separate and is still needed for compilation.

Isolated pkg-config metadata links against that runtime without picking up desktop Nix SDL.
Do not use rust-sdl2's generic `bundled` feature for this target: an ordinary desktop Wayland
build does not supply the TV's shell integration. TV builds also provide `getauxval` compatibility
for the SDK's older libc by reading `/proc/self/auxv`; Rust startup and TLS CPU detection receive
real kernel values.

ARM code generation uses the NDK's Cortex-A9/VFP baseline, with NEON disabled for Rust code.
It retains the soft-float **calling convention**, while allowing hardware floating-point
instructions; the Rust target's default software floating-point codegen is unsuitable for the
font-outline/layout workload. This is still `gnueabi`, never the incompatible `gnueabihf` ABI.
The pinned Rust toolchain currently emits unstable-feature warnings for these target switches.

Packaging bundles the verified SDL-webOS `libSDL2-2.0.so.0` and its license automatically. To override
SDL or include other selected ARM webOS shared libraries, set `WEBOS_NATIVE_LIBS` to their directory
before packaging. Include SDL under its runtime name, `libSDL2-2.0.so.0`. The packager rejects SDL
libraries without the compiled webOS/Wayland backend, including the SDK's dummy-video build.
The executable searches `$ORIGIN/lib`; avoid copying the entire SDK library directory or replacing
the TV's libc/graphics drivers.

The package is created under `.build/native/dist` as **Luma Native**,
`com.luma.launcher.native`, with the version taken from the root `appinfo.json`.
The packager validates that the executable and bundled libraries are little-endian ARM soft-float
ELFs. For version 1.1.1, the result is `.build/native/dist/com.luma.launcher.native_1.1.1_arm.ipk`.
Install it through webOS Dev Manager connected to the TV on port 22 as `root`, then open
**Luma Native**. It has a separate app ID and preferences from the web launcher.

### Compatibility references

The [webOS Homebrew Can I Use matrix](https://www.webosbrew.org/develop/caniuse) lists firmware
library versions, including system SDL2. Its [library-version guide](https://www.webosbrew.org/develop/guides/library-version)
maps internal versions to the marketing names: 7/22, 8/23, 9/24, 10/25 and 11/26.
Luma bundles SDL-webOS 2.30.12 rather than using the TV's system SDL2.

Upstream SDL-webOS [`release-2.30.12-webos.6`](https://github.com/webosbrew/SDL-webOS/releases/tag/release-2.30.12-webos.6)
reports hotplug verification in app jails on webOS 3.4, 4 and 10 (25). That is useful evidence for
the SDL2 port, but it is a newer prerelease than Luma's pinned `.5` runtime and verifies that
subsystem, not Luma's complete UI, LS2 permissions or Homebrew inventory access. Luma's native
startup/rendering and app/input inventory have been verified on a rooted webOS 26 TV; a lower
supported version is not yet established.

### TV services

Only builds compiled with `--features webos` use TV services; a desktop build refuses to run on a
TV. Inventory never falls back to demo data in a TV build. One worker handles blocking platform
requests, leaving input and rendering on the SDL thread. Refreshes and launches are deduplicated.

The adapter registers a native LS2 connection from the installed executable and sends requests
with `LSCallOneReply`. It does not use `luna-send-pub -a`: that invokes `LSCallFromApplication`,
which requires a separate impersonation privilege and was rejected on webOS 26 even from a root
SSH shell. Connections use anonymous service names to avoid colliding with SDL's registration;
the hub still authenticates the native executable and applies its installed role/permissions.
Each request uses a private GLib context on the platform worker, a 6.5-second response budget,
and a 2 MiB reply limit. Cancellation and unregistration preserve callback storage until it can
no longer be used. Errors include the service URI and the bus's actual refusal.

App launches use the application manager. Fixed inventory commands still go through Homebrew
Channel's elevated `exec`, following the web launcher's permission model. Input-read failures
retain the last good inputs. Inventory uses the web launcher's `luna-send -n 1` invocation and
parses complete JSON objects, including formatted multi-line output and trailing CLI timing text.
CLI failures report bounded stdout/stderr excerpts rather than just "unreadable inventory".
The manifest
declares `application.launcher`, `application.query` and `lunabus.query`; Homebrew Channel must
provide that permission mapping for the native app ID too.

TV preferences are saved beside the installed executable. Before starting workers or initializing
video, startup sets `APPID` and the SDL Wayland class to the native app ID and requests Back-key
delivery. Hidden/minimized windows pause drawing, and focus restoration refreshes inventory.
Back on Home exits the native app and returns control to the platform.
webOS supplies native launch metadata as a JSON object in `argv[1]`. TV builds skip that object
when parsing Luma's own options, leaving the process arguments available to SDL/libhelpers.

### Startup troubleshooting

For the app's actual native developer-mode sandbox, stop any existing instance and run this
in the TV's root SSH shell. This follows the [webOS Homebrew native-development guide](https://www.webosbrew.org/pages/native-development.html):

```sh
APP=/media/developer/apps/usr/palm/applications/com.luma.launcher.native
XDG_RUNTIME_DIR=/tmp/xdg RUST_BACKTRACE=1 /usr/bin/jailer \
  -t native_devmode -i com.luma.launcher.native -p "$APP" \
  "$APP/luma-native" \
  '{"@system_native_app":true,"nid":"com.luma.launcher.native"}'
```

The launch-argument parser should print `Luma webOS launch parameters accepted`. A direct run
without the jailer is useful for isolating rendering but does not reproduce TV-menu launch:

```sh
RUST_BACKTRACE=1 /media/developer/apps/usr/palm/applications/com.luma.launcher.native/luma-native 2>&1
printf '\nExit status: %s\n' "$?"
```

`SDL has no Wayland backend` means an unsuitable SDL was loaded; rebuild/reinstall the IPK with
the pinned runtime. SDL video initialization errors include the compiled drivers and the
`XDG_RUNTIME_DIR`/`WAYLAND_DISPLAY` values, distinguishing a display-session problem from a missing
backend. An SSH shell can differ from the application manager's environment.

TV builds print cumulative `Luma startup:` timings for asset metadata, workers, SDL, the GL
context, renderer preparation and the first presented frame. `Luma font:` lines report each
face's actual load/outline-preparation time. These start inside the executable and exclude
the application manager's jailer/process-launch overhead. Use a jailed manual launch to measure
the real TV path; package size is not a proxy for first-frame latency. The IPK is unpacked at
installation, not at every app launch.

**Hardware status:** desktop rendering/state checks and ARM cross-linking/IPK creation have passed
on Apple Silicon macOS with the SDK above. The interface has appeared on a rooted webOS 26 TV
with the pinned SDL-webOS runtime, both with and without its automatic registration enabled.
SDL's registration calls can still report permission warnings. Complete app/input inventory,
Magic Remote key mapping, app switching and relaunch behavior remain under manual verification.
The native LS2 caller must also be checked under a normal application-manager launch, because
a root SSH invocation is not the app's normal sandbox/caller context.

## Weather and language

**Settings → Weather → Location** opens city/postcode search. Activate the field to use the TV's
system keyboard or a physical keyboard, close editing with Done/Back, select Search, and choose a result.
**Show widget** hides the Home summary while retaining the city. **Temperature** selects °C/°F
and converts the cached Celsius value immediately. Removing a city clears its cached reading.
No browser geolocation or IP-based location lookup is used.

Location search uses `geocoding-api.open-meteo.com`; forecast requests use `api.open-meteo.com`.
The ureq/rustls client ships its certificate roots and enforces timeouts, response limits and no
redirects. HTTP requests run on dedicated background workers; accepted cache writes are ordered
off-thread and flushed at shutdown. Native cache files are beside the preference file, with a
`.weather.json` suffix, storing a location key, Unix-seconds timestamp and unrounded Celsius data.
Fresh readings are reused for 15 minutes. Home refreshes while visible; a failure can show a valid
reading up to six hours old, labeled as saved, and retries after five minutes. Hidden widgets or
non-Home views start no new forecast requests. Old searches/forecasts cannot replace newer state.

Native weather tests use `--weather-test-server http://127.0.0.1:PORT`, which accepts only literal
loopback origins and is rejected by TV builds. They do not contact live APIs or a television.
Weather data attribution: [Open-Meteo](https://open-meteo.com/) /
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

**Settings → General → Language** selects English, Deutsch or 简体中文. It takes effect immediately
and is saved independently of the clock/temperature choices. Web and native share
`src/messages.json`, including weather conditions, notifications and device-connection labels.
Dates/time use the selected locale, and geocoding uses its language code. Installed app/device
names and an already-saved city name remain the data supplied by the TV/API. Translations and font
fallback stay local; no translation/font service is contacted at runtime.

## Current scope

Implemented: Home, Apps, General/Background/Weather/Inputs settings, favorites/reordering, hide/restore,
search, pointer/remote controls, local persistence, platform worker, native build/package tooling,
and screenshot/state automation. Layout, typography, branded cards, input artwork, navigation pill,
focus treatments, menus, footers and settings follow the web implementation's 1920×1080 geometry.

Web-preference migration, audio guidance and automatic boot/Home-button routing are not ported.
The custom renderer batches consecutive
draws, caches glyphs and images, evicts old artwork above a 48 MiB image budget, and repaints only
when the scene changes or the small pill/panel/wallpaper animations run. Reduced motion disables
these transitions. Text outlines are tessellated on demand and cached as vector geometry;
complete text runs are reused from GPU buffers with bounded caches as described above.
No TV frame-rate or memory advantage is claimed yet.

## Code map

- `src/model.rs`: inventory, identity, preferences and input visibility.
- `src/state.rs`: focus/navigation, page/modal state and effects.
- `src/view.rs`: screen composition, draw commands and hit regions.
- `src/renderer.rs`, `src/shaders/`: GPU painter, clipping, vector text/run and artwork caches.
- `src/font.rs`: lazy TTF metrics, kerning and individual glyph outlines.
- `vector-geometry/`: shared fill tessellation and boundary coverage for artwork and glyphs.
- `src/raster.rs`: logical layout, drawable density and viewport fitting.
- `src/diagnostics.rs`: warmup-aware presentation/CPU timing summaries.
- `src/platform.rs`: asynchronous TV/desktop adapter and inventory validation.
- `src/luna.rs`: native LS2 registration, bounded requests and private GLib dispatch on the TV worker.
- `src/i18n.rs`, `../src/messages.json`: shared translations and native locale formatting.
- `src/weather.rs`, `src/weather-service.rs`: validated weather state, HTTPS workers and cache.
- `src/storage.rs`: preference persistence.
- `src/main.rs`: SDL lifecycle, input capture, hold detection and frame scheduling.
- `tools/`: asset preparation, ARM cross-build, IPK staging and desktop smoke checks.
