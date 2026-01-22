# Infrastructure Reference

**Last Updated:** 2026-01-22

Quick reference for VMs, networking, and server architecture. For OBS-specific details, see [README-OBS-Architecture.md](README-OBS-Architecture.md).

---

## VM Inventory

| VM | IP | Domain | Purpose |
|----|-----|--------|---------|
| **Coordinator** | 44.193.31.120 | api.commentarygraphic.com | Central hub, proxies all frontend connections |
| **Frontend** | 3.87.107.201 | commentarygraphic.com | Static file hosting (React SPA) |
| **Competition VMs** | Dynamic | None | Run OBS, one per competition |

---

## Connection Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  User's Browser (React App)                                 │
│  - Downloaded from commentarygraphic.com                    │
│  - ALL connections go to api.commentarygraphic.com          │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS / WSS (port 443)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  COORDINATOR (api.commentarygraphic.com)                    │
│  - nginx (SSL termination)                                  │
│  - Node.js server (port 3001, PM2 managed)                  │
│  - Routes requests to correct competition VM                │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Internal (ws://, no SSL)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  COMPETITION VM (e.g., 50.19.137.152)                       │
│  - OBS Studio (headless, port 4455 localhost only)          │
│  - Show Server (Node.js, port 3003)                         │
│  - SRT inputs (ports 9001-9010)                             │
└─────────────────────────────────────────────────────────────┘
```

**Key point:** Frontend NEVER connects directly to competition VMs. The coordinator proxies everything.

**Why:** Mixed content security. HTTPS pages can't connect to HTTP/WS endpoints. The coordinator has SSL; competition VMs don't.

---

## Network Ports

| Port | VM | Service | Access |
|------|-----|---------|--------|
| 443 | Coordinator | nginx (HTTPS) | Public |
| 3001 | Coordinator | Node.js server | Internal (via nginx) |
| 3003 | Competition | Show Server | Public |
| 4455 | Competition | OBS WebSocket | localhost only |
| 9001-9010 | Competition | SRT camera inputs | Public |
| 22 | All | SSH | Admin only |

---

## Firebase Paths

```
competitions/
  {compId}/
    config/
      vmAddress: "50.19.137.152:3003"    # Assigned VM
      eventName: "UCLA vs Stanford"
      gender: "womens"
    obs/
      state/
        connected: true
        currentScene: "Camera 1"

vmPool/
  config/
    warmCount: 2                          # Running VMs to keep ready
    coldCount: 3                          # Stopped VMs available
  vms/
    {vmId}/
      instanceId: "i-xxx"
      status: "assigned" | "available" | "stopped"
      assignedTo: "8kyf0rnl"              # Competition ID
      publicIp: "50.19.137.152"

teamsDatabase/
  teams/{team-key}/                       # Team info and rosters
  headshots/{athlete-name}/               # Athlete photos
  aliases/{alias}/                        # Team name aliases
```

---

## Routing Flow

1. User navigates to `https://commentarygraphic.com/{compId}/producer`
2. React app extracts `compId` from URL
3. App connects Socket.io to `https://api.commentarygraphic.com` with `compId` in query
4. Coordinator looks up VM for that competition in Firebase
5. Coordinator connects to VM and proxies all traffic

---

## Key Services

### Coordinator (44.193.31.120)
```bash
# Check status
ssh_exec target="coordinator" command="pm2 list"

# View logs
ssh_exec target="coordinator" command="pm2 logs coordinator --lines 50"

# Restart
ssh_exec target="coordinator" command="pm2 restart coordinator"

# Deploy updates
ssh_exec target="coordinator" command="cd /opt/gymnastics-graphics && sudo git pull --rebase origin main && pm2 restart coordinator"
```

### Competition VM
```bash
# Check OBS status
ssh_exec target="{VM_IP}" command="systemctl status obs"

# Check Show Server
ssh_exec target="{VM_IP}" command="pm2 list"

# View OBS logs
ssh_exec target="{VM_IP}" command="journalctl -u obs -n 50"
```

---

## Current AMI

| Property | Value |
|----------|-------|
| AMI ID | `ami-070ce58462b2b9213` |
| Name | gymnastics-vm-v2.2 |
| Config location | `server/lib/awsService.js` line 34 |

New VMs launched by VM Pool Manager use this AMI automatically.

---

## Quick Debugging

| Symptom | Check |
|---------|-------|
| Frontend can't connect | Is coordinator running? `curl https://api.commentarygraphic.com/api/coordinator/status` |
| Competition not loading | Is VM assigned? Check `competitions/{compId}/config/vmAddress` in Firebase |
| OBS not responding | Is OBS running on VM? `ssh_exec target={IP} command="systemctl status obs"` |
| Graphics not showing | Is `output.html` deployed? Check `https://commentarygraphic.com/output.html?graphic=logos` |
