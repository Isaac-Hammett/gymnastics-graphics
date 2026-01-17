# Plan: Firebase MCP Tools + Dev Environment + Ralph Wiggum Integration

## Overview

Set up a complete dev/test environment that allows Claude (via Ralph Wiggum autonomous loop) to:
1. Make code changes
2. Make Firebase data structure changes
3. Test on a dedicated Test VM
4. Visually verify with Playwright
5. Deploy to production (Netlify + Firebase prod) when verified

---

## Part 1: Create Dev Firebase Project

### Steps (Manual - User Action Required)
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add Project"
3. Name it: `gymnastics-graphics-dev`
4. Disable Google Analytics (not needed for dev)
5. Once created, go to Project Settings > General
6. Scroll to "Your apps" > Click web icon (`</>`)
7. Register app name: `gymnastics-graphics-dev-web`
8. Copy the `firebaseConfig` object - we'll need it

### Firebase Config We'll Get
```javascript
const firebaseDevConfig = {
  apiKey: "...",
  authDomain: "gymnastics-graphics-dev.firebaseapp.com",
  databaseURL: "https://gymnastics-graphics-dev-default-rtdb.firebaseio.com",
  projectId: "gymnastics-graphics-dev",
  storageBucket: "gymnastics-graphics-dev.firebasestorage.app",
  messagingSenderId: "...",
  appId: "..."
};
```

### Enable Realtime Database
1. In Firebase Console for dev project
2. Go to "Build" > "Realtime Database"
3. Click "Create Database"
4. Choose location (us-central1 recommended)
5. Start in "test mode" for now (open rules)

---

## Part 2: Add Firebase Tools to MCP Server

### New Tools to Add

| Tool | Description | Risk Level |
|------|-------------|------------|
| `firebase_get` | Read data at a path | Low |
| `firebase_set` | Write/overwrite data at a path | Medium |
| `firebase_update` | Partial update at a path | Medium |
| `firebase_push` | Push new item to a list | Medium |
| `firebase_delete` | Delete data at a path | High |
| `firebase_export` | Export entire path to JSON | Low |
| `firebase_import` | Import JSON to a path | High |
| `firebase_list_paths` | List children at a path | Low |
| `firebase_sync_to_prod` | Copy dev data to prod | High |

### Configuration

```javascript
// Add to CONFIG in tools/mcp-server/index.js
const FIREBASE_CONFIG = {
  dev: {
    databaseURL: "https://gymnastics-graphics-dev-default-rtdb.firebaseio.com",
    serviceAccountPath: join(homedir(), '.config', 'firebase', 'gymnastics-graphics-dev-sa.json'),
  },
  prod: {
    databaseURL: "https://gymnastics-graphics-default-rtdb.firebaseio.com",
    serviceAccountPath: join(homedir(), '.config', 'firebase', 'gymnastics-graphics-prod-sa.json'),
  }
};
```

### Tool Definitions

```javascript
{
  name: 'firebase_get',
  description: 'Read data from Firebase Realtime Database at a specific path.',
  inputSchema: {
    type: 'object',
    properties: {
      project: {
        type: 'string',
        enum: ['dev', 'prod'],
        description: 'Which Firebase project to use'
      },
      path: {
        type: 'string',
        description: 'Database path (e.g., "competitions/pac12-2025/config")'
      }
    },
    required: ['project', 'path']
  }
},
{
  name: 'firebase_set',
  description: 'Write data to Firebase, overwriting any existing data at that path.',
  inputSchema: {
    type: 'object',
    properties: {
      project: { type: 'string', enum: ['dev', 'prod'] },
      path: { type: 'string' },
      data: { type: 'object', description: 'The data to write (JSON object)' }
    },
    required: ['project', 'path', 'data']
  }
},
{
  name: 'firebase_update',
  description: 'Partially update data at a path (merge, not overwrite).',
  inputSchema: {
    type: 'object',
    properties: {
      project: { type: 'string', enum: ['dev', 'prod'] },
      path: { type: 'string' },
      data: { type: 'object' }
    },
    required: ['project', 'path', 'data']
  }
},
{
  name: 'firebase_delete',
  description: 'Delete data at a path. USE WITH CAUTION.',
  inputSchema: {
    type: 'object',
    properties: {
      project: { type: 'string', enum: ['dev', 'prod'] },
      path: { type: 'string' }
    },
    required: ['project', 'path']
  }
},
{
  name: 'firebase_export',
  description: 'Export all data at a path to JSON. Useful for backups.',
  inputSchema: {
    type: 'object',
    properties: {
      project: { type: 'string', enum: ['dev', 'prod'] },
      path: { type: 'string', description: 'Path to export (use "/" for entire database)' }
    },
    required: ['project', 'path']
  }
},
{
  name: 'firebase_import',
  description: 'Import JSON data to a path. Will overwrite existing data at that path.',
  inputSchema: {
    type: 'object',
    properties: {
      project: { type: 'string', enum: ['dev', 'prod'] },
      path: { type: 'string' },
      data: { type: 'object' }
    },
    required: ['project', 'path', 'data']
  }
},
{
  name: 'firebase_list_paths',
  description: 'List all child keys at a path (shallow read).',
  inputSchema: {
    type: 'object',
    properties: {
      project: { type: 'string', enum: ['dev', 'prod'] },
      path: { type: 'string' }
    },
    required: ['project', 'path']
  }
},
{
  name: 'firebase_sync_to_prod',
  description: 'Copy data from dev Firebase to prod Firebase at a given path. Creates backup first.',
  inputSchema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Path to sync (use "/" for entire database)' },
      createBackup: { type: 'boolean', default: true }
    },
    required: ['path']
  }
}
```

