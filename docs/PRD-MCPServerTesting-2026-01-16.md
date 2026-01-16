# PRD: MCP Server Testing Plan

**Version:** 1.0
**Date:** January 16, 2026
**Project:** Gymnastics Graphics - MCP Server Validation
**Status:** Draft
**Extends:** PRD-VMArchitecture-2026-01-14.md

---

## Overview

This document defines comprehensive tests for the Gymnastics MCP Server (`tools/mcp-server/index.js`). The MCP server provides Claude Code with direct access to AWS infrastructure and VM management via SSH.

### MCP Server Tools Under Test

| Tool | Category | Description |
|------|----------|-------------|
| `aws_list_instances` | AWS | List EC2 instances with optional state filter |
| `aws_start_instance` | AWS | Start a stopped EC2 instance |
| `aws_stop_instance` | AWS | Stop a running EC2 instance |
| `aws_create_ami` | AWS | Create AMI from instance |
| `aws_list_amis` | AWS | List gymnastics-related AMIs |
| `ssh_exec` | SSH | Execute command on single VM |
| `ssh_multi_exec` | SSH | Execute command on multiple VMs |
| `ssh_upload_file` | SSH | Upload file to VM via SCP |
| `ssh_download_file` | SSH | Download file from VM via SCP |

---

## Test Categories

### Category 1: AWS Read Operations (Non-Destructive)
Tests that query AWS state without modifying anything. Safe to run anytime.

### Category 2: AWS Write Operations (Destructive)
Tests that modify AWS state (start/stop instances, create AMIs). Require caution.

### Category 3: SSH Operations (Coordinator)
Tests that SSH to the coordinator VM (always-on). Safe to run anytime coordinator is running.

### Category 4: SSH Operations (Dynamic VMs)
Tests that SSH to dynamically assigned VMs. Require running VM.

### Category 5: File Transfer Operations
Tests for upload/download functionality.

### Category 6: Error Handling
Tests that verify proper error handling for edge cases.

---

## Test Execution Strategy

### Self-Testing via MCP Tools
Each test can be verified by Claude Code using the MCP tools directly:

```
Test Pattern:
1. Execute MCP tool with specific parameters
2. Verify response structure matches expected schema
3. Verify response content meets success criteria
4. Mark test as passed/failed
```

### Prerequisites
- AWS credentials configured (`~/.aws/credentials`)
- SSH key available (`~/.ssh/gymnastics-graphics-key-pair.pem`)
- At least one EC2 instance tagged with `Project: gymnastics-graphics`
- Coordinator VM running (44.193.31.120)

---

## Test Tasks (JSON Format for plan.md)

