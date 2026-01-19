# Infrastructure Task - Product Requirements

## Goal

[Describe infrastructure change: deploy, configure, migrate, etc.]

---

## Success Criteria

### Workflow 1: Pre-Change Validation
1. Current state documented with screenshots
2. Backup taken if needed
3. Rollback plan identified

### Workflow 2: Apply Changes
1. Changes applied successfully
2. Services restarted if needed
3. No errors in logs

### Workflow 3: Post-Change Verification
1. All services responding
2. Frontend loads correctly
3. API endpoints work
4. Firebase connected

---

## Environment

| Resource | Value |
|----------|-------|
| Production Frontend | https://commentarygraphic.com |
| Production Frontend Server | 3.87.107.201 |
| Frontend Directory | /var/www/commentarygraphic |
| Coordinator API | https://api.commentarygraphic.com |
| Coordinator VM | 44.193.31.120 |

---

## Commands Reference

### SSH Access
```bash
ssh_exec(target='3.87.107.201', command='...')
ssh_exec(target='coordinator', command='...')
```

### Service Management
```bash
# nginx
sudo nginx -t && sudo systemctl reload nginx

# PM2
pm2 restart coordinator
pm2 logs coordinator --lines 50
```

### File Operations
```bash
ssh_upload_file(target='...', localPath='...', remotePath='...')
ssh_download_file(target='...', remotePath='...', localPath='...')
```

---

## Known Issues (Starting Point)

1. [Current state / problem]
2. [What needs to change]

---

## Rollback Plan

If something goes wrong:
1. [Step to revert]
2. [Step to restore]
3. [Step to verify]

---

## Verification Method

Every task MUST be verified with:
1. `ssh_exec` to check service status
2. `browser_navigate` to test frontend
3. `browser_take_screenshot` to document state
4. `browser_console_messages` to check for errors