### Dependencies to Add
```json
// Add to tools/mcp-server/package.json
{
  "dependencies": {
    "firebase-admin": "^13.0.0"
  }
}
```

---

## Part 3: Set Up Test VM

### Option A: Dedicated Test VM (Recommended)
- Create new small EC2 instance (t3.micro)
- Tag as `gymnastics-test-vm`
- Install nginx to serve static builds
- Configure to serve on port 80

### Test VM Setup Script
```bash
# On the test VM
sudo apt update
sudo apt install -y nginx

# Create directory for builds
sudo mkdir -p /var/www/gymnastics-test
sudo chown ubuntu:ubuntu /var/www/gymnastics-test

# Configure nginx
sudo tee /etc/nginx/sites-available/gymnastics-test << 'EOF'
server {
    listen 80;
    server_name _;
    root /var/www/gymnastics-test;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/gymnastics-test /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

### MCP Tool for Deployment
```javascript
{
  name: 'deploy_to_test_vm',
  description: 'Build the app with dev Firebase config and deploy to test VM.',
  inputSchema: {
    type: 'object',
    properties: {
      skipBuild: { type: 'boolean', default: false }
    }
  }
}
```

---

## Part 4: Environment-Based Firebase Config

### Update show-controller/src/lib/firebase.js

```javascript
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, update, remove, onValue, push } from 'firebase/database';

// Production config (default)
const prodConfig = {
  apiKey: "AIzaSyCh0aZUvKl6Qvqsva3hvOgJJlleP1OwcTY",
  authDomain: "gymnastics-graphics.firebaseapp.com",
  databaseURL: "https://gymnastics-graphics-default-rtdb.firebaseio.com",
  projectId: "gymnastics-graphics",
  storageBucket: "gymnastics-graphics.firebasestorage.app",
  messagingSenderId: "702072609550",
  appId: "1:702072609550:web:ac74a811186d3ff45b955f"
};

// Dev config (for testing)
const devConfig = {
  apiKey: "TO_BE_FILLED_AFTER_PROJECT_CREATION",
  authDomain: "gymnastics-graphics-dev.firebaseapp.com",
  databaseURL: "https://gymnastics-graphics-dev-default-rtdb.firebaseio.com",
  projectId: "gymnastics-graphics-dev",
  storageBucket: "gymnastics-graphics-dev.firebasestorage.app",
  messagingSenderId: "TO_BE_FILLED",
  appId: "TO_BE_FILLED"
};

// Use dev config if VITE_FIREBASE_ENV=dev, otherwise prod
const firebaseConfig = import.meta.env.VITE_FIREBASE_ENV === 'dev'
  ? devConfig
  : prodConfig;

console.log(`[Firebase] Using ${import.meta.env.VITE_FIREBASE_ENV === 'dev' ? 'DEV' : 'PROD'} database`);

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export { db, ref, set, get, update, remove, onValue, push };
```

---

## Part 5: Ralph Wiggum Integration

### The Complete Loop

```
┌────────────────────────────────────────────────────────────────────┐
│                    RALPH WIGGUM AUTONOMOUS LOOP                    │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  1. READ activity.md - understand current state                    │
│                                                                    │
│  2. PICK next task from PRD                                        │
│                                                                    │
│  3. IMPLEMENT                                                      │
│     ├── Code changes (Git - dev branch)                            │
│     └── Data structure changes (firebase_set on dev)               │
│                                                                    │
│  4. DEPLOY TO TEST VM                                              │
│     ├── Build with VITE_FIREBASE_ENV=dev                           │
│     └── SCP to test VM via ssh_upload_file                         │
│                                                                    │
│  5. VERIFY WITH PLAYWRIGHT                                         │
│     ├── browser_navigate to http://<TEST_VM_IP>                    │
│     ├── browser_snapshot to check structure                        │
│     ├── browser_take_screenshot for visual check                   │
│     ├── browser_console_messages for errors                        │
│     └── Compare UI state vs firebase_get data                      │
│                                                                    │
│  6. ITERATE if issues found (back to step 3)                       │
│                                                                    │
│  7. MARK COMPLETE when verified                                    │
│     ├── Update activity.md                                         │
│     ├── Commit to dev branch                                       │
│     └── Mark task as passes: true                                  │
│                                                                    │
│  8. WHEN ALL TASKS DONE - DEPLOY TO PRODUCTION                     │
│     ├── Merge dev → main (Netlify auto-deploys)                    │
│     ├── firebase_sync_to_prod "/" (sync data structure)            │
│     └── Verify production with Playwright                          │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### CLAUDE.md Additions