```json
[
  {
    "id": "MCP-01",
    "category": "mcp-aws-read",
    "description": "Test aws_list_instances returns valid instance data",
    "steps": [
      "Call aws_list_instances with no filter",
      "Verify response is an array",
      "Verify each instance has: instanceId, name, state, instanceType",
      "Verify instanceId matches pattern i-[a-f0-9]+",
      "Verify state is one of: running, stopped, pending, stopping, terminated"
    ],
    "verification": "Response contains at least 1 instance with valid structure",
    "passes": false
  },
  {
    "id": "MCP-02",
    "category": "mcp-aws-read",
    "description": "Test aws_list_instances with state filter",
    "steps": [
      "Call aws_list_instances with stateFilter='running'",
      "Verify all returned instances have state='running'",
      "Call aws_list_instances with stateFilter='stopped'",
      "Verify all returned instances have state='stopped'"
    ],
    "verification": "State filter correctly filters results",
    "passes": false
  },
  {
    "id": "MCP-03",
    "category": "mcp-aws-read",
    "description": "Test aws_list_amis returns AMI catalog",
    "steps": [
      "Call aws_list_amis with no parameters",
      "Verify response is an array",
      "Verify each AMI has: amiId, name, state, creationDate",
      "Verify amiId matches pattern ami-[a-f0-9]+",
      "Verify AMIs are sorted by creationDate descending"
    ],
    "verification": "Response contains AMIs with valid structure, sorted by date",
    "passes": false
  },
  {
    "id": "MCP-04",
    "category": "mcp-ssh-coordinator",
    "description": "Test ssh_exec basic command on coordinator",
    "steps": [
      "Call ssh_exec with target='coordinator', command='echo hello'",
      "Verify response has: target, command, exitCode, stdout, stderr, success",
      "Verify exitCode is 0",
      "Verify stdout contains 'hello'",
      "Verify success is true"
    ],
    "verification": "SSH exec returns successful result with correct output",
    "passes": false
  },
  {
    "id": "MCP-05",
    "category": "mcp-ssh-coordinator",
    "description": "Test ssh_exec with sudo on coordinator",
    "steps": [
      "Call ssh_exec with target='coordinator', command='whoami', sudo=true",
      "Verify stdout contains 'root'",
      "Verify success is true"
    ],
    "verification": "Sudo execution works and returns root user",
    "passes": false
  },
  {
    "id": "MCP-06",
    "category": "mcp-ssh-coordinator",
    "description": "Test ssh_exec system info commands on coordinator",
    "steps": [
      "Call ssh_exec with command='hostname'",
      "Verify stdout is non-empty",
      "Call ssh_exec with command='uptime'",
      "Verify stdout contains 'up' or 'load average'",
      "Call ssh_exec with command='df -h /'",
      "Verify stdout contains filesystem info"
    ],
    "verification": "System info commands return valid data",
    "passes": false
  },
  {
    "id": "MCP-07",
    "category": "mcp-ssh-coordinator",
    "description": "Test ssh_exec service status on coordinator",
    "steps": [
      "Call ssh_exec with command='systemctl is-active coordinator-server || echo inactive', sudo=true",
      "Verify response contains 'active' or 'inactive'",
      "Call ssh_exec with command='pm2 list --no-color'",
      "Verify stdout contains process information or 'No processes'"
    ],
    "verification": "Service status commands execute successfully",
    "passes": false
  },
  {
    "id": "MCP-08",
    "category": "mcp-ssh-coordinator",
    "description": "Test ssh_exec by IP address (not shortcut)",
    "steps": [
      "Call ssh_exec with target='44.193.31.120', command='echo test'",
      "Verify success is true",
      "Verify stdout contains 'test'"
    ],
    "verification": "Direct IP targeting works same as 'coordinator' shortcut",
    "passes": false
  },
  {
    "id": "MCP-09",
    "category": "mcp-ssh-multi",
    "description": "Test ssh_multi_exec on single target",
    "steps": [
      "Call ssh_multi_exec with targets=['coordinator'], command='hostname'",
      "Verify response has: command, results array, successCount, failureCount",
      "Verify results[0] has target and success=true",
      "Verify successCount is 1, failureCount is 0"
    ],
    "verification": "Multi-exec works with single target",
    "passes": false
  },
  {
    "id": "MCP-10",
    "category": "mcp-ssh-multi",
    "description": "Test ssh_multi_exec aggregation",
    "steps": [
      "Get list of running instances via aws_list_instances(stateFilter='running')",
      "Extract publicIp addresses from running instances",
      "Call ssh_multi_exec with all running IPs, command='echo ok'",
      "Verify successCount equals number of reachable VMs",
      "Verify each result has target IP and stdout='ok'"
    ],
    "verification": "Multi-exec aggregates results from multiple VMs",
    "passes": false
  },
  {
    "id": "MCP-11",
    "category": "mcp-file-transfer",
    "description": "Test ssh_upload_file and ssh_download_file roundtrip",
    "steps": [
      "Create a local test file with unique content",
      "Call ssh_upload_file to upload to /tmp/mcp-test-file.txt on coordinator",
      "Verify upload response has success=true",
      "Call ssh_exec to cat the uploaded file",
      "Verify file contents match original",
      "Call ssh_download_file to download to different local path",
      "Verify download response has success=true",
      "Compare downloaded file with original"
    ],
    "verification": "File upload and download preserve content integrity",
    "passes": false
  },
  {
    "id": "MCP-12",
    "category": "mcp-error-handling",
    "description": "Test error handling for invalid SSH target",
    "steps": [
      "Call ssh_exec with target='192.0.2.1' (TEST-NET, unreachable), command='echo test'",
      "Verify response indicates connection failure",
      "Verify error message is descriptive"
    ],
    "verification": "Invalid target returns proper error, not crash",
    "passes": false
  },
  {
    "id": "MCP-13",
    "category": "mcp-error-handling",
    "description": "Test error handling for invalid AWS instance ID",
    "steps": [
      "Call aws_start_instance with instanceId='i-invalid123456789'",
      "Verify response contains error",
      "Verify error message mentions invalid instance"
    ],
    "verification": "Invalid instance ID returns AWS error gracefully",
    "passes": false
  },
  {
    "id": "MCP-14",
    "category": "mcp-error-handling",
    "description": "Test error handling for failed SSH command",
    "steps": [
      "Call ssh_exec with target='coordinator', command='exit 1'",
      "Verify exitCode is 1",
      "Verify success is false",
      "Call ssh_exec with command='nonexistent-command-xyz123'",
      "Verify exitCode is non-zero",
      "Verify stderr contains error about command not found"
    ],
    "verification": "Failed commands return proper exit codes and success=false",
    "passes": false
  },
  {
    "id": "MCP-15",
    "category": "mcp-aws-write",
    "description": "Test aws_start_instance and aws_stop_instance lifecycle",
    "steps": [
      "Call aws_list_instances to find a stopped instance",
      "If no stopped instance, skip this test",
      "Call aws_start_instance with the instanceId",
      "Verify response has: instanceId, previousState='stopped', currentState='pending'",
      "Wait 60 seconds",
      "Call aws_list_instances to verify instance is running",
      "Call aws_stop_instance with the instanceId",
      "Verify response has currentState='stopping'",
      "Wait 60 seconds",
      "Call aws_list_instances to verify instance is stopped"
    ],
    "verification": "Instance lifecycle (start/stop) works correctly",
    "passes": false,
    "destructive": true,
    "cost_warning": "Starting/stopping instances incurs AWS charges"
  },
  {
    "id": "MCP-16",
    "category": "mcp-aws-write",
    "description": "Test aws_create_ami creates valid AMI",
    "steps": [
      "Call aws_list_instances to find a running instance",
      "Call aws_create_ami with instanceId and name='mcp-test-ami-TIMESTAMP'",
      "Verify response has: amiId matching ami-[a-f0-9]+, name, message",
      "Wait 30 seconds",
      "Call aws_list_amis",
      "Verify new AMI appears in list with state='pending' or 'available'"
    ],
    "verification": "AMI creation initiates successfully",
    "passes": false,
    "destructive": true,
    "cost_warning": "Creating AMIs incurs storage charges",
    "cleanup": "Manually delete test AMI after verification"
  },
  {
    "id": "MCP-17",
    "category": "mcp-integration",
    "description": "Test full VM diagnostics workflow",
    "steps": [
      "Call aws_list_instances(stateFilter='running')",
      "For the coordinator VM, verify it appears in list",
      "Call ssh_exec(target='coordinator', command='systemctl status pm2-ubuntu --no-pager')",
      "Call ssh_exec(target='coordinator', command='free -m')",
      "Call ssh_exec(target='coordinator', command='df -h')",
      "Call ssh_exec(target='coordinator', command='uptime')",
      "Aggregate results into VM health report"
    ],
    "verification": "Full diagnostics workflow executes without errors",
    "passes": false
  },
  {
    "id": "MCP-18",
    "category": "mcp-integration",
    "description": "Test coordinator app deployment check",
    "steps": [
      "Call ssh_exec(target='coordinator', command='ls -la /opt/gymnastics-graphics')",
      "Verify directory exists",
      "Call ssh_exec(target='coordinator', command='cat /opt/gymnastics-graphics/server/package.json | head -5')",
      "Verify package.json contains expected app name",
      "Call ssh_exec(target='coordinator', command='pm2 describe coordinator --no-color')",
      "Verify PM2 process info or appropriate status"
    ],
    "verification": "Coordinator deployment structure is correct",
    "passes": false
  },
  {
    "id": "MCP-19",
    "category": "mcp-integration",
    "description": "Test network connectivity from coordinator",
    "steps": [
      "Call ssh_exec(target='coordinator', command='curl -s -o /dev/null -w \"%{http_code}\" https://api.github.com')",
      "Verify stdout is '200' (GitHub API reachable)",
      "Call ssh_exec(target='coordinator', command='curl -s -o /dev/null -w \"%{http_code}\" http://localhost:3001/api/status || echo unreachable')",
      "Record whether local API is running"
    ],
    "verification": "Coordinator has internet and local service connectivity",
    "passes": false
  },
  {
    "id": "MCP-20",
    "category": "mcp-performance",
    "description": "Test SSH command latency",
    "steps": [
      "Record start time",
      "Call ssh_exec(target='coordinator', command='echo test') 5 times",
      "Record end time",
      "Calculate average latency per command",
      "Verify average latency is under 5 seconds"
    ],
    "verification": "SSH commands complete within acceptable latency",
    "passes": false
  }
]
```

