# Session Summary: Firebase MCP + Test Environment Setup

**Date**: January 16, 2026
**Status**: Complete

---

## What We Accomplished

### 1. Created Dev Firebase Project
- **Project**: `gymnastics-graphics-dev`
- **Database URL**: `https://gymnastics-graphics-dev-default-rtdb.firebaseio.com`
- **Config** (for frontend):
```javascript
const devConfig = {
  apiKey: "AIzaSyC80TXIe5TXf_urnvn8cMd8aDJjRT8Iocw",
  authDomain: "gymnastics-graphics-dev.firebaseapp.com",
  databaseURL: "https://gymnastics-graphics-dev-default-rtdb.firebaseio.com",
  projectId: "gymnastics-graphics-dev",
  storageBucket: "gymnastics-graphics-dev.firebasestorage.app",
  messagingSenderId: "373973427915",
  appId: "1:373973427915:web:4d4b4cafba59f6c8d65d4e"
};
```

### 2. Service Accounts Configured
Both service account JSON files are in place:
- `~/.config/firebase/gymnastics-graphics-dev-sa.json`
- `~/.config/firebase/gymnastics-graphics-prod-sa.json`

### 3. MCP Server Updated with New Tools

**Firebase Tools Added**:
- `firebase_get` - Read data from dev or prod
- `firebase_set` - Write data (overwrite)
- `firebase_update` - Partial update (merge)
- `firebase_delete` - Delete data
- `firebase_export` - Export path to JSON
- `firebase_list_paths` - List child keys
- `firebase_sync_to_prod` - Copy dev → prod with backup

**Security Group Tools Added**:
- `aws_list_security_group_rules` - List current rules
- `aws_open_port` - Open a port for inbound TCP
- `aws_close_port` - Close a port

Dependencies installed (`firebase-admin` added to package.json).

### 4. Test Server Configured on Coordinator VM
- nginx configured to serve static files on **port 8080**
- Directory: `/var/www/gymnastics-test`
- Port 8080 opened in AWS security group
- URL: `http://44.193.31.120:8080`

### 5. Frontend Environment Switching
- Updated `show-controller/src/lib/firebase.js` with dev/prod configs
- Use `VITE_FIREBASE_ENV=dev` or `VITE_FIREBASE_ENV=prod` at build time
- Defaults to prod if not specified

### 6. Verified Complete Workflow
- Built show-controller with dev Firebase config
- Deployed to test server via tar + SSH upload
- Verified with Playwright screenshots
- Test competition visible from dev Firebase

---

## The Ralph Wiggum Autonomous Loop

```
1. Code changes (dev branch)
2. Data structure changes (firebase_set on dev)
3. Build: cd show-controller && VITE_FIREBASE_ENV=dev npm run build
4. Deploy: tar -czf dist.tar.gz -C dist . && upload to coordinator
5. Extract: tar -xzf /tmp/dist.tar.gz -C /var/www/gymnastics-test/
6. Verify: Playwright screenshot at http://44.193.31.120:8080
7. Iterate until working
8. Production: Push to main (Netlify) + firebase_sync_to_prod
```

**Key benefit**: Unlimited testing iterations without burning Netlify build credits.

---

## Playwright Capabilities

| Tool | Use Case |
|------|----------|
| `browser_navigate` | Load test server URL |
| `browser_take_screenshot` | Capture visual state |
| `browser_snapshot` | Get element refs for interaction |
| `browser_click` | Click buttons, links |
| `browser_type` | Fill form fields |
| `browser_console_messages` | Check for JS errors |
| `browser_wait_for` | Wait for content to load |
| `browser_tabs` | Handle multiple tabs |

---

## Files Modified

| File | Change |
|------|--------|
| `tools/mcp-server/package.json` | Added `firebase-admin` dependency |
| `tools/mcp-server/index.js` | Added Firebase + Security Group tools |
| `show-controller/src/lib/firebase.js` | Added dev/prod environment switching |
| `/etc/nginx/sites-available/gymnastics-test` (on coordinator) | nginx config for test server |

---

## Quick Reference Commands

```bash
# Build for dev environment
cd show-controller && VITE_FIREBASE_ENV=dev npm run build

# Create tarball
tar -czf /tmp/claude/dist.tar.gz -C dist .

# Upload via MCP
ssh_upload_file: localPath=/tmp/claude/dist.tar.gz, remotePath=/tmp/dist.tar.gz, target=coordinator

# Extract on VM
ssh_exec: target=coordinator, command="sudo tar -xzf /tmp/dist.tar.gz -C /var/www/gymnastics-test/"

# Test with Playwright
browser_navigate: url=http://44.193.31.120:8080
browser_take_screenshot: filename=test.png
```

---

## Reference

See [docs/firebase-mcp-spec.md](firebase-mcp-spec.md) for the complete implementation plan.
