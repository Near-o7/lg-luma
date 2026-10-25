---
'lg-luma': patch
---

Let LG's screen saver start while Luma is in front. SDL-webOS answers the TV's screen saver requests on Luma's behalf and declined them, because SDL suspends the screen saver unless `SDL_VIDEO_ALLOW_SCREENSAVER` allows it.
