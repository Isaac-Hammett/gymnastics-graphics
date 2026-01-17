# PRD: MCP Server & Infrastructure Testing

## Executive Summary

This document outlines a comprehensive testing strategy for the custom MCP server (`tools/mcp-server/index.js`) and the underlying server infrastructure. The MCP server provides Claude Code with 18 tools across three domains: AWS EC2 management, SSH operations, and Firebase database access. Testing ensures these tools work reliably before production use.

---

## Current State

### MCP Server Tools (18 total)

**AWS Tools (8)**
| Tool | Description |
|------|-------------|
| `aws_list_instances` | List EC2 instances tagged `Project: gymnastics-graphics` |
| `aws_start_instance` | Start a stopped EC2 instance |
| `aws_stop_instance` | Stop a running EC2 instance |
| `aws_create_ami` | Create AMI from instance |
| `aws_list_amis` | List gymnastics-related AMIs |
| `aws_list_security_group_rules` | List inbound rules for security group |
| `aws_open_port` | Open port in security group |
| `aws_close_port` | Close port in security group |

**SSH Tools (4)**
| Tool | Description |
|------|-------------|
| `ssh_exec` | Execute command on VM (supports `"coordinator"` shortcut) |
| `ssh_multi_exec` | Execute command on multiple VMs |
| `ssh_upload_file` | Upload file to VM via SCP |
| `ssh_download_file` | Download file from VM via SCP |

**Firebase Tools (7)**
| Tool | Description |
|------|-------------|
| `firebase_get` | Read data at path |
| `firebase_set` | Write data (overwrite) |
| `firebase_update` | Partial update (merge) |
| `firebase_delete` | Delete data at path |
| `firebase_list_paths` | List child keys (shallow) |
| `firebase_export` | Export data to JSON |
| `firebase_sync_to_prod` | Copy dev → prod with backup |

### Existing Test Files

There are 17 standalone test files (`test-mcp-01.mjs` through `test-mcp-20.mjs`, with gaps) that duplicate MCP server logic and test it directly. These were created during initial development.

### Infrastructure Components

**Coordinator VM** (44.193.31.120)
- Instance: `i-001383a4293522fa4` (t3.small)
- Services: Coordinator API on port 3001
- PM2 managed: `ecosystem.config.js`
- Auto-shutdown: 120 min idle

**Security Group**: `sg-025f1ac53cccb756b` (gymnastics-vm-pool)

**Firebase Projects**:
- Dev: `gymnastics-graphics-dev`
- Prod: `gymnastics-graphics`

---

## Testing Strategy

### Test Categories

#### Category 1: Unit Tests (No External Dependencies)
Tests that validate internal logic without hitting real AWS/SSH/Firebase.

| Test ID | Tool | Description |
|---------|------|-------------|
| UNIT-01 | `resolveTarget()` | Verify "coordinator" → IP resolution |
| UNIT-02 | Input validation | Verify required parameters are checked |
| UNIT-03 | Error formatting | Verify errors return proper MCP format |

#### Category 2: Integration Tests (Dev Environment Only)
Tests that hit real services but use dev/test resources only.

**AWS Integration Tests**
| Test ID | Tool | Description | Safe? |
|---------|------|-------------|-------|
| AWS-01 | `aws_list_instances` | List instances, verify structure | ✅ Read-only |
| AWS-02 | `aws_list_instances` | Filter by state (running/stopped) | ✅ Read-only |
| AWS-03 | `aws_list_amis` | List AMIs, verify structure | ✅ Read-only |
| AWS-04 | `aws_list_security_group_rules` | List security group rules | ✅ Read-only |
| AWS-05 | `aws_start_instance` | Start stopped test VM (if available) | ⚠️ Modifying |
| AWS-06 | `aws_stop_instance` | Stop running test VM (if available) | ⚠️ Modifying |
| AWS-07 | `aws_start_instance` | Error handling: invalid instance ID | ✅ Error path |
| AWS-08 | `aws_open_port` / `aws_close_port` | Open then close test port (9999) | ⚠️ Modifying |

