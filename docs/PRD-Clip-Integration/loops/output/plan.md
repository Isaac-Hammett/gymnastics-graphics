# Output — Tasks

1. Add mode parameter support (?mode=live, ?mode=clip, ?mode=preview) to output.html with mode-specific rendering logic — COMPLETE
2. Add dual persistent video elements (clipVideo, clipVideoNext) with CSS class swap mechanism for transitions — COMPLETE
3. Add clip-playback renderer with athlete info overlay and score reveal at Math.max(duration-5, duration*0.6) — COMPLETE
4. Add moment-replay renderer with REPLAY badge, seek range, playback rate, muted default — COMPLETE
5. Add live-camera renderer with LIVE badge and apparatus label — NOT STARTED
6. Add animated background div for break content with theme variable gradient — NOT STARTED
7. Add Firebase write-back for clip status (ended/stalled/error) at clipStatus/{draftId} with retry logic — NOT STARTED
8. Add preloading (nextClipUrl) and optimistic auto-advance with correction handling — NOT STARTED
