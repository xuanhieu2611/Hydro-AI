# App Store screenshots

Final marketed screenshots for App Store Connect (iPhone 6.5" Display — **1284×2778**).
The raw screenshots already include the status bar + Dynamic Island, so the template does
not draw its own. To retarget another size, change the `width`/`height` in `slide.html`
(`html, body`, `#stage`) and the capture viewport to a size that slot accepts.

## Files
- `screenshots/01-home.png` … `05-profile.png` — iPhone 6.5" slot; upload these, in this order.
- `screenshots-ipad/01-home.png` … `05-profile.png` — iPad 13"/12.9" slot (**2048×2732**); same order.
- `build/` — reusable render pipeline.
  - `slide.html` — the iPhone composition template (headline + device frame + real screenshot over an AI background).
  - `slide-ipad.html` — the iPad variant: same slides/copy/backgrounds/shots recomposed onto the 2048×2732 canvas.
  - `bg/` — AI-generated lifestyle backgrounds (source: `assets/AIScreenShot/`).
  - `shot/` — raw app screenshots (source: `assets/raw-screenshots/`).

## Re-rendering
Each slide is `slide.html?slide=<home|camera|result|history|profile>`, rendered at a
1284×2778 viewport and captured full-page. Copy/headline live in the `SLIDES` config
inside `slide.html`. Serve `build/` over HTTP (browsers block `file://` images):

```
cd app-store/build && python3 -m http.server 8799
# open http://localhost:8799/slide.html?slide=home at a 1290x2796 viewport, screenshot full page
```

## iPad (13"/12.9") — 2048×2732

Same five slides via `slide-ipad.html`. The iPad canvas is much wider relative to its
height, so this template widens the margins, enlarges the headline, and recenters the
device frame; copy/backgrounds/shots are shared with the iPhone template. The app is
phone-first, so the iPad slots reuse the phone screenshots inside a device frame (common
and accepted). Headless Chrome renders at an exact off-screen viewport — Playwright's
window is capped by the physical display and downscales, so use Chrome directly:

```
cd app-store/build && python3 -m http.server 8798
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
OUT=../screenshots-ipad
for pair in home:01-home camera:02-camera result:03-result history:04-history profile:05-profile; do
  slide="${pair%%:*}"; name="${pair##*:}"
  "$CHROME" --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --window-size=2048,2732 --screenshot="$OUT/$name.png" \
    "http://localhost:8798/slide-ipad.html?slide=$slide"
done
```
