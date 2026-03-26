# Video Playback Codec Fix — Implementation Plan

## Root Cause

The `<video>` element works fine with valid presigned R2 URLs (confirmed via Playwright test). The "Format not supported" error occurs when the URL reaching the client is unsigned or expired — R2 returns a 400/403 error body that Chrome misreports as a codec issue.

The codec is H.264 Main + AAC LC (universally browser-compatible). CORS is properly configured (`Access-Control-Allow-Origin: *`). The fix is a server-side proxy that eliminates URL auth concerns.

## Tasks

### Task 1: Add `/api/clip-proxy` endpoint to coordinator — COMPLETE

**Files:** `server/index.js`

Add a streaming proxy endpoint that:
- Accepts `url` query param (the presigned R2 clip URL)
- Validates the URL points to R2 (allowlist domain check: `r2.cloudflarestorage.com`)
- Fetches from R2 using the presigned URL via `https.get()` or `fetch()`
- Streams the response to the client with `Content-Type: video/mp4`
- Forwards `Accept-Ranges`, `Content-Length`, `Content-Range` headers for seeking
- Supports HTTP Range requests (forward client's `Range` header to R2)
- Returns proper error codes (502 if R2 fails, 400 if URL missing/invalid)

Place the route near the existing clip routes (after line ~4258 in `server/index.js`, near `/api/competitions/:compId/clips`).

Implementation notes:
- Use streaming (`res.pipe()` or equivalent) — do NOT buffer 100-200MB files in memory
- Express app already has `cors()` middleware (line ~85), so CORS is handled
- Check what HTTP client is available (native `https`, `node-fetch`, or `fetch`)
- R2 presigned URLs only authorize GET — do not attempt HEAD or OPTIONS

**Verify:**
- [ ] `curl -sI "http://localhost:3003/api/clip-proxy?url={presignedUrl}"` returns `Content-Type: video/mp4` and `200 OK`
- [ ] `curl -sI -H "Range: bytes=0-1023" "http://localhost:3003/api/clip-proxy?url={presignedUrl}"` returns `206 Partial Content`
- [ ] Missing `url` param returns 400 with error message
- [ ] Non-R2 URL returns 400 (domain allowlist security check)
- [ ] Expired/invalid presigned URL returns 502 (not 500)

---

### Task 2: Update `output.html` clip playback to route through proxy — COMPLETE

**Files:** `output.html`

Add a helper function `proxyClipUrl(url)` and apply it in three places:

1. **`handleClipPlayback()`** (line ~13371): Rewrite `clipUrl` and `nextClipUrl` before passing to `startClip()` and `preloadClip()`
2. **`startClip()`** (line ~7205): The URL arrives already rewritten from `handleClipPlayback()`, but also apply to the iframe fallback URL construction (line ~7250)
3. **`preloadClip()`** (line ~7149): URL arrives already rewritten, no extra change needed

`proxyClipUrl()` logic:
- Detect R2 URLs: check for `r2.cloudflarestorage.com` in the URL
- Rewrite to: `https://api.commentarygraphic.com/api/clip-proxy?url=${encodeURIComponent(originalUrl)}`
- Non-R2 URLs pass through unchanged (backward compatible)
- The coordinator hostname should be derived from the existing socket connection URL or hardcoded to `api.commentarygraphic.com`

Apply the rewrite in `handleClipPlayback()` so ALL downstream code (startClip, preloadClip, iframe fallback) uses the proxy URL automatically.

**Verify:**
- [ ] Navigate to `output.html?graphic=event-bar` — page loads normally (no clip mode, no regression)
- [ ] No console errors on non-clip graphics
- [ ] In clip mode: console shows proxy URL being used (add a log line)
- [ ] Preloaded next clip also uses proxy URL

---

### Task 3: Update iframe fallback to use proxy — COMPLETE

**Files:** `overlays/clip-player.html`

Update the iframe fallback player to also route through the proxy:
- Add inline `proxyClipUrl()` function (same logic as output.html, but inlined since it's a separate file)
- Apply before setting `video.src` from the `url` query param
- The URL arriving via query param may already be a proxy URL (if rewritten in output.html), so `proxyClipUrl()` should be idempotent (don't double-proxy)

**Verify:**
- [ ] Load `overlays/clip-player.html?url={presignedR2Url}` directly — video plays
- [ ] Load `overlays/clip-player.html?url={alreadyProxiedUrl}` — no double-proxy, video plays
- [ ] Console shows which URL path was used (direct vs proxy)

---

### Task 4: Add URL validation logging — COMPLETE

**Files:** `output.html`

Add diagnostic logging to `handleClipPlayback()` (line ~13371) to help debug future issues:
- Log whether the incoming `clipUrl` contains `X-Amz-Signature` (presigned) or not
- Log the final URL being set on the video element (proxy or direct)
- Log the video element's error details on failure (MediaError code + message + network state)
- Improve `handleVideoError()` (line ~6737) to also log `video.networkState` and `video.src` substring (first 80 chars) for better diagnosis

This logging helps answer the open question: are production URLs always presigned?

**Verify:**
- [ ] Console shows `[clip] URL type: presigned` or `[clip] URL type: unsigned` on clip load
- [ ] Console shows `[clip] Using proxy: https://api.commentarygraphic.com/api/clip-proxy?url=...`
- [ ] On error, console shows MediaError code, message, network state, and truncated URL

---

### Task 5: Deploy and verify with live clip URL — COMPLETE

**Files:** none (deploy only)

Deploy coordinator server changes and output.html to production:

1. **Deploy server** — Upload updated `server/` to coordinator (44.193.31.120), restart PM2 with `GOOGLE_APPLICATION_CREDENTIALS`
2. **Deploy output.html** — Upload to commentarygraphic.com web root
3. **Deploy overlays/** — Upload clip-player.html to commentarygraphic.com, `chmod 644`
4. **Test proxy endpoint** — curl the proxy with a valid presigned URL
5. **Test clip playback** — Playwright: load output.html in clip mode, inject a clip-playback graphic via Firebase, verify video plays

**Verify:**
- [ ] `curl -sI "https://api.commentarygraphic.com/api/clip-proxy?url={presignedUrl}"` returns 200 with `Content-Type: video/mp4`
- [ ] Playwright: navigate to `https://commentarygraphic.com/output.html?mode=clip&comp=wcgnic-2026-prelim1`, video plays when clip-playback graphic is written
- [ ] No console errors in Playwright browser_console_messages
- [ ] Proxy rejects non-R2 URLs (security check)

---

## Learnings

- LEARNING: Task 1 added `import https from 'https'` at line 2 of server/index.js. The proxy endpoint is at ~line 4261, right before the CSV template route. Uses native `https.request()` for streaming (no new dependencies).
- LEARNING: server/index.js uses ESM (`import` syntax). Node's native `https` module works fine for the proxy — no need for `node-fetch`.
- LEARNING: Task 2 added `proxyClipUrl()` helper at line 6588 in output.html. The function is called in `handleClipPlayback()` at lines 13399-13400 to transform both `clipUrl` and `nextClipUrl`. All downstream code (startClip, preloadClip, iframe fallback) automatically receives the proxied URL.
- LEARNING: Task 3 added inline `proxyClipUrl()` function to `overlays/clip-player.html` (lines 15-30). Same logic as output.html but inlined since it's a separate file. Uses `[clip-player]` prefix for console logs to distinguish from output.html's `[clip]` logs.
- LEARNING: Task 4 added diagnostic logging in `handleClipPlayback()` at lines 13410-13418 (URL type + proxy status) and enhanced `handleVideoError()` at lines 6781-6789 (MediaError code, message, network state, truncated URL). The error handler also now includes `networkState` in the Firebase write-back.
- LEARNING: Task 5 deployed all changes to production. Server deployed via tarball to coordinator (44.193.31.120), PM2 restarted with `GOOGLE_APPLICATION_CREDENTIALS`. Web files deployed to commentarygraphic.com (3.87.107.201) with `sudo` required for /var/www paths. Proxy endpoint verified working with curl: 200 OK for valid R2 URLs, 206 for Range requests, 400 for missing/invalid URLs.

## Bugs

(Populated by implementation iterations)