```markdown
## MCP Server Capabilities

### AWS Tools
- `aws_list_instances` - List EC2 instances
- `aws_start_instance` / `aws_stop_instance` - Control instances
- `aws_create_ami` / `aws_list_amis` - Manage AMIs

### SSH Tools
- `ssh_exec` - Run command on a VM
- `ssh_multi_exec` - Run command on multiple VMs
- `ssh_upload_file` / `ssh_download_file` - Transfer files

### Firebase Tools
- `firebase_get` - Read data from dev or prod
- `firebase_set` - Write data (overwrite)
- `firebase_update` - Partial update (merge)
- `firebase_delete` - Remove data
- `firebase_export` - Backup data to JSON
- `firebase_import` - Restore data from JSON
- `firebase_list_paths` - Explore database structure
- `firebase_sync_to_prod` - Copy dev → prod

### Playwright Tools (Visual Verification)
- `browser_navigate` - Go to URL
- `browser_snapshot` - Get page structure (accessibility tree)
- `browser_take_screenshot` - Visual capture
- `browser_click` - Interact with elements
- `browser_console_messages` - Check for JS errors

## Testing Workflow

### For Feature Development:
1. Code on `dev` branch
2. Data changes via `firebase_set dev /path {...}`
3. Deploy to test VM (build + SCP)
4. Verify at `http://<TEST_VM_IP>`
5. Iterate until working

### For Production Release:
1. All features verified on test VM
2. `git checkout main && git merge dev && git push` (triggers Netlify)
3. `firebase_sync_to_prod "/"` (copies dev data to prod)
4. Verify at production URL

### Test VM
- URL: `http://<TEST_VM_IP>` (to be configured)
- Serves builds with dev Firebase config
- Safe to experiment - no impact on production
```

---

## Part 6: Implementation Checklist

### Phase 1: Firebase Setup (User Action)
- [ ] Create `gymnastics-graphics-dev` Firebase project
- [ ] Enable Realtime Database in dev project
- [ ] Create web app and get config
- [ ] Create service account for dev project
- [ ] Create service account for prod project
- [ ] Share configs/credentials with Claude

### Phase 2: MCP Server Updates (Claude)
- [ ] Add `firebase-admin` to package.json
- [ ] Implement Firebase initialization (dual project)
- [ ] Implement `firebase_get`
- [ ] Implement `firebase_set`
- [ ] Implement `firebase_update`
- [ ] Implement `firebase_delete`
- [ ] Implement `firebase_export`
- [ ] Implement `firebase_import`
- [ ] Implement `firebase_list_paths`
- [ ] Implement `firebase_sync_to_prod`
- [ ] Test all tools

### Phase 3: Test VM Setup (Claude via MCP)
- [ ] Create test VM instance (or designate existing)
- [ ] Install nginx
- [ ] Configure static file serving
- [ ] Add `deploy_to_test_vm` MCP tool
- [ ] Test deployment pipeline

### Phase 4: Frontend Config (Claude)
- [ ] Update firebase.js with environment switching
- [ ] Test build with `VITE_FIREBASE_ENV=dev`
- [ ] Verify connects to dev Firebase

### Phase 5: Documentation (Claude)
- [ ] Update CLAUDE.md with new capabilities
- [ ] Document Ralph Wiggum workflow
- [ ] Create example PRD task format

---

## Questions Before Starting

1. **Ready to create the dev Firebase project?**

2. **Service accounts**: For the MCP server to write to Firebase, we need service account JSON files. Do you have these, or should I guide you through creating them?

3. **Test VM**: Create new t3.micro (~$0.01/hr), or use existing instance?

4. **Netlify env var**: Set `VITE_FIREBASE_ENV=prod` explicitly in Netlify to be safe?
