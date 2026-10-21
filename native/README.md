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
HiDPI framebuffer scaling and pointer coordinates are handled independently. Fonts are rasterized
at the drawable's physical density, with grayscale coverage antialiasing and pixel-aligned glyph
origins/baselines; text layout and kerning stay in 1920×1080 logical coordinates. `--fullscreen`
opens a fullscreen preview. Rust changes use incremental compilation and a relaunch.

Assets are prepared under `.build/native/assets` from the existing wallpapers, SVG logos, collected
app artwork and Inter font. The font is decompressed to TTF and the SVGs are rasterized at build
time. The variable font is instantiated at the web UI's weights and optical sizes. Wallpaper
cropping, saturation, shading and tile gradients are prepared ahead of time from the web design,
and UI/input icons reuse the web components at build time. No asset downloads occur.
Regenerate assets after changing their sources.

### HiDPI and 4K

Text density is automatic: a 20px logical label uses a 40px glyph bitmap on a 2× drawable. The
glyph cache keys include physical raster size and use separate atlas pages, so resizing and
switching capture density cannot reuse undersized bitmaps. Grayscale coverage is applied once;
transparent white atlas gutters prevent dark filtering fringes. There is no RGB subpixel AA or
MSAA dependency for text.

Generate optional 3840×2160 wallpaper variants for higher-density surfaces:

```sh
pnpm native:assets --4k
```

The renderer selects these at densities above 1× when the GPU supports their texture size, and
otherwise uses the 1080p assets. SVG backgrounds are rasterized at the higher resolution;
photographic detail remains limited by the bundled source photographs. Regenerate and restart
the preview after changing assets. Logos and UI icons already have oversized backing images.

A 4K offscreen capture works independently of the desktop window's size:

```sh
pnpm native:dev --script 'home,down' --frames 90 \
  --capture-scale 2 --screenshot .build/native/home-4k.png \
  --diagnostics .build/native/render.json
```

`--capture-scale 1` is the default 1920×1080 comparison surface; `2` renders at 3840×2160 with
fresh, density-appropriate glyphs. It does not enlarge a 1080p screenshot or force the TV's output.

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
font density, glyph failures, atlas/image byte estimates and draw calls. Larger framebuffers have
four times the pixel area at 2× density; compare the requested modes on the TV before choosing a
default.

### Controls

| Input                        | Action                                          |
| ---------------------------- | ----------------------------------------------- |
| Arrows                       | Move focus; scroll to keep remote focus visible |
| Enter / OK                   | Activate on release                             |
| Hold Enter / OK for 600 ms   | Move a Home favorite; app options in Apps       |
| M / Menu / right-click       | App options                                     |
| Escape / Back                | Dismiss panel, navigate back, or exit from Home |
| Mouse / Magic Remote pointer | Hover, click, hold; wheel to scroll             |
| F5                           | Refresh inventory                               |

Left/Right switches focused top tabs immediately; clicking or OK also selects a tab. Home has
favorites and all eligible physical inputs. Apps supports
categories, Hidden, favorite-first ordering, wrapped names, and search with a remote-operable
on-screen keyboard or a physical keyboard. Options add/remove favorites or hide/restore apps.
Move mode saves on each Left/Right step. General settings control app names, clock format and
reduced motion. Clock format and each input open nested choice pages with checkmarks; Left/Back
returns to the parent row. Background has all nine wallpapers and enters at the currently applied
background. Input choices are On, Off and Auto, with the same descriptions as the web app.
Hidden appears only when needed, and search/category filters have separate clear controls.

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
density-appropriate glyph rasterization and forced presentation profiling. On Linux it can run under Xvfb
with Mesa software rendering. It does not measure TV performance.
The separate Native prototype GitHub workflow runs these checks on Linux and uploads its screenshots.

For a specific screen:

```sh
pnpm native:dev --preferences .build/native/demo.json \
  --script 'apps,down,right,menu' --frames 90 \
  --screenshot .build/native/options.png --dump-state .build/native/state.json
```

Scripts support `home`, `apps`, `settings`, `up`, `down`, `left`, `right`, `enter`, `back`, `menu`,
`hold`, `type:TEXT`, and `wait`. Screenshots are taken before the final buffer swap. The state dump
provides machine-readable focus, filtering and preferences. The scripts drive the same state
transitions as the interactive UI.

`--time 2026-10-21T20:41:00+02:00` fixes the clock/date for reproducible previews. Scripted
`click:X:Y` uses authored 1920×1080 coordinates and injects actual SDL button-down/up events.

### Compare with the web interface

```sh
pnpm exec playwright install chromium
pnpm native:compare
```