**SSH Integration Tests**
| Test ID | Tool | Description | Safe? |
|---------|------|-------------|-------|
| SSH-01 | `ssh_exec` | Basic command: `echo hello` | ✅ Read-only |
| SSH-02 | `ssh_exec` | System info: `uname -a` | ✅ Read-only |
| SSH-03 | `ssh_exec` | Sudo command: `whoami` | ✅ Read-only |
| SSH-04 | `ssh_exec` | Direct IP targeting | ✅ Read-only |
| SSH-05 | `ssh_exec` | Service status check | ✅ Read-only |
| SSH-06 | `ssh_exec` | Error handling: invalid target | ✅ Error path |
| SSH-07 | `ssh_exec` | Error handling: failed command | ✅ Error path |
| SSH-08 | `ssh_multi_exec` | Single target | ✅ Read-only |
| SSH-09 | `ssh_multi_exec` | Multiple targets | ✅ Read-only |
| SSH-10 | `ssh_upload_file` / `ssh_download_file` | Round-trip file transfer | ⚠️ Modifying |
| SSH-11 | `ssh_exec` | Command latency measurement | ✅ Read-only |
| SSH-12 | `ssh_exec` | Network connectivity check | ✅ Read-only |

**Firebase Integration Tests**
| Test ID | Tool | Description | Safe? |
|---------|------|-------------|-------|
| FB-01 | `firebase_get` | Read existing path (dev) | ✅ Read-only |
| FB-02 | `firebase_get` | Read non-existent path (dev) | ✅ Read-only |
| FB-03 | `firebase_list_paths` | List children at path (dev) | ✅ Read-only |
| FB-04 | `firebase_set` | Write to test path (dev) | ⚠️ Modifying (dev only) |
| FB-05 | `firebase_update` | Partial update test path (dev) | ⚠️ Modifying (dev only) |
| FB-06 | `firebase_delete` | Delete test path (dev) | ⚠️ Modifying (dev only) |
| FB-07 | `firebase_export` | Export path to JSON (dev) | ✅ Read-only |
| FB-08 | `firebase_get` | Read from prod (verify access) | ✅ Read-only |
| FB-09 | `firebase_sync_to_prod` | Dry-run test (don't actually sync) | ✅ Read-only |
| FB-10 | Error handling | Invalid project name | ✅ Error path |
| FB-11 | Error handling | Invalid path format | ✅ Error path |

#### Category 3: End-to-End Workflow Tests
Tests that verify complete workflows.

| Test ID | Workflow | Description |
|---------|----------|-------------|
| E2E-01 | VM Diagnostics | List instances → SSH to coordinator → check service status |
| E2E-02 | Deployment Check | SSH → verify nginx running → check app files exist |
| E2E-03 | Firebase CRUD | Set → Get → Update → Get → Delete → Verify deleted |
| E2E-04 | VM Lifecycle | Start instance → wait → verify running → stop → verify stopped |

---

## Test Implementation Plan

### Phase 1: Test Framework Setup

**Objective**: Create a proper test framework instead of standalone files

**Tasks**:
- [ ] Install test framework (Vitest or Node test runner)
- [ ] Create `tools/mcp-server/__tests__/` directory structure
- [ ] Add test configuration to `package.json`
- [ ] Create test utilities for common operations
- [ ] Create mock helpers for AWS/SSH/Firebase

**Directory Structure**:
```
tools/mcp-server/
├── __tests__/
│   ├── unit/
│   │   ├── resolveTarget.test.js
│   │   ├── inputValidation.test.js
│   │   └── errorFormatting.test.js
│   ├── integration/
│   │   ├── aws.test.js
│   │   ├── ssh.test.js
│   │   └── firebase.test.js
│   ├── e2e/
│   │   ├── vmDiagnostics.test.js
│   │   ├── deployment.test.js
│   │   └── firebaseCrud.test.js
│   └── helpers/
│       ├── testConfig.js
│       └── mockFactories.js
├── index.js
├── package.json
└── README.md
```

**package.json additions**:
```json
{
  "scripts": {
    "test": "node --test __tests__/**/*.test.js",
    "test:unit": "node --test __tests__/unit/*.test.js",
    "test:integration": "node --test __tests__/integration/*.test.js",
    "test:e2e": "node --test __tests__/e2e/*.test.js",
    "test:safe": "node --test __tests__/unit/*.test.js __tests__/integration/readonly.test.js"
  },
  "devDependencies": {
    "@types/node": "^20.0.0"
  }
}
```

---

### Phase 2: Unit Tests

**Objective**: Test internal logic without external dependencies

#### UNIT-01: resolveTarget()

```javascript
// __tests__/unit/resolveTarget.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('resolveTarget', () => {
  it('resolves "coordinator" to coordinator IP', () => {
    const result = resolveTarget('coordinator');
    assert.strictEqual(result, '44.193.31.120');
  });

  it('passes through IP addresses unchanged', () => {
    const result = resolveTarget('10.0.0.1');
    assert.strictEqual(result, '10.0.0.1');
  });

  it('passes through hostnames unchanged', () => {
    const result = resolveTarget('my-server.local');
    assert.strictEqual(result, 'my-server.local');
  });
});
```

#### UNIT-02: Input Validation

```javascript
// __tests__/unit/inputValidation.test.js
describe('input validation', () => {
  it('aws_start_instance requires instanceId', async () => {
    const result = await callTool('aws_start_instance', {});
    assert(result.isError);
    assert(result.content[0].text.includes('instanceId'));
  });

  it('firebase_get requires project and path', async () => {
    const result = await callTool('firebase_get', { project: 'dev' });
    assert(result.isError);
    assert(result.content[0].text.includes('path'));
  });

  it('firebase_get rejects invalid project', async () => {
    const result = await callTool('firebase_get', { project: 'invalid', path: '/' });
    assert(result.isError);
    assert(result.content[0].text.includes('dev'));
  });
});
```

---

### Phase 3: Integration Tests

**Objective**: Test real interactions with dev/test resources

#### AWS Integration Tests

```javascript
// __tests__/integration/aws.test.js
import { describe, it, before } from 'node:test';
import assert from 'node:assert';

describe('AWS Integration', () => {
  describe('aws_list_instances', () => {
    it('returns array of instances', async () => {
      const result = await callMcpTool('aws_list_instances', {});
      const data = JSON.parse(result.content[0].text);

      assert(Array.isArray(data));
    });

    it('instances have required fields', async () => {
      const result = await callMcpTool('aws_list_instances', {});
      const instances = JSON.parse(result.content[0].text);

      for (const inst of instances) {
        assert(inst.instanceId, 'missing instanceId');
        assert(inst.name, 'missing name');
        assert(inst.state, 'missing state');
        assert(inst.instanceType, 'missing instanceType');
        assert(/^i-[a-f0-9]+$/.test(inst.instanceId), 'invalid instanceId format');
      }
    });

    it('filters by state', async () => {
      const result = await callMcpTool('aws_list_instances', { stateFilter: 'running' });
      const instances = JSON.parse(result.content[0].text);

      for (const inst of instances) {
        assert.strictEqual(inst.state, 'running');
      }
    });
  });

  describe('aws_list_amis', () => {
    it('returns array of AMIs', async () => {
      const result = await callMcpTool('aws_list_amis', {});
      const amis = JSON.parse(result.content[0].text);

      assert(Array.isArray(amis));
    });

    it('AMIs have required fields', async () => {
      const result = await callMcpTool('aws_list_amis', {});
      const amis = JSON.parse(result.content[0].text);

      for (const ami of amis) {
        assert(ami.amiId, 'missing amiId');
        assert(ami.name, 'missing name');
        assert(/^ami-[a-f0-9]+$/.test(ami.amiId), 'invalid amiId format');
      }
    });
  });

  describe('aws_list_security_group_rules', () => {
    it('returns security group info', async () => {
      const result = await callMcpTool('aws_list_security_group_rules', {});
      const data = JSON.parse(result.content[0].text);

      assert(data.securityGroupId);
      assert(Array.isArray(data.inboundRules));
    });
  });

  describe('error handling', () => {
    it('handles invalid instance ID gracefully', async () => {
      const result = await callMcpTool('aws_start_instance', {
        instanceId: 'i-invalid12345'
      });

      assert(result.isError);
      const data = JSON.parse(result.content[0].text);
      assert(data.error);
    });
  });
});
```

#### SSH Integration Tests

```javascript
// __tests__/integration/ssh.test.js
describe('SSH Integration', () => {
  describe('ssh_exec', () => {
    it('executes basic command', async () => {
      const result = await callMcpTool('ssh_exec', {
        target: 'coordinator',
        command: 'echo hello'
      });
      const data = JSON.parse(result.content[0].text);

      assert(data.success);
      assert.strictEqual(data.exitCode, 0);
      assert(data.stdout.includes('hello'));
    });

    it('returns system info', async () => {
      const result = await callMcpTool('ssh_exec', {
        target: 'coordinator',
        command: 'uname -a'
      });
      const data = JSON.parse(result.content[0].text);

      assert(data.success);
      assert(data.stdout.includes('Linux'));
    });

    it('handles sudo commands', async () => {
      const result = await callMcpTool('ssh_exec', {
        target: 'coordinator',
        command: 'whoami',
        sudo: true
      });
      const data = JSON.parse(result.content[0].text);

      assert(data.success);
      assert(data.stdout.includes('root'));
    });

    it('reports command failures', async () => {
      const result = await callMcpTool('ssh_exec', {
        target: 'coordinator',
        command: 'exit 42'
      });
      const data = JSON.parse(result.content[0].text);

      assert.strictEqual(data.success, false);
      assert.strictEqual(data.exitCode, 42);
    });

    it('handles connection errors', async () => {
      const result = await callMcpTool('ssh_exec', {
        target: '192.168.255.255',
        command: 'echo test'
      });

      assert(result.isError);
    });
  });

  describe('ssh_multi_exec', () => {
    it('executes on multiple targets', async () => {
      const result = await callMcpTool('ssh_multi_exec', {
        targets: ['coordinator'],
        command: 'hostname'
      });
      const data = JSON.parse(result.content[0].text);

      assert.strictEqual(data.successCount, 1);
      assert(Array.isArray(data.results));
    });
  });

  describe('ssh_upload_file / ssh_download_file', () => {
    it('round-trips a file', async () => {
      const testContent = `test-${Date.now()}`;
      const localPath = '/tmp/claude/mcp-test-upload.txt';
      const remotePath = '/tmp/mcp-test-file.txt';
      const downloadPath = '/tmp/claude/mcp-test-download.txt';

      // Write local test file
      writeFileSync(localPath, testContent);

      // Upload
      const uploadResult = await callMcpTool('ssh_upload_file', {
        target: 'coordinator',
        localPath,
        remotePath
      });
      assert(JSON.parse(uploadResult.content[0].text).success);

      // Download
      const downloadResult = await callMcpTool('ssh_download_file', {
        target: 'coordinator',
        remotePath,
        localPath: downloadPath
      });
      assert(JSON.parse(downloadResult.content[0].text).success);

      // Verify
      const downloaded = readFileSync(downloadPath, 'utf8');
      assert.strictEqual(downloaded, testContent);

      // Cleanup
      await callMcpTool('ssh_exec', {
        target: 'coordinator',
        command: `rm ${remotePath}`
      });
    });
  });
});
```

#### Firebase Integration Tests

```javascript
// __tests__/integration/firebase.test.js
describe('Firebase Integration', () => {
  const TEST_PATH = 'mcp-tests/' + Date.now();

  describe('firebase_get', () => {
    it('reads existing data', async () => {
      const result = await callMcpTool('firebase_get', {
        project: 'dev',
        path: '/'
      });
      const data = JSON.parse(result.content[0].text);

      assert.strictEqual(data.project, 'dev');
      assert(data.exists !== undefined);
    });

    it('handles non-existent path', async () => {
      const result = await callMcpTool('firebase_get', {
        project: 'dev',
        path: '/nonexistent/path/12345'
      });
      const data = JSON.parse(result.content[0].text);

      assert.strictEqual(data.exists, false);
      assert.strictEqual(data.data, null);
    });
  });

  describe('firebase_list_paths', () => {
    it('lists children at path', async () => {
      const result = await callMcpTool('firebase_list_paths', {
        project: 'dev',
        path: '/'
      });
      const data = JSON.parse(result.content[0].text);

      assert(Array.isArray(data.children));
      assert(typeof data.childCount === 'number');
    });
  });

  describe('CRUD operations (dev only)', () => {
    it('writes, reads, updates, and deletes data', async () => {
      // SET
      const setResult = await callMcpTool('firebase_set', {
        project: 'dev',
        path: TEST_PATH,
        data: { name: 'test', value: 1 }
      });
      assert(JSON.parse(setResult.content[0].text).success);

      // GET
      const getResult = await callMcpTool('firebase_get', {
        project: 'dev',
        path: TEST_PATH
      });
      const getData = JSON.parse(getResult.content[0].text);
      assert.strictEqual(getData.data.name, 'test');
      assert.strictEqual(getData.data.value, 1);

      // UPDATE
      const updateResult = await callMcpTool('firebase_update', {
        project: 'dev',
        path: TEST_PATH,
        data: { value: 2 }
      });
      assert(JSON.parse(updateResult.content[0].text).success);

      // GET after UPDATE
      const getResult2 = await callMcpTool('firebase_get', {
        project: 'dev',
        path: TEST_PATH
      });
      const getData2 = JSON.parse(getResult2.content[0].text);
      assert.strictEqual(getData2.data.name, 'test'); // preserved
      assert.strictEqual(getData2.data.value, 2);     // updated

      // DELETE
      const deleteResult = await callMcpTool('firebase_delete', {
        project: 'dev',
        path: TEST_PATH
      });
      assert(JSON.parse(deleteResult.content[0].text).success);

      // VERIFY DELETED
      const getResult3 = await callMcpTool('firebase_get', {
        project: 'dev',
        path: TEST_PATH
      });
      assert.strictEqual(JSON.parse(getResult3.content[0].text).exists, false);
    });
  });

  describe('firebase_export', () => {
    it('exports data as JSON', async () => {
      const result = await callMcpTool('firebase_export', {
        project: 'dev',
        path: '/'
      });
      const data = JSON.parse(result.content[0].text);

      assert(data.exportedAt);
      assert(data.data !== undefined);
    });
  });

  describe('error handling', () => {
    it('rejects invalid project', async () => {
      const result = await callMcpTool('firebase_get', {
        project: 'invalid',
        path: '/'
      });

      assert(result.isError);
    });
  });
});
```

---

### Phase 4: End-to-End Tests

**Objective**: Test complete workflows

```javascript
// __tests__/e2e/vmDiagnostics.test.js
describe('E2E: VM Diagnostics', () => {
  it('performs full VM diagnostics workflow', async () => {
    // 1. List instances
    const listResult = await callMcpTool('aws_list_instances', {});
    const instances = JSON.parse(listResult.content[0].text);
    assert(instances.length > 0, 'No instances found');

    // 2. Find a running instance
    const runningInstance = instances.find(i => i.state === 'running');
    if (!runningInstance) {
      console.log('SKIP: No running instances available');
      return;
    }

    // 3. SSH to check service status
    const target = runningInstance.publicIp || 'coordinator';
    const statusResult = await callMcpTool('ssh_exec', {
      target,
      command: 'systemctl is-active nginx || echo "nginx not running"'
    });
    const statusData = JSON.parse(statusResult.content[0].text);
    assert(statusData.success);

    // 4. Check disk space
    const diskResult = await callMcpTool('ssh_exec', {
      target,
      command: 'df -h / | tail -1'
    });
    assert(JSON.parse(diskResult.content[0].text).success);

    // 5. Check memory
    const memResult = await callMcpTool('ssh_exec', {
      target,
      command: 'free -h | head -2'
    });
    assert(JSON.parse(memResult.content[0].text).success);

    console.log('VM Diagnostics workflow completed successfully');
  });
});
```

```javascript
// __tests__/e2e/deployment.test.js
describe('E2E: Deployment Verification', () => {
  it('verifies coordinator deployment', async () => {
    // 1. Check nginx is running
    const nginxResult = await callMcpTool('ssh_exec', {
      target: 'coordinator',
      command: 'systemctl is-active nginx'
    });
    const nginxData = JSON.parse(nginxResult.content[0].text);
    assert(nginxData.stdout.includes('active'));

    // 2. Check coordinator app is running
    const appResult = await callMcpTool('ssh_exec', {
      target: 'coordinator',
      command: 'pm2 list --no-color | grep coordinator || echo "not found"'
    });

    // 3. Check API health
    const healthResult = await callMcpTool('ssh_exec', {
      target: 'coordinator',
      command: 'curl -s http://localhost:3001/health || echo "health check failed"'
    });

    // 4. Check test server directory exists
    const dirResult = await callMcpTool('ssh_exec', {
      target: 'coordinator',
      command: 'ls -la /var/www/gymnastics-test/ 2>/dev/null | head -5 || echo "directory not found"'
    });

    console.log('Deployment verification completed');
  });
});
```

---

### Phase 5: Test Runner & CI Integration

**Objective**: Make tests easy to run and integrate with development workflow

**Test Commands**:
```bash
# Run all tests
npm test

# Run only safe read-only tests
npm run test:safe

# Run specific categories
npm run test:unit
npm run test:integration
npm run test:e2e

# Run with verbose output
npm test -- --test-reporter=spec
```

**Pre-commit Hook** (optional):
```bash
#!/bin/sh
# .git/hooks/pre-commit
cd tools/mcp-server
npm run test:safe
```

---

## Test Data & Fixtures

### Firebase Test Namespace

All Firebase tests should use the `mcp-tests/` prefix in dev:
- `mcp-tests/unit-tests/` - Unit test data
- `mcp-tests/integration/` - Integration test data
- Cleanup: Delete `mcp-tests/` after test runs

### AWS Test Resources

For modifying tests, use:
- **Test Port**: 9999 (for `aws_open_port`/`aws_close_port` tests)
- **Test Instance**: Any stopped VM from the pool (not coordinator)

### SSH Test Files

Test file locations:
- Local: `/tmp/claude/mcp-test-*`
- Remote: `/tmp/mcp-test-*`

---

## Requirements

### Functional Requirements

#### FR-1: Test Framework
- [ ] Install Node.js native test runner (no external deps)
- [ ] Create test directory structure
- [ ] Add npm scripts for running tests

#### FR-2: Unit Tests
- [ ] Test `resolveTarget()` function
- [ ] Test input validation for each tool
- [ ] Test error formatting

#### FR-3: AWS Integration Tests
- [ ] Test `aws_list_instances` with and without filter
- [ ] Test `aws_list_amis`
- [ ] Test `aws_list_security_group_rules`
- [ ] Test error handling for invalid instance IDs

#### FR-4: SSH Integration Tests
- [ ] Test `ssh_exec` basic commands
- [ ] Test `ssh_exec` with sudo
- [ ] Test `ssh_exec` error handling
- [ ] Test `ssh_multi_exec`
- [ ] Test file upload/download round-trip

#### FR-5: Firebase Integration Tests
- [ ] Test CRUD operations on dev
- [ ] Test `firebase_list_paths`
- [ ] Test `firebase_export`
- [ ] Test error handling

#### FR-6: E2E Tests
- [ ] Test VM diagnostics workflow
- [ ] Test deployment verification workflow
- [ ] Test Firebase CRUD workflow

#### FR-7: Cleanup Legacy Tests
- [ ] Remove standalone `test-mcp-*.mjs` files
- [ ] Preserve any useful test logic in new framework

### Non-Functional Requirements

#### NFR-1: Safety
- Read-only tests should not modify any resources
- Modifying tests should only affect test/dev resources
- Never modify production Firebase data
- Never start/stop coordinator VM during tests

#### NFR-2: Isolation
- Each test should clean up after itself
- Tests should not depend on each other
- Firebase test data uses isolated namespace

#### NFR-3: Performance
- Unit tests complete in < 1 second
- Integration tests complete in < 30 seconds
- E2E tests complete in < 2 minutes

#### NFR-4: Documentation
- Each test file should have clear descriptions
- Test output should be human-readable
- Failed tests should show clear error messages

---

## Implementation Order

1. **Phase 1**: Test framework setup (1-2 hours)
2. **Phase 2**: Unit tests (1 hour)
3. **Phase 3**: AWS integration tests (2 hours)
4. **Phase 4**: SSH integration tests (2 hours)
5. **Phase 5**: Firebase integration tests (2 hours)
6. **Phase 6**: E2E tests (2 hours)
7. **Phase 7**: Cleanup legacy tests (30 min)

**Total estimated time**: 10-12 hours

---

## Success Metrics

1. **Coverage**: All 18 MCP tools have at least one test
2. **Reliability**: Tests pass consistently (no flaky tests)
3. **Speed**: `npm run test:safe` completes in < 30 seconds
4. **Safety**: No test accidentally modifies production resources
5. **Usability**: Tests are easy to run and understand

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Tests hit production Firebase | High | Hardcode `project: 'dev'` in test config |
| Tests start/stop coordinator VM | Medium | Exclude coordinator from lifecycle tests |
| Network flakiness | Low | Add retry logic for integration tests |
| AWS rate limits | Low | Add delays between AWS calls |
| SSH key unavailable | Medium | Skip SSH tests with clear message |

---

## Appendix: Existing Test Coverage

The existing 17 standalone test files cover:

| Test File | Coverage |
|-----------|----------|
| test-mcp-01.mjs | `aws_list_instances` |
| test-mcp-02.mjs | `aws_list_instances` with filter |
| test-mcp-03.mjs | `aws_list_amis` |
| test-mcp-04.mjs | `ssh_exec` basic |
| test-mcp-05.mjs | `ssh_exec` with sudo |
| test-mcp-06.mjs | `ssh_exec` system info |
| test-mcp-07.mjs | `ssh_exec` service status |
| test-mcp-08.mjs | `ssh_exec` direct IP |
| test-mcp-09.mjs | `ssh_multi_exec` single target |
| test-mcp-10.mjs | `ssh_multi_exec` multiple targets |
| test-mcp-11.mjs | File upload/download |
| test-mcp-12.mjs | SSH error handling (invalid target) |
| test-mcp-13.mjs | AWS error handling (invalid instance) |
| test-mcp-14.mjs | SSH error handling (failed command) |
| test-mcp-15.mjs | `aws_start_instance` / `aws_stop_instance` |
| test-mcp-16.mjs | `aws_create_ami` |
| test-mcp-17.mjs | Full VM diagnostics |
| test-mcp-18.mjs | Coordinator deployment check |
| test-mcp-19.mjs | Network connectivity |
| test-mcp-20.mjs | SSH command latency |

These will be consolidated into the new test framework.

---

*Document Version: 1.0*
*Last Updated: January 2026*
*Status: Ready for Implementation*
