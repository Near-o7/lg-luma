# Luma

A modern, remote-first launcher for rooted LG webOS TVs, inspired by the clarity and feel of Apple TV.

Luma brings your installed apps and HDMI inputs into a locally rendered home screen: cinematic backdrops, static app tiles with clear focus outlines, editable favorites, compact inputs, and a searchable app library. Optional local weather is powered by Open-Meteo.

![Luma home screen, desktop preview](docs/home.png)

## Run on your Mac

Node.js 22+ and pnpm 10 (the project pins pnpm 10.34.5):

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open **http://127.0.0.1:5173**. Desktop preview shows clearly identified sample apps and inputs; app launches display a preview message. On a TV, only its actual inventory is shown.

## Build an installable package

```sh
pnpm run package
```

Output: `dist/com.luma.launcher_0.1.7_all.ipk`, plus `dist/sha256sums`. The standalone app is also in `dist/app/`, and works directly from `index.html` without a server.

Photographs, fonts, and app-logo SVGs are checked in locally. `pnpm assets` prepares them again if you deliberately remove them; it downloads from Unsplash, jsDelivr, Wikimedia Commons, and the Inter/Jellyfin repositories at build time. Normal builds and TV use require no asset downloads. Logo sources and licenses are documented in [assets.md](assets.md).

## Install on your rooted TV

