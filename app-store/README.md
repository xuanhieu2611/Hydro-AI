# App Store screenshots

Final marketed screenshots for App Store Connect (iPhone 6.5" Display — **1284×2778**).
The raw screenshots already include the status bar + Dynamic Island, so the template does
not draw its own. To retarget another size, change the `width`/`height` in `slide.html`
(`html, body`, `#stage`) and the capture viewport to a size that slot accepts.

## Files
- `screenshots/01-home.png` … `05-profile.png` — upload these, in this order.
- `build/` — reusable render pipeline.
  - `slide.html` — the composition template (headline + device frame + real screenshot over an AI background).
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
