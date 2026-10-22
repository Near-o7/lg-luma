# Luma

A native launcher for rooted LG webOS TVs, inspired by Apple TV.

> [!NOTE]
> Tested on **LG OLED55C57** running **webOS 26**.
> External testing confirms compatibility with **webOS 6 and newer**.

<table>
  <tr>
    <td width="50%" align="center">
      <img src="docs/home.png" alt="Luma native Home screen, desktop preview">
    </td>
    <td width="50%" align="center">
      <img src="docs/apps.png" alt="Luma native app library, desktop preview">
    </td>
  </tr>
  <tr>
    <td width="50%" align="center">
      <img src="docs/settings.png" alt="Luma native General settings with Quit app, desktop preview">
    </td>
    <td width="50%" align="center">
      <img src="docs/inputs.png" alt="Luma native input settings, desktop preview">
    </td>
  </tr>
</table>

Screenshots show the native desktop preview with sample apps and inputs.

## Features

- Home favorites in one horizontally scrolling row, with physical inputs beneath.
- App library with categories, search, favorites and hide/restore controls.
- Remote arrows, OK, hold-OK reordering/options and Magic Remote pointer input.
- General, Background, Weather and Inputs settings; Quit app in General.
- English, German and Simplified Chinese; local fonts and artwork.
- Explicit city/postcode weather search, Celsius/Fahrenheit and cached readings.
- TV system keyboard for text entry; a custom keyboard for desktop preview.
- On-demand drawing when idle, VSync-paced animation, and reduced-motion settings.

## Build and install

From the repository root, with Nix flakes enabled:

```sh
nix develop
pnpm install --frozen-lockfile
pnpm sdk
export WEBOS_NDK="$PWD/.build/toolchain/arm-webos-linux-gnueabi_sdk-buildroot"
pnpm run package
```

`pnpm sdk` downloads and relocates the pinned SDK for your host. It supports Apple Silicon/Intel
macOS and ARM64/x86-64 Linux. The Nix shell supports Apple Silicon macOS and ARM64/x86-64 Linux.
Keep the SDK path free of spaces. The first native runtime preparation also downloads a
checksum-pinned SDL-webOS library; both downloads are cached under `.build/`.

Output:

```text
dist/com.ecklf.luma_2.0.0_arm.ipk
dist/sha256sums
dist/repo.json
dist/app-icon-large.png
```

Open [webOS Dev Manager](https://github.com/webosbrew/dev-manager-desktop), connect to the TV's
IP on port **22** as **root**, and install the IPK. Open **Luma** from the TV menu. Homebrew
Channel must be elevated; on webOS 26 use **0.8.0-rc1 or newer** for its `lunabus.query` mapping.

The native package uses **`com.ecklf.luma`** and installs separately from the old
`com.luma.launcher` web app and the former `com.luma.launcher.native` / `com.luma.native` prototypes. Native preferences
are local JSON files and are separate for each installation; browser preferences are not migrated.
Homebrew Channel treats this ID as a separate app rather than an update to the old launcher.

### Install over SSH

On your computer, replace `TV_IP`:

```sh
scp -O dist/com.ecklf.luma_2.0.0_arm.ipk root@TV_IP:/tmp/luma.ipk
ssh root@TV_IP
```

In the TV's root shell:

```sh
luna-send -i luna://com.webos.appInstallService/dev/install \
  '{"id":"com.ecklf.luma","ipkUrl":"/tmp/luma.ipk","subscribe":true}'
```

Wait for installation success; Ctrl+C closes an ongoing subscription. Fully close and reopen
Luma after updating. The [development guide](development.md#tv-startup-diagnostics) has a jailed
launch command that exposes errors hidden by the normal menu launch.

### Homebrew feed

The package command generates the release feed for:

```text
https://github.com/ecklf/lg-luma/releases/latest/download/repo.json
```

Add that repository in Homebrew Channel once a native release is published. The feed carries the
ARM IPK's SHA-256, byte size and version-specific release URL. Existing published releases may
still contain the web launcher; use the locally built ARM IPK for this native rewrite.

## Desktop development

```sh
nix develop
pnpm install --frozen-lockfile
pnpm assets
pnpm dev
```

The desktop preview uses sample inventory and never calls TV services. To manually exercise a
longer app grid:

```sh
pnpm dev --test-extra-apps 120
```

Preview preferences are separate from normal preferences. See [development.md](development.md)
for controls, vector rendering, diagnostics, tests and the source layout.

## Optional: boot and Home-button routing

After verifying Luma, enable the bundled cold-boot hook in the TV's root shell:

```sh
sh /media/developer/apps/usr/palm/applications/com.ecklf.luma/autostart.sh enable
```

It launches after a full boot with a 25-second delay. Disable before uninstalling:

```sh
sh /media/developer/apps/usr/palm/applications/com.ecklf.luma/autostart.sh disable
```

Use [LG Input Hook](https://repo.webosbrew.org/apps/org.webosbrew.inputhook/) for optional Home-key
routing. Configure its Execute action with this one-line command:

```sh
/usr/bin/luna-send -t 1 -w 5000 luna://com.webos.service.applicationmanager/launch '{"id":"com.ecklf.luma"}'
```

Test on a spare button first. Disable the mapping in Input Hook to restore normal Home behavior.
Installing Luma does not enable either optional routing integration.

## Privacy and scope

App/input discovery uses fixed inventory commands through Homebrew Channel's elevated service.
App launches use the native Luna bus with declared permissions. There is no demo inventory
fallback on the TV. Native caller permissions and lifecycle behavior can differ by firmware.

Favorites, hidden apps, settings, weather location and cached readings stay in local JSON files
in an app-owned persistent directory outside the installed payload.
Weather search/forecast requests go to Open-Meteo, with embedded TLS roots and bounded responses.
There is no browser geolocation, IP-based location lookup, telemetry or runtime font download.

Luma is licensed under MIT.
Luma is not affiliated with LG, Apple, Plex or any app brands shown in its UI.
