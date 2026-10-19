# Luma assets and references

- `public/mark.svg`, `public/app-icon.svg`, and `public/wallpapers/aurora.svg`: original Luma artwork, MIT. The TV app icon has a transparent background; webOS supplies the panel via `iconColor`, so there is no second background with its own clipping radius.
- `public/wallpapers/dunes.jpg`: Unsplash photo `1509316785289-025f5b846b35`, https://images.unsplash.com/photo-1509316785289-025f5b846b35. Bundled under the [Unsplash License](https://unsplash.com/license).
- `public/wallpapers/alpine.jpg`: Unsplash photo `1519681393784-d120267933ba`, https://images.unsplash.com/photo-1519681393784-d120267933ba. Bundled under the [Unsplash License](https://unsplash.com/license).
- `public/wallpapers/san-francisco.jpg`: Unsplash photo `1501594907352-04cda38ebc29`, https://images.unsplash.com/photo-1501594907352-04cda38ebc29. Bundled under the [Unsplash License](https://unsplash.com/license).
- `public/wallpapers/munich.jpg`: Unsplash photo `1595867818082-083862f3d630`, https://images.unsplash.com/photo-1595867818082-083862f3d630. Bundled under the [Unsplash License](https://unsplash.com/license).
- `public/wallpapers/tokyo.jpg`: Unsplash photo `1513407030348-c983a97b98d8`, https://images.unsplash.com/photo-1513407030348-c983a97b98d8. Bundled under the [Unsplash License](https://unsplash.com/license).
- Inter variable font: Rasmus Andersson, SIL Open Font License 1.1. License bundled at `public/fonts/ofl.txt`.
- Interface icons: Lucide, ISC license (dependency license in node_modules/lucide-react/LICENSE).
- Brand treatments identify installed third-party apps; their names and marks belong to their respective owners. Luma is not affiliated with those companies, Apple, or LG.

## Brand SVGs

The requested app logos use downloaded vector artwork, rather than font approximations. SVG outlines are preserved; Apple TV, Disney+, Prime Video, and Das Erste use a white monochrome display treatment for contrast. All files are bundled locally under `public/logos/`.

| Asset             | Source                                                                                                                          | Source license / attribution                                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `apple-tv.svg`    | [Apple TV logo](https://commons.wikimedia.org/wiki/File:Apple_TV_logo.svg)                                                      | Apple Inc.; public-domain logo artwork                                                                                              |
| `prime-video.svg` | [Amazon Prime Video logo](https://commons.wikimedia.org/wiki/File:Amazon_Prime_Video_logo.svg)                                  | Amazon; public-domain logo artwork                                                                                                  |
| `disney-plus.svg` | [Disney+ logo](https://commons.wikimedia.org/wiki/File:Disney%2B_logo.svg)                                                      | Disney Enterprises, Inc.; public-domain logo artwork                                                                                |
| `jellyfin.svg`    | [Jellyfin official branding, banner-dark.svg](https://github.com/jellyfin/jellyfin-ux/blob/master/branding/SVG/banner-dark.svg) | Jellyfin contributors; [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/); original license notice retained in the SVG |
| `netflix.svg`     | [Netflix 2015 logo](https://commons.wikimedia.org/wiki/File:Netflix_2015_logo.svg)                                              | Netflix Inc.; public-domain logo artwork                                                                                            |
| `youtube.svg`     | [YouTube 2024](https://commons.wikimedia.org/wiki/File:YouTube_2024.svg)                                                        | Google Inc.; public-domain logo artwork                                                                                             |
| `arte.svg`        | [ARTE 2026 logo](https://commons.wikimedia.org/wiki/File:Arte_Logo_2026.svg)                                                    | ARTE; public-domain logo artwork                                                                                                    |
| `zdf.svg`         | [ZDF logo](https://commons.wikimedia.org/wiki/File:ZDF_logo.svg)                                                                | ZDF; public-domain logo artwork                                                                                                     |
| `das-erste.svg`   | [Das Erste 2014](https://commons.wikimedia.org/wiki/File:Das_Erste_2014.svg)                                                    | ARD; public-domain logo artwork                                                                                                     |

The PlayStation input symbol uses the SVG path supplied by the user. PlayStation is a Sony Interactive Entertainment mark. HDMI, USB, and generic device symbols are Lucide icons.

TV integration was developed with [LG-XMB](https://github.com/Ripthulhu/LG-XMB)'s documented, working Homebrew Channel discovery transport as a reference. Luma does not include its code, native input hooks, shaders, or PS3 assets.

The Apple design guidance supplied for this project informed motion, focus feedback, materials, typography, and reduced-motion behavior. It is not an Apple product.