Run these inside `nix develop`. Linux already has matching Playwright browsers in the shell;
the browser-install command is needed on macOS. For headless native rendering on Linux, run
`xvfb-run -a pnpm native:smoke`.

The comparison command builds the web app and captures both renderers with the same inventory,
preferences, time and canvas size. Weather and translation controls are omitted from the web
references. It covers Home (with/without captions and empty), Apps, options, Music, Hidden,
search/empty results, General, clock choices, Background, Inputs and input choices.

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

```sh
export WEBOS_NDK=/absolute/path/to/arm-webos-linux-gnueabi_sdk-buildroot
pnpm native:assets
pnpm native:build
pnpm native:package
```

The NDK must expose a webOS-compatible SDL2 and its `sdl2.pc` in the sysroot. The build script
uses the NDK compiler, sysroot and pkg-config metadata together. Do not use rust-sdl2's generic
`bundled` feature for this target: the SDL backend must support the TV's compositor. rust-sdl2 0.38
recommends SDL 2.0.26+; older system SDL builds need a compatible webOS SDL build and on-device
link testing. If shipping SDL/shared libraries, set `WEBOS_NATIVE_LIBS` to their directory before
packaging; the executable searches `$ORIGIN/lib`. Package only the needed webOS libraries.

The package is created under `.build/native/dist` as **Luma Native**,
`com.luma.launcher.native`, with the version taken from the root `appinfo.json`.
The packager validates that the executable is a 32-bit ARM ELF. Install the resulting IPK through
Dev Manager or the same root-shell app installation workflow used for Luma.

### TV services

Only builds compiled with `--features webos` use TV services; a desktop build refuses to run on a
TV. Inventory never falls back to demo data in a TV build. One worker handles blocking platform
requests, leaving input and rendering on the SDL thread. Refreshes and launches are deduplicated.

The initial adapter invokes `/usr/bin/luna-send-pub -a com.luma.launcher.native` for app-identity
Luna calls. App launches use the application manager. Fixed inventory commands go through
Homebrew Channel's elevated `exec`, following the web launcher's permission model. Requests have
bounded response sizes and timeouts. Input-read failures retain the last good inputs. The manifest
declares `application.launcher`, `application.query` and `lunabus.query`; Homebrew Channel must
provide that permission mapping for the native app ID too.

TV preferences are saved beside the installed executable. The SDL window uses the app ID as its
Wayland class. Hidden/minimized windows pause drawing, and focus restoration refreshes inventory.
Back on Home exits the native app and returns control to the platform.

**Hardware status:** desktop rendering and state behavior are testable locally. Cross-linking,
native caller permissions, the TV SDL/Wayland backend, Magic Remote key mapping, app switching
and relaunch behavior still require verification on the actual TV. The CLI adapter can later be
replaced behind `platform.rs` with direct LS2 integration if the native sandbox requires it.

## Current scope

Implemented: Home, Apps, General/Background/Inputs settings, favorites/reordering, hide/restore,
search, pointer/remote controls, local persistence, platform worker, native build/package tooling,
and screenshot/state automation. Layout, typography, branded cards, input artwork, navigation pill,
focus treatments, menus, footers and settings follow the web implementation's 1920×1080 geometry.

Weather, localization, web-preference migration, audio guidance, native OS virtual-keyboard
integration and automatic boot/Home-button routing are not ported. Native UI text is English;
the bundled font currently covers Latin characters. The custom renderer batches consecutive
draws, caches glyphs and images, evicts old artwork above a 48 MiB image budget, and repaints only
when the scene changes or the small pill/panel/wallpaper animations run. Reduced motion disables
these transitions. Text is CPU-rasterized once per cached
glyph and physical raster size; UI compositing uses the GPU. Glyph atlases normally retain at most
four 1024×1024 RGBA pages (16 MiB). A larger single-frame working set can temporarily require more;
unused overflow pages are trimmed and pages referenced by queued text are never recycled.
No TV frame-rate or memory advantage is claimed yet.

## Code map

- `src/model.rs`: inventory, identity, preferences and input visibility.
- `src/state.rs`: focus/navigation, page/modal state and effects.
- `src/view.rs`: screen composition, draw commands and hit regions.
- `src/renderer.rs`, `src/shaders/`: GPU painter, clipping, glyph atlas and artwork cache.
- `src/raster.rs`: density, pixel alignment and atlas packing/recycling policy.
- `src/diagnostics.rs`: warmup-aware presentation/CPU timing summaries.
- `src/platform.rs`: asynchronous TV/desktop adapter and inventory validation.
- `src/storage.rs`: preference persistence.
- `src/main.rs`: SDL lifecycle, input capture, hold detection and frame scheduling.
- `tools/`: asset preparation, ARM cross-build, IPK staging and desktop smoke checks.