---

## Test Execution Notes

### Safe Tests (Can Run Anytime)
- MCP-01 through MCP-14 (read operations and error handling)
- MCP-17 through MCP-20 (integration and performance)

### Destructive Tests (Require Caution)
- MCP-15: Start/Stop Instance - Only run on test instances, not production
- MCP-16: Create AMI - Creates billable resource, requires cleanup

### Prerequisites Verification

Before running tests, verify:

1. **AWS Credentials**
   ```bash
   aws sts get-caller-identity
   ```

2. **SSH Key Exists**
   ```bash
   ls -la ~/.ssh/gymnastics-graphics-key-pair.pem
   ```

3. **Coordinator Reachable**
   ```bash
   ping -c 1 44.193.31.120
   ```

---

## Success Criteria

| Category | Tests | Required Pass Rate |
|----------|-------|-------------------|
| AWS Read | 3 | 100% |
| SSH Coordinator | 5 | 100% |
| SSH Multi | 2 | 100% |
| File Transfer | 1 | 100% |
| Error Handling | 3 | 100% |
| AWS Write | 2 | 80% (may skip if no test instances) |
| Integration | 3 | 100% |
| Performance | 1 | 100% |

**Overall Target:** 95% pass rate (19/20 tests)

---

## Automated Test Runner

