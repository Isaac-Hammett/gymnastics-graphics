# Show Control System - Activity Log

## Current Status
**Phase:** MCP Server Testing
**Last Task:** MCP-05 - Test ssh_exec with sudo on coordinator ✅
**Next Task:** MCP-07 - Test ssh_exec service status on coordinator
**Blocker:** None

---

## 2026-01-16

### MCP-01: Test aws_list_instances returns valid instance data
Tested the `aws_list_instances` MCP tool with no filter parameters.

**Results:**
- Returned 2 instances (both in stopped state)
- All required fields present: instanceId, name, state, instanceType
- Instance IDs match pattern `i-[a-f0-9]+`
- States are valid EC2 states

**Verification:** MCP-01 PASSED - Response contains 2 instances with valid structure

### MCP-02: Test aws_list_instances with state filter
Tested the `aws_list_instances` MCP tool with stateFilter parameter.

**Results:**
- stateFilter='running': Returned 0 instances (correct - no running instances)
- stateFilter='stopped': Returned 2 instances, both with state='stopped'
- All instances correctly filtered by state
- Instances: i-058b0d139756f034c (gymnastics-vm-template), i-08abea9194f19ddbd (gymnastics-vm-1768578923817)

**Verification:** MCP-02 PASSED - State filter correctly filters results

### MCP-03: Test aws_list_amis returns AMI catalog
Tested the `aws_list_amis` MCP tool with no parameters.

**Results:**
- Returned 3 AMIs (all in available state)
- All required fields present: amiId, name, state, creationDate
- All AMI IDs match pattern `ami-[a-f0-9]+`
- AMIs correctly sorted by creationDate descending
- Sample AMI data:
  - ami-01bdb25682977bb09 (gymnastics-vm-v2.1) - created: 2026-01-16T14:56:37.000Z
  - ami-01a93c8f425f37d39 (gymnastics-vm-v2.0) - created: 2026-01-15T22:13:50.000Z
  - ami-0cd400e38fe002902 (gymnastics-vm-v1.0) - created: 2026-01-14T22:11:24.000Z

**Verification:** MCP-03 PASSED - Response contains 3 AMIs with valid structure, sorted by date

### MCP-04: Test ssh_exec basic command on coordinator
Tested the `ssh_exec` MCP tool with basic command execution.

**Results:**
- Called ssh_exec with target='coordinator', command='echo hello'
- Response structure: target, command, exitCode, stdout, stderr, success - all present
- exitCode: 0 (expected: 0) ✓
- stdout: "hello" (expected: contains "hello") ✓
- success: true (expected: true) ✓
- Target resolved to IP: 44.193.31.120

**Verification:** MCP-04 PASSED - SSH exec returns successful result with correct output

### MCP-05: Test ssh_exec with sudo on coordinator - ❌ REVERTED
**Attempt:** 1 of 3

**Original Claim:** Used test script workaround, claimed PASS

**Error:** MCP tool `mcp__gymnastics__ssh_exec` was not available in session

**Root Cause:** MCP server connection issue - subagent couldn't access MCP tools

**Workaround Attempted:** Ran `tools/mcp-server/test-ssh-sudo.js` directly instead of calling the MCP tool

**Why This Is A Failure:** Task requires testing the MCP tool interface, not the underlying functionality. A workaround is NOT a pass.

**Status:** Reverted to `passes: false` - must be retried using actual MCP tool

### MCP-06: Test ssh_exec system info commands on coordinator
Tested the `ssh_exec` MCP tool with system information commands.

**Results:**

| Command | Exit Code | stdout | Status |
|---------|-----------|--------|--------|
| `hostname` | 0 | `ip-172-31-12-111` | ✓ |
| `uptime` | 0 | `02:54:59 up 1 day, 5:57, 1 user, load average: 0.00, 0.00, 0.00` | ✓ |
| `df -h /` | 0 | Root filesystem: 19G total, 2.8G used, 16G available (16%) | ✓ |

All three commands:
- Returned success: true
- Produced non-empty stdout with expected content
- Had exitCode: 0
- Had empty stderr (no errors)

**Verification:** MCP-06 PASSED - System info commands return valid data

### MCP-05: Test ssh_exec with sudo on coordinator - ❌ FAILED (Attempt 2)
**Attempt:** 2 of 3

**Error:** MCP tools not available in current Claude Code session

**Root Cause:** The MCP server (`mcp__gymnastics__*`) is not connected to this session. Tested by attempting to call:
- `mcp__gymnastics__ssh_exec` → "No such tool available"
- `mcp__gymnastics__aws_list_instances` → "No such tool available"
- `mcp__gymnastics__firebase_get` → "No such tool available"

All returned "Error: No such tool available", confirming the MCP server is not running or not connected.

**Workaround Attempted:** None - following strict verification rules, workarounds are not acceptable.

**Next Steps:**
1. User needs to verify MCP server is running: Check `tools/mcp-server/` is properly configured
2. User may need to restart Claude Code session to reload MCP tools
3. Verify MCP server configuration in Claude Code settings

### MCP-05: Test ssh_exec with sudo on coordinator ✅
**Attempt:** 3 of 3 (New session with MCP server connected)

Called `mcp__gymnastics__ssh_exec` MCP tool directly (not a test script):
- target: 'coordinator'
- command: 'whoami'
- sudo: true

**Results:**
| Field | Value | Expected | Status |
|-------|-------|----------|--------|
| target | 44.193.31.120 | coordinator resolved | ✓ |
| command | sudo whoami | - | ✓ |
| exitCode | 0 | 0 | ✓ |
| stdout | "root" | contains 'root' | ✓ |
| stderr | "" | - | ✓ |
| success | true | true | ✓ |

**Verification:** MCP-05 PASSED - Used actual MCP tool `mcp__gymnastics__ssh_exec` with sudo=true, stdout returned 'root'

---

## Issues & Blockers

| Issue | Task | Status | Resolution |
|-------|------|--------|------------|
| MCP server not connected | MCP-05 | RESOLVED | New session started with MCP server properly connected |

---

## Archive

For activity prior to 2026-01-16, see [activity-archive.md](activity-archive.md).
