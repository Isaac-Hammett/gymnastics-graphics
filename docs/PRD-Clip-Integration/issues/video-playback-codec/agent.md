# Execution Knowledge

## Root Cause (confirmed)

The video codec is fine (H.264 Main + AAC LC). The failure is caused by unsigned/expired R2 presigned URLs returning 400/403, which Chrome misreports as `MEDIA_ERR_SRC_NOT_SUPPORTED`.

Confirmed via Playwright: a valid presigned URL plays perfectly in a `<video>` element.

## Key Line Numbers (output.html)

- `6476-6480`: Video elements (`clipVideo`, `clipVideoNext`, `clipIframeFallback`)
- `6522-6524`: JS element refs (`const clipVideo = document.getElementById(...)`)
- `6572-6579`: Timeout constants (`STALL_TIMEOUT_MS=8000`, `LOAD_TIMEOUT_MS=10000`, `PRELOAD_TIMEOUT_MS=30000`)
- `6642-6680`: `writeClipStatus()` — Firebase write-back with exponential backoff
- `6737-6767`: `handleVideoError()` — maps MediaError codes to strings, writes error to Firebase
- `6980-7007`: `startLoadTimeout()` — 10s timeout for `canplaythrough` event
- `7149-7167`: `preloadClip(url, draftId, data)` — preloads next clip into secondary video element
- `7205-7261`: `startClip(url, options)` — loads video, sets src directly (line 7227), falls back to iframe on error (line 7250)
- `13160-13217`: Firebase listener on `currentGraphic` — dispatches to `handleClipPlayback()`
- `13269-13314`: `updateClipOverlay()` — sets athlete name, team logo, subtitle lower third
- `13371-13456`: `handleClipPlayback(graphic, data)` — orchestrates clip playback, calls `startClip(clipUrl)` at line 13430

## Key Line Numbers (server/index.js)

- `80-92`: Express app init, cors(), middleware, static file serving
- `742-928`: WhoToWatch sequencer — builds steps array with title-card + clip-playback graphics
- `856-866`: `writeGraphic()` helper — writes to `competitions/{compId}/currentGraphic`
- `887-920`: Clip completion listener — watches `clipStatus/{draftId}` for 'ended'/'played'
- `4207-4258`: `/api/competitions/:compId/clips` — existing clip API proxy (placement reference for new proxy endpoint)
- `4295`: Catch-all route for React SPA — new proxy route MUST be placed before this
- `8355`: `httpServer.listen(PORT)` where PORT defaults to 3003

## Key Line Numbers (server/lib/)

- `clipService.js:59`: `clip_url` passed through unchanged from API response
- `clipService.js:86-122`: Deduplication logic (by draft_id, then by athlete+apparatus+rotation)
- `playoutEngine.js:771-777`: Clip dispatch data structure (clipUrl written to currentGraphic)
- `playoutEngine.js:829-835`: Moment replay dispatch (same structure, different graphic type)
- `playoutEngine.js:980-992`: `_writeCurrentGraphic()` — the Firebase set() call
- `playoutEngine.js:1068-1152`: Clip status listener (reads write-backs from output.html)

## Clip URL Flow

```
Clip Engine API (presigned R2 URLs, 7-day TTL)
  → clipService.js:59 (clip_url passed through as-is)
  → playoutEngine.js:773 (written to Firebase as clipUrl)
  → Firebase: competitions/{compId}/currentGraphic/data/clipUrl
  → output.html:13371 handleClipPlayback() reads clipUrl
  → output.html:13430 startClip(clipUrl) sets video.src at line 7227
```

WhoToWatch sequencer has a parallel path:
```
server/index.js:805 (whoToWatch.clipUrl written to Firebase)
  → Same Firebase path: competitions/{compId}/currentGraphic/data/clipUrl
  → Same output.html handler
```

No URL transformation happens anywhere in this pipeline. URLs arrive intact.

## R2 Behavior

- Private bucket — unsigned URLs return `400 Bad Request` with XML body
- Presigned URLs (with `X-Amz-Signature`) return `200 OK`
- `Access-Control-Allow-Origin: *` returned when `Origin` header present
- Presigned URLs only authorize GET (HEAD returns 403, OPTIONS fails signature)
- `response-content-type=video%2Fmp4` in presigned URL controls Content-Type header
- 7-day TTL (`X-Amz-Expires=604800`)
- Bucket domain: `7f611de901ab5b1fb66ea466991895a9.r2.cloudflarestorage.com`

## Coordinator Server

- IP: `44.193.31.120`
- Public domain: `api.commentarygraphic.com`
- ffmpeg/ffprobe: installed (apt-get, during this investigation)
- Express app in `/opt/gymnastics-graphics/server/index.js`
- PM2 process name: `coordinator`
- Restart requires `GOOGLE_APPLICATION_CREDENTIALS=/opt/gymnastics-graphics/firebase-service-account.json`

## Proxy Endpoint Design Notes

- Domain allowlist: only proxy URLs containing `r2.cloudflarestorage.com`
- Must forward Range headers for seeking support (R2 supports `Accept-Ranges: bytes`)
- Stream response via pipe — do NOT buffer entire 100-200MB file in memory
- Place before the catch-all route (line ~4295) but near existing clip routes (~4258)
- Check what HTTP client is already imported (native `https`, `node-fetch`, or global `fetch`)
- Handle R2 returning 400/403 for invalid signatures: return 502 to client with clear error
- Video files are 8-200MB, ~23 Mbps bitrate. EC2 has 1 Gbps, handles 1-2 concurrent streams easily

## Client-Side proxyClipUrl() Design

```javascript
function proxyClipUrl(url) {
  if (!url) return url;
  if (url.includes('r2.cloudflarestorage.com')) {
    return `https://api.commentarygraphic.com/api/clip-proxy?url=${encodeURIComponent(url)}`;
  }
  return url;  // non-R2 URLs pass through
}
```

Must be idempotent — if URL is already proxied, don't double-proxy. Check for `clip-proxy` in URL.

## iframe fallback (clip-player.html)

- Located at `overlays/clip-player.html`
- Receives URL via `?url=` query param
- Uses same `<video>` element approach (same codec/CORS behavior)
- On error, sends `postMessage({ type: 'clipError' })` to parent
- On ended, sends `postMessage({ type: 'clipEnded' })` to parent
- output.html listens for these messages (line varies) and writes clipStatus accordingly

## Test URLs

Working presigned URL (expires ~March 29, 2026):
```
https://7f611de901ab5b1fb66ea466991895a9.r2.cloudflarestorage.com/virtius-input/clips/7d623cef-8b09-45d1-9626-72eea76b5622/output.mp4?response-content-disposition=inline&response-content-type=video%2Fmp4&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=d6e4453a2e0c06a1091bde0a0fd78ddd%2F20260322%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20260322T013629Z&X-Amz-Expires=604800&X-Amz-SignedHeaders=host&X-Amz-Signature=7698f65078f75a1017a0fcf18b197332169cd4ad25f66b29d9c60c643b325e85
```

## Build/Verify Commands

```bash
# Server changes — no build step, just restart PM2
# Output.html — no build step, just deploy file
# clip-player.html — no build step, deploy + chmod 644
# React (show-controller) — only if React components change:
cd show-controller && npm run build
```