To run these tests automatically, Claude Code can:

1. Read this PRD
2. Execute each test using MCP tools
3. Record results
4. Update `passes` field in plan.md
5. Generate summary report

### Example Test Execution Script (Conceptual)

```javascript
// This would be executed by Claude Code using MCP tools

async function runMCPTests() {
  const results = [];

  // MCP-01: Test aws_list_instances
  const instances = await mcp.aws_list_instances({});
  const test01 = {
    id: 'MCP-01',
    passed: Array.isArray(instances) &&
            instances.length > 0 &&
            instances.every(i => i.instanceId && i.state)
  };
  results.push(test01);

  // ... continue for all tests

  return results;
}
```

---

## Appendix: Expected Response Schemas

### aws_list_instances Response
```json
[
  {
    "instanceId": "i-0abc123def456789",
    "name": "gymnastics-coordinator",
    "state": "running",
    "publicIp": "44.193.31.120",
    "privateIp": "172.31.9.204",
    "instanceType": "t3.small",
    "launchTime": "2026-01-15T10:30:00.000Z"
  }
]
```

### ssh_exec Response
```json
{
  "target": "44.193.31.120",
  "command": "echo hello",
  "exitCode": 0,
  "stdout": "hello\n",
  "stderr": "",
  "success": true
}
```

### ssh_multi_exec Response
```json
{
  "command": "hostname",
  "results": [
    { "target": "44.193.31.120", "exitCode": 0, "stdout": "coordinator\n", "success": true },
    { "target": "44.197.188.85", "exitCode": 0, "stdout": "vm-001\n", "success": true }
  ],
  "successCount": 2,
  "failureCount": 0
}
```

---

*Document generated for MCP Server testing*
*Last updated: January 16, 2026*