1. Open Homebrew Channel on your TV; check **Settings → Root status: ok**.
2. Open [webOS Dev Manager](https://github.com/webosbrew/dev-manager-desktop) on your Mac.
3. Connect to `10.120.1.99`, port `22`, user `root`, using your existing SSH password or key.
4. Install `dist/com.luma.launcher_0.1.7_all.ipk` and launch **Luma**.

Or register your root SSH connection with the locally installed CLI:

```sh
pnpm exec ares-setup-device
# Add profile "tv": host 10.120.1.99, port 22, user root; choose your SSH authentication.
pnpm run deploy --device tv
```

The package has its own ID and installs alongside LG Home and LG-XMB.

### Installing with luna-send

Manual IPK installation is supported. From your Mac, copy the built package:

```sh
scp -O dist/com.luma.launcher_0.1.7_all.ipk root@10.120.1.99:/tmp/luma-0.1.7.ipk
ssh root@10.120.1.99
```

Then, inside the TV's root shell:

```sh
luna-send -i luna://com.webos.appInstallService/dev/install \
  '{"id":"com.luma.launcher","ipkUrl":"/tmp/luma-0.1.7.ipk","subscribe":true}'
```

Wait for the terminal installation success response, then press Ctrl+C if the subscription stays open. Fully close and reopen Luma so the new package permissions are used.

### webOS 26: denied exec method

Homebrew Channel 0.8.0-rc1 adds the `lunabus.query` API permission mapping for elevated services ([upstream fix](https://github.com/webosbrew/webos-homebrew-channel/pull/233)). Luma 0.1.1 declares that group alongside its app-launch permissions. Reinstall 0.1.1 if an older Luma build reports `Denied method call "exec" for category "/"`.

If the denial persists after reopening Luma, perform a full TV reboot. If it still occurs, inspect the installed caller permissions and the Homebrew service mapping from the root SSH shell:

```sh
cat /var/luna-service2*/client-permissions.d/com.luma.launcher*.json
cat /var/luna-service2*/api-permissions.d/org.webosbrew.hbchannel.service.api.lunabus.query.json
```

The caller needs `lunabus.query`, and Homebrew's mapping should contain `{"lunabus.query":["org.webosbrew.hbchannel.service/*"]}`. Homebrew Channel must also be elevated. Installing Luma via `luna-send` does not require elevating Luma itself.

## Remote and pointer controls

| Input                  | Action                                                   |
| ---------------------- | -------------------------------------------------------- |
| Arrow keys             | Spatial navigation between tiles and controls            |
| OK / Enter             | Open the focused app, input, or control                  |
| Hold OK                | Home favorite: move mode; library app: options           |
| Menu / right-click / M | Options for the focused app                              |
| Back / Escape          | Close the current panel; return from Apps/Inputs to Home |
| Back on Home           | webOS's normal platform Back behavior                    |
| Magic Remote pointer   | Point, click, or hold a tile for options                 |

On Home, hold OK on a favorite to enter move mode, press Left/Right to change its position, then press Back to finish. The new order is saved immediately and the selected app stays focused. Apps → select an app → hold OK to add/remove favorites or hide apps. Hidden apps remain installed and can be restored with **Apps → Hidden apps**. Choose a category beside search to filter the library; select it again or use the × button to clear the filter. Long app names wrap instead of being truncated.

Home shows Favorites and Inputs without a recent-app section or permanent control hints. App names beneath Home cards are hidden by default; enable **Settings → Interface → Show app names on Home** to display them. The Apps library always shows names. The header clock is at the top left.

The top navigation includes a full-page **Settings** view, with **Background** on the left and **Interface** above **Weather** on the right. The sliders icon at the top right opens **TV settings** directly. Interface controls Home app names, 12/24-hour time, reduced motion, and refresh. Back returns to Home, and the version number appears at the bottom right of Settings. The moon button in the footer opens the ambient clock on the other pages.

The nine bundled backgrounds are Slate (a lighter gradient), Midnight (a dark gradient), Monument Valley, San Francisco, Summit, Forest, Lofoten, Yosemite, and Northern lights. From the Settings tab, Down enters Interface and continues into Weather; Left reaches the background gallery.

Apple TV, Prime Video, Disney+, Jellyfin, Netflix, YouTube, ARTE, ZDF, and Das Erste use bundled SVG logos. Input cards choose connection artwork from the reported device name: PlayStation uses the supplied PlayStation mark, USB uses the USB symbol, unnamed HDMI ports use an HDMI connector, and other devices use a suitable generic icon. Icon selection does not change the input's launch target.

## Weather

Open **Settings → Weather**, enter a city or postcode, press Search, and select the matching place. **Show widget** controls visibility on Home and the ambient screen; turning it off keeps your saved city. When enabled, the widget shows the chosen city, temperature in °C, and current conditions. Nothing uses browser geolocation or automatic IP-based location lookup.

Back while editing the city/postcode field leaves the field and keeps Settings open. Press Back again from a button to return Home.

Weather refreshes every 15 minutes while Home or the ambient clock is visible. The ambient clock shows weather in place of the return hint when a location is configured. Recent readings are cached locally and reused after reopening the app. If the connection fails, an available cached reading is labeled as saved; otherwise the widget says weather is unavailable. Remove the weather location in Settings to turn it off.

Location search calls `geocoding-api.open-meteo.com`, and weather calls `api.open-meteo.com`. Those are the only network origins allowed by the packaged app's Content Security Policy. No API key or account is required. Data attribution: [Open-Meteo](https://open-meteo.com/) / [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

## Optional: open at boot

After testing the installed app, run this inside the TV's root SSH shell:

```sh
sh /media/developer/apps/usr/palm/applications/com.luma.launcher/autostart.sh enable
```

This adds an app-owned hook at `/var/lib/webosbrew/init.d/65-luma`. It launches after a full boot with a 25-second delay. It does not run on every standby wake. Disable it before uninstalling:

```sh
sh /media/developer/apps/usr/palm/applications/com.luma.launcher/autostart.sh disable
```

## Optional: remote Home button

Use [LG Input Hook](https://repo.webosbrew.org/apps/org.webosbrew.inputhook/) to map your remote's Home key to this command (one line):

```sh
/usr/bin/luna-send -t 1 -w 5000 luna://com.webos.service.applicationmanager/launch '{"id":"com.luma.launcher"}'
```

The `-t` launch route is based on LG-XMB's webOS 10+ root-shell behavior. Test the mapping on a spare button first. In LG-XMB, select **Settings → Remote → Home button → LG Home** before switching to another input hook. A Home event may otherwise be handled by two launchers. Disable the Luma mapping in Input Hook to restore the normal button.

Luma does not inject code into LG services, replace the stock launcher, bind-mount system directories, or copy LG-XMB's native hooks. Root-only Home routing is separate from the app itself.

## Compatibility and privacy

- Targets webOS 24–26 / Chromium 108+. Graphics are packaged at 1920 × 1080 and scale for desktop preview.
- App/input discovery uses Homebrew Channel's elevated `exec` service, following the integration approach documented by the working LG-XMB project. Fixed inventory commands read only app and physical-input lists.
- App launches use the public application manager API with the `application.launcher` and `application.query` ACGs. Homebrew service access declares `lunabus.query` for webOS 26 / Homebrew Channel 0.8.0-rc1. No service permissions are rewritten.
- Service bridges are retained until completion, bounded by timeouts, and cancelled afterward. Partial refresh failures preserve the last valid inventory.
- All app names and IDs come from inventory on the TV. A failure never substitutes desktop sample apps.
- Preferences, recent launches, weather location, and cached readings stay in this app's local storage. Forecast requests require an enabled widget and a configured location; city searches are sent only when you press Search. The packaged Content Security Policy limits web network connections to Open-Meteo's weather and geocoding APIs.
- Homebrew Channel permissions and native service behavior need verification on the physical TV, particularly webOS 26. Browser tests cannot establish hardware compatibility.

## Checks

```sh
pnpm check
pnpm format:check
pnpm test
pnpm exec playwright install chromium
pnpm test:browser
```

`pnpm check` runs Oxlint and TypeScript. Run `pnpm lint:fix` to apply automatic lint fixes. Oxlint checks TypeScript, React, hooks, and accessibility rules; generated output is excluded. Formatting uses Oxfmt: `pnpm format` writes formatting changes and `pnpm format:check` verifies them.

Browser checks cover packaged `file://` loading, remote navigation, hold-OK options, favorites, settings, search, persistence, focus restoration, weather configuration and caching, and TV-service failure behavior with a mock bridge. Weather APIs are mocked in browser tests; no tests connect to a TV. Run `pnpm build` first if the packaged app is missing.

## Structure

`src/` contains React/TypeScript UI, spatial navigation, local preferences and the webOS bridge. `public/` contains locally bundled assets. `tools/` builds a classic-script app and IPK. `tv/autostart.sh` is the optional boot hook.

Project filenames use lowercase kebab-case, including React components (for example, `app-tile.tsx`).

MIT for Luma's source. See [assets.md](assets.md) for artwork, font, icon, and integration references.
