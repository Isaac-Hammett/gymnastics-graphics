# Gymnastics MCP Server

MCP (Model Context Protocol) server that gives Claude Code direct access to your AWS infrastructure and VMs via SSH.

## What This Does

This server provides Claude Code with tools to:

- **AWS Operations**
  - List EC2 instances and their status
  - Start/stop instances
  - Create AMIs from instances
  - List existing AMIs

- **SSH Operations**
  - Execute commands on any VM
  - Run commands on multiple VMs at once
  - Upload/download files

## Setup

### 1. Install Dependencies

```bash
cd tools/mcp-server
npm install
```

### 2. Configure AWS Credentials

Since you haven't used AWS CLI before, you need to set up credentials:

#### Option A: Create credentials file (Recommended)

1. Go to AWS Console → IAM → Users → Your User → Security credentials
2. Click "Create access key"
3. Save the Access Key ID and Secret Access Key

4. Create the AWS credentials file:

```bash
mkdir -p ~/.aws

cat > ~/.aws/credentials << 'EOF'
[default]
aws_access_key_id = YOUR_ACCESS_KEY_ID
aws_secret_access_key = YOUR_SECRET_ACCESS_KEY
EOF

cat > ~/.aws/config << 'EOF'
[default]
region = us-east-1
output = json
EOF

chmod 600 ~/.aws/credentials
```

#### Option B: Use environment variables

Add to your `~/.zshrc` or `~/.bashrc`:

```bash
export AWS_ACCESS_KEY_ID=your-access-key-id
export AWS_SECRET_ACCESS_KEY=your-secret-access-key
export AWS_REGION=us-east-1
```

### 3. Verify SSH Key

Make sure your SSH key is at the expected location:

```bash
ls -la ~/.ssh/gymnastics-graphics-key-pair.pem
```

If it's somewhere else, update `CONFIG.sshKeyPath` in `index.js`.

### 4. Configure Claude Code to Use This MCP Server

Add to your Claude Code settings. You can do this in one of two ways:

#### Option A: Project-level (recommended)

Create or edit `.claude/settings.json` in this project:

```json
{
  "mcpServers": {
    "gymnastics": {
      "command": "node",
      "args": ["/Users/juliacosmiano/code/gymnastics-graphics/tools/mcp-server/index.js"]
    }
  }
}
```

#### Option B: Global settings

Edit `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "gymnastics": {
      "command": "node",
      "args": ["/Users/juliacosmiano/code/gymnastics-graphics/tools/mcp-server/index.js"]
    }
  }
}
```

### 5. Restart Claude Code

After configuring the MCP server, restart Claude Code for the changes to take effect.

## Available Tools

### AWS Tools

| Tool | Description |
|------|-------------|
| `aws_list_instances` | List all EC2 instances tagged for gymnastics-graphics |
| `aws_start_instance` | Start a stopped instance |
| `aws_stop_instance` | Stop a running instance |
| `aws_create_ami` | Create an AMI from an instance |
| `aws_list_amis` | List gymnastics-related AMIs |

### SSH Tools

| Tool | Description |
|------|-------------|
| `ssh_exec` | Execute a command on a VM (use "coordinator" as shortcut) |
| `ssh_multi_exec` | Execute same command on multiple VMs |
| `ssh_upload_file` | Upload a file to a VM |
| `ssh_download_file` | Download a file from a VM |

## Example Usage

Once configured, Claude Code can do things like:

```
"Check why OBS isn't starting on the VM at 34.229.162.231"

Claude will:
1. ssh_exec(target: "34.229.162.231", command: "systemctl status obs-headless")
2. ssh_exec(target: "34.229.162.231", command: "journalctl -u obs-headless -n 50")
3. Diagnose the issue and potentially fix it
```

```
"Create a new AMI from the template VM"

Claude will:
1. aws_list_instances() to find the template
2. aws_create_ami(instanceId: "i-xxx", name: "gymnastics-vm-v2.3")
```

## Troubleshooting

### "SSH key not found"

Make sure the key exists at `~/.ssh/gymnastics-graphics-key-pair.pem`

### "AWS credentials not found"

Run `aws sts get-caller-identity` to test your credentials. If it fails, re-check your `~/.aws/credentials` file.

### "Connection refused" or "Connection timeout"

- Check if the VM is running: `aws_list_instances`
- Check if security group allows SSH (port 22)
- Check if your IP is allowed in the security group

### MCP server not appearing in Claude Code

1. Check the path in settings.json is correct
2. Make sure you ran `npm install`
3. Restart Claude Code
4. Check Claude Code logs for MCP errors

## Testing

The MCP server includes a comprehensive test suite using Node.js built-in test runner.

### Running Tests

```bash
cd tools/mcp-server

# Run all tests
npm test

# Run only unit tests (fast, no external dependencies)
npm run test:unit

# Run only integration tests (requires AWS/SSH/Firebase credentials)
npm run test:integration
```

### Test Structure

```
__tests__/
├── helpers/
│   └── testConfig.js      # Shared test constants and utilities
├── unit/
│   └── testConfig.test.js # Unit tests for config helpers
└── integration/
    ├── aws.test.js        # AWS EC2 operations tests
    ├── ssh.test.js        # SSH command execution tests
    └── firebase.test.js   # Firebase CRUD operations tests
```

### Test Requirements

- **Unit tests**: No external dependencies, always runnable
- **AWS tests**: Require AWS credentials in `~/.aws/credentials` or environment variables
- **SSH tests**: Require SSH key at `~/.ssh/gymnastics-graphics-key-pair.pem`
- **Firebase tests**: Require Firebase service account at `~/.config/firebase/gymnastics-graphics-dev-sa.json`

Tests that require unavailable credentials are automatically skipped.

## Security Notes

- SSH key stays on your local machine only
- AWS credentials are read from standard AWS SDK locations
- All commands are executed with your local user's permissions
- The MCP server only runs when Claude Code needs it
