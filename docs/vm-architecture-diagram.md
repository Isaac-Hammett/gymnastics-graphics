# VM Architecture - Gymnastics Graphics System

## Visual Overview

```
                              +---------------------------+
                              |    COORDINATOR VM         |
                              |   (44.193.31.120)         |
                              |                           |
                              |  - VM Pool Manager        |
                              |  - Health Monitor         |
                              |  - Alert Aggregation      |
                              |  - Auto-Shutdown          |
                              |  - Firebase Sync          |
                              +-------------+-------------+
                                            |
                                            | manages
                                            v
           +----------------------------------------------------------------+
           |                         VM POOL                                 |
           |                                                                |
           |   +------------------+    +------------------+                 |
           |   |   WARM VMs      |    |   COLD VMs       |                 |
           |   |   (Running)     |    |   (Stopped)      |                 |
           |   |                 |    |                  |                 |
           |   | - OBS VM #1     |    | - OBS VM #3      |                 |
           |   | - OBS VM #2     |    | - OBS VM #4      |                 |
           |   |                 |    | - OBS VM #5      |                 |
           |   | Ready in <1s    |    | Start in 2-3min  |                 |
           |   +------------------+    +------------------+                 |
           +----------------------------------------------------------------+


## VM Assignment Flow

```
  +----------------+        +------------------+        +-----------------+
  |  SHOW          |  1.    |   COORDINATOR    |  2.    |   AWS EC2       |
  |  CONTROLLER    +------->|   VM             +------->|   (if needed)   |
  |  (React App)   | assign |   Pool Manager   | start  |   Start VM      |
  +----------------+        +--------+---------+        +-----------------+
                                     |
                                     | 3. update
                                     v
                            +------------------+
                            |    FIREBASE      |
                            |                  |
                            |  vmPool/vms/{id} |
                            |  - status        |
                            |  - assignedTo    |
                            |  - publicIp      |
                            +--------+---------+
                                     |
                                     | 4. sync
                                     v
                            +------------------+
                            |   OBS VM         |
                            |                  |
                            |  - OBS Studio    |
                            |  - Node.js API   |
                            |  - XVFB Display  |
                            +------------------+
                                     |
                                     | 5. stream
                                     v
                            +------------------+
                            |   VENUE          |
                            |   (RTMP output)  |
                            +------------------+
```


## What Each OBS VM Contains

```
+---------------------------------------------------------------+
|                        OBS VM Instance                         |
|                                                                |
|  +---------------------------+  +---------------------------+  |
|  |     OBS Studio            |  |     Node.js Server        |  |
|  |     (Headless)            |  |     (Port 3003)           |  |
|  |                           |  |                           |  |
|  |  - Scene Management       |  |  - Graphics API           |  |
|  |  - Video Composition      |  |  - Scene Control          |  |
|  |  - RTMP Streaming         |  |  - Health Status          |  |
|  |                           |  |                           |  |
|  +------------+--------------+  +---------------------------+  |
|               |                                                |
|               | WebSocket (4455)                               |
|               v                                                |
|  +---------------------------+                                 |
|  |  OBS WebSocket Plugin     |<-- Remote control from          |
|  |                           |    Coordinator                  |
|  +---------------------------+                                 |
|                                                                |
|  +---------------------------+                                 |
|  |  XVFB (Virtual Display)   |<-- Fake X11 display for         |
|  |                           |    headless operation           |
|  +---------------------------+                                 |
+---------------------------------------------------------------+
```


## VM States

```
                    +-----------+
                    |  STOPPED  |<----------------+
                    |(cold pool)|                 |
                    +-----+-----+                 |
                          |                       |
                          | startVM()             | stopVM()
                          v                       |
                    +-----------+                 |
                    | STARTING  |                 |
                    | (booting) |                 |
                    +-----+-----+                 |
                          |                       |
                          | health check passes   |
                          v                       |
                    +-----------+                 |
          +-------->| AVAILABLE |<------+         |
          |         |(warm pool)|       |         |
          |         +-----+-----+       |         |
          |               |             |         |
          | releaseVM()   | assignVM()  |         |
          |               v             |         |
          |         +-----------+       |         |
          +---------| ASSIGNED  |       |         |
                    |           |       |         |
                    +-----+-----+       |         |
                          |             |         |
                          | show starts |         |
                          v             |         |
                    +-----------+       |         |
                    |  IN_USE   |-------+         |
                    | (streaming|                 |
                    +-----+-----+                 |
                          |                       |
                          | show ends             |
                          +---------------------->+


              +-----------+
              |   ERROR   |<--- Health check fails
              |           |     (auto-recovery attempted)
              +-----------+
```


## Communication Channels

```
+----------------+          +------------------+          +----------------+
|   Browser      |<-------->|   Coordinator    |<-------->|   Firebase     |
|   (React)      |  Socket  |   VM             |   SDK    |   Realtime DB  |
|                |   .io    |                  |          |                |
+----------------+          +--------+---------+          +----------------+
                                     |
                                     | HTTP/WebSocket
                                     v
                            +------------------+
                            |   OBS VMs        |
                            |                  |
                            |  - REST API      |
                            |  - OBS WebSocket |
                            +------------------+
```


## VDO.Ninja Status

**NOT CURRENTLY IMPLEMENTED**

VDO.Ninja is not integrated in the current codebase. The system uses:
- Direct OBS → RTMP streaming
- OBS WebSocket for remote control

If VDO.Ninja were added, it would likely:
- Be a browser source in OBS for WebRTC input
- Provide lower latency than RTMP
- Be managed via VDO.Ninja API/iframe

---

## Key Files

| File | Purpose |
|------|---------|
| `server/services/vmPoolManager.js` | VM lifecycle management |
| `server/services/vmHealthMonitor.js` | 30-second health polling |
| `server/services/awsService.js` | AWS EC2 API wrapper |
| `server/routes/vmPoolRoutes.js` | Admin API endpoints |
| `show-controller/src/hooks/useVMPool.js` | React hook for VM state |

---

## Quick Reference

### Start a VM (Admin)
```bash
POST /api/admin/vm-pool/:vmId/start
```

### Assign VM to Competition
```bash
POST /api/competitions/:compId/vm/assign
Body: { "preferredVmId": "optional-vm-id" }
```

### Release VM
```bash
POST /api/competitions/:compId/vm/release
```

### Check Pool Status
```bash
GET /api/admin/vm-pool
```
