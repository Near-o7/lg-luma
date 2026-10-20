# Luma agent context

## Checks

Use pnpm, Oxlint, and Oxfmt. Node.js 22+ and pnpm 10 are required; `package.json` pins the pnpm version.

```sh
pnpm check
pnpm format:check
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:browser
```

`pnpm check` runs Oxlint and TypeScript. Run `pnpm lint:fix` to apply automatic lint fixes. Oxlint checks TypeScript, React, hooks, and accessibility rules; generated output is excluded. Formatting uses Oxfmt: `pnpm format` writes formatting changes and `pnpm format:check` verifies them.

Build before running browser tests so packaged `file://` tests exercise the current code. Browser checks cover remote navigation, hold-OK options, favorites, settings, search, persistence, focus restoration, weather configuration, temperature units, caching, and TV-service failure behavior with a mock bridge. Weather APIs are mocked; tests do not connect to a TV. On Linux, install Chromium's dependencies with `pnpm exec playwright install --with-deps chromium`.

## Structure

`src/` contains React/TypeScript UI, spatial navigation, local preferences, and the webOS bridge. `public/` contains locally bundled assets. `tools/` builds a classic-script app and IPK. `tv/autostart.sh` is the optional boot hook.

Project filenames use lowercase kebab-case, including React components (for example, `app-tile.tsx`). Keep `package.json` and `appinfo.json` versions synchronized; change the version only when requested.

## Remote and pointer controls

| Input                 | Action                                                  |
| --------------------- | ------------------------------------------------------- |
| Arrow keys            | Spatial navigation between tiles and controls           |
| OK / Enter            | Open the focused app, input, or control                  |
| Hold OK               | Home favorite: move mode; library app: options           |
| Menu / right-click / M | Options for the focused app                             |
| Back / Escape         | Close the current panel; return from Apps/Inputs to Home |
| Back on Home          | webOS's normal platform Back behavior                   |
| Magic Remote pointer  | Point, click, or hold a tile for options                 |

On Home, hold OK on a favorite to enter move mode, press Left/Right to change its position, then press Back to finish. The new order is saved immediately and the selected app stays focused. Apps → select an app → hold OK to add/remove favorites or hide apps. The action menu shows the app name and category, and closes after either action. Favorites have a filled-heart badge and sort first in the saved Home order; other apps sort alphabetically. Hidden apps remain installed and can be restored from the **Hidden (count)** category pill, which shows only hidden apps. Choose a category beside search to filter the library; select it again or use the × button to clear the filter. Long app names wrap instead of being truncated.

Home shows Favorites and Inputs without a recent-app section or permanent control hints. App names beneath Home cards are hidden by default; enable **Settings → Interface → Show app names on Home** to display them. The Apps library always shows names. The header clock is at the top left.

The top navigation includes a full-page **Settings** view, with **Background** on the left and **Interface** above **Weather** on the right. The sliders icon at the top right opens **TV settings** directly. Interface controls Home app names, 12/24-hour time, reduced motion, and refresh. Back returns to Home, and the version number appears at the bottom right of Settings. The moon button in the footer opens the ambient clock on the other pages.

The nine bundled backgrounds are Slate, Midnight, Prism (saturated red, yellow, and purple), Monument Valley, San Francisco, Summit, Forest, Yosemite, and Northern lights. From the Settings tab, Down enters Interface and continues into Weather; Left reaches the background gallery.

Apple TV, Prime Video, Disney+, Jellyfin, Netflix, YouTube, ARTE, ZDF, and Das Erste use bundled SVG logos. Input cards choose connection artwork from the reported device name: PlayStation and Apple TV use their supplied marks, USB uses the USB symbol, unnamed HDMI ports use an HDMI connector, and other devices use a suitable generic icon. Icon selection does not change the input's launch target.

## Weather

Open **Settings → Weather**, enter a city or postcode, press Search, and select the matching place. **Show widget** controls visibility on Home and the ambient screen; turning it off keeps your saved city. Choose **°C** or **°F** under **Temperature** to save your preferred unit for both screens. Switching units converts the cached reading immediately without another weather request. When enabled, the widget shows the chosen city, temperature, and current conditions. Nothing uses browser geolocation or automatic IP-based location lookup.

Back while editing the city/postcode field leaves the field and keeps Settings open. Press Back again from a button to return Home.

Weather refreshes every 15 minutes while Home or the ambient clock is visible. The ambient clock shows weather in place of the return hint when a location is configured. Recent readings are cached locally and reused after reopening the app. If the connection fails, an available cached reading is labeled as saved; otherwise the widget says weather is unavailable. Remove the weather location in Settings to turn it off. API and cached temperatures stay in Celsius; `formatTemperature` converts the unrounded value for display.

Location search calls `geocoding-api.open-meteo.com`, and weather calls `api.open-meteo.com`. Those are the only network origins allowed by the packaged app's Content Security Policy. No API key or account is required. Data attribution: [Open-Meteo](https://open-meteo.com/) / [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
