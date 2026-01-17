# AGENT.md - Deployment & Build Knowledge

This file captures learnings about how to build, deploy, and test the gymnastics-graphics system. Ralph should update this file when discovering new gotchas or process changes.

---

## Deployment Flow (Updated 2026-01-16)

### Frontend Changes (show-controller)

```bash
# 1. Build with dev Firebase
cd show-controller && VITE_FIREBASE_ENV=dev npm run build

# 2. Package the dist folder
tar -czf /tmp/claude/dist.tar.gz -C show-controller/dist .

# 3. Upload via MCP
ssh_upload_file(target='coordinator', localPath='/tmp/claude/dist.tar.gz', remotePath='/tmp/dist.tar.gz')

# 4. Extract on server (clears old files first)
ssh_exec(target='coordinator', command='sudo rm -rf /var/www/gymnastics-test/* && sudo tar -xzf /tmp/dist.tar.gz -C /var/www/gymnastics-test/ && sudo find /var/www/gymnastics-test -name "._*" -delete', sudo=true)

# 5. Verify
browser_navigate(url='http://44.193.31.120:8080/ROUTE')
browser_snapshot()
browser_console_messages()  # Check for errors
browser_take_screenshot(filename='screenshots/TASK-ID.png')
```

### Server Changes (server/)

```bash
# 1. Package server directory
tar -czf /tmp/claude/server.tar.gz -C server .

# 2. Upload via MCP
ssh_upload_file(target='coordinator', localPath='/tmp/claude/server.tar.gz', remotePath='/tmp/server.tar.gz')

# 3. Extract on server
ssh_exec(target='coordinator', command='sudo tar -xzf /tmp/server.tar.gz -C /opt/gymnastics-graphics/server/', sudo=true)

# 4. Install dependencies if package.json changed
ssh_exec(target='coordinator', command='cd /opt/gymnastics-graphics/server && npm install --production')

# 5. Restart PM2
ssh_exec(target='coordinator', command='pm2 restart coordinator')

# 6. Verify
ssh_exec(target='coordinator', command='curl -s http://localhost:3001/api/status')
```

---

## Test Environment

| Resource | Access Method |
|----------|---------------|
| Test Frontend | http://44.193.31.120:8080 (use browser_navigate) |
| Coordinator API (internal) | `ssh_exec` curl to `localhost:3001` (runs ON the coordinator) |
| Coordinator API (external) | http://44.193.31.120:3001 or https://api.commentarygraphic.com |
| Show Server API | Port 3003 (runs on individual show VMs, not coordinator) |
| Firebase Dev | project='dev' |
| Frontend Deploy Path | /var/www/gymnastics-test/ |
| Server Deploy Path | /opt/gymnastics-graphics/server/ |
| Screenshots | screenshots/ (local) |
| Coordinator IP | 44.193.31.120 (static Elastic IP) |

---

## Build Commands

### Frontend
```bash
# Dev build (for test server)
cd show-controller && VITE_FIREBASE_ENV=dev npm run build

# Production build (for Netlify - don't use for testing)
cd show-controller && npm run build
```

### Server
```bash
# No build step - just package and deploy
# Dependencies installed on server via npm install --production
```

### MCP Server (tools/mcp-server)
```bash
# Run tests
cd tools/mcp-server && npm test

# Run specific test category
cd tools/mcp-server && npm run test:integration
```

---

## Gotchas & Learnings

### Deployment
- **Always use VITE_FIREBASE_ENV=dev** when building for test server, otherwise it connects to production Firebase
- **Delete macOS resource forks** after tar extract: `find /var/www/gymnastics-test -name "._*" -delete`
- **PM2 restart required** after server code changes - files don't hot reload

### MCP Tools
- **Use 'coordinator' shortcut** instead of IP for ssh_exec target when possible
- **ssh_exec curl uses localhost:3001** because it runs ON the coordinator
- **browser_navigate uses public IP** (44.193.31.120:8080) because Playwright runs locally

### Firebase
- **Always use project='dev'** for testing - never write test data to prod
- **Clean up test data** after verification with firebase_delete

### Git
- **Work on dev branch** - only merge to main for production deploys
- **One commit per task** with clear message including task ID

---

## Process Notes

- Ralph updates this file when discovering new deployment quirks
- Keep entries brief and actionable
- Date significant changes
