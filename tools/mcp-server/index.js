#!/usr/bin/env node

/**
 * Gymnastics Graphics MCP Server
 *
 * Provides Claude Code with tools to manage AWS infrastructure, SSH into VMs,
 * and interact with Firebase Realtime Database.
 *
 * Tools provided:
 * - aws_list_instances: List all EC2 instances
 * - aws_start_instance: Start a stopped instance
 * - aws_stop_instance: Stop a running instance
 * - aws_create_ami: Create an AMI from an instance
 * - aws_list_amis: List AMIs owned by this account
 * - ssh_exec: Execute a command on a VM via SSH
 * - ssh_multi_exec: Execute a command on multiple VMs
 * - ssh_upload_file: Upload a file to a VM
 * - ssh_download_file: Download a file from a VM
 * - firebase_get: Read data from Firebase
 * - firebase_set: Write data to Firebase
 * - firebase_update: Partial update to Firebase
 * - firebase_delete: Delete data from Firebase
 * - firebase_export: Export data to JSON
 * - firebase_list_paths: List child keys at a path
 * - firebase_sync_to_prod: Copy dev data to prod
 * - aws_open_port: Open a port in security group
 * - aws_close_port: Close a port in security group
 * - aws_list_security_group_rules: List current security group rules
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import {
  EC2Client,
  DescribeInstancesCommand,
  StartInstancesCommand,
  StopInstancesCommand,
  CreateImageCommand,
  DescribeImagesCommand,
  DescribeSecurityGroupsCommand,
  AuthorizeSecurityGroupIngressCommand,
  RevokeSecurityGroupIngressCommand,
} from '@aws-sdk/client-ec2';
import { NodeSSH } from 'node-ssh';
import { readFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import admin from 'firebase-admin';

// Configuration
const CONFIG = {
  awsRegion: 'us-east-1',
  sshKeyPath: join(homedir(), '.ssh', 'gymnastics-graphics-key-pair.pem'),
  sshUsername: 'ubuntu',
  coordinatorIp: '44.193.31.120',
  projectTag: 'gymnastics-graphics',
  sshTimeout: 30000, // 30 seconds
  commandTimeout: 60000, // 60 seconds for command execution
};

// Firebase Configuration
const FIREBASE_CONFIG = {
  dev: {
    databaseURL: 'https://gymnastics-graphics-dev-default-rtdb.firebaseio.com',
    serviceAccountPath: join(homedir(), '.config', 'firebase', 'gymnastics-graphics-dev-sa.json'),
  },
  prod: {
    databaseURL: 'https://gymnastics-graphics-default-rtdb.firebaseio.com',
    serviceAccountPath: join(homedir(), '.config', 'firebase', 'gymnastics-graphics-prod-sa.json'),
  },
};

// Firebase app instances (lazy initialized)
const firebaseApps = {};

function getFirebaseApp(project) {
  if (!['dev', 'prod'].includes(project)) {
    throw new Error(`Invalid project: ${project}. Must be 'dev' or 'prod'.`);
  }

  if (!firebaseApps[project]) {
    const config = FIREBASE_CONFIG[project];

    if (!existsSync(config.serviceAccountPath)) {
      throw new Error(`Service account not found: ${config.serviceAccountPath}`);
    }

    const serviceAccount = JSON.parse(readFileSync(config.serviceAccountPath, 'utf8'));

    firebaseApps[project] = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: config.databaseURL,
    }, project); // Use project name as app name to allow multiple apps
  }

  return firebaseApps[project];
}

function getFirebaseDb(project) {
  const app = getFirebaseApp(project);
  return admin.database(app);
}

// Initialize AWS EC2 client
const ec2 = new EC2Client({ region: CONFIG.awsRegion });

// Tool definitions
const TOOLS = [
  {
    name: 'aws_list_instances',
    description: 'List all EC2 instances tagged for gymnastics-graphics. Returns instance ID, name, state, public IP, and instance type.',
    inputSchema: {
      type: 'object',
      properties: {
        stateFilter: {
          type: 'string',
          description: 'Optional filter by state: running, stopped, pending, etc.',
          enum: ['running', 'stopped', 'pending', 'stopping', 'shutting-down', 'terminated']
        }
      }
    }
  },
  {
    name: 'aws_start_instance',
    description: 'Start a stopped EC2 instance. Returns immediately - instance takes 1-2 minutes to fully start.',
    inputSchema: {
      type: 'object',
      properties: {
        instanceId: {
          type: 'string',
          description: 'The EC2 instance ID (e.g., i-0abc123def456789)'
        }
      },
      required: ['instanceId']
    }
  },
  {
    name: 'aws_stop_instance',
    description: 'Stop a running EC2 instance.',
    inputSchema: {
      type: 'object',
      properties: {
        instanceId: {
          type: 'string',
          description: 'The EC2 instance ID to stop'
        }
      },
      required: ['instanceId']
    }
  },
  {
    name: 'aws_create_ami',
    description: 'Create an AMI (Amazon Machine Image) from an instance. Use this to save a configured VM as a template.',
    inputSchema: {
      type: 'object',
      properties: {
        instanceId: {
          type: 'string',
          description: 'The EC2 instance ID to create AMI from'
        },
        name: {
          type: 'string',
          description: 'Name for the AMI (e.g., gymnastics-vm-v2.2)'
        },
        description: {
          type: 'string',
          description: 'Description of what this AMI contains'
        }
      },
      required: ['instanceId', 'name']
    }
  },
  {
    name: 'aws_list_amis',
    description: 'List AMIs owned by this account, filtered by gymnastics-related names.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'ssh_exec',
    description: 'Execute a command on a VM via SSH. Can target any VM by IP address or use "coordinator" as a shortcut.',
    inputSchema: {
      type: 'object',
      properties: {
        target: {
          type: 'string',
          description: 'IP address of the VM, or "coordinator" for the coordinator VM'
        },
        command: {
          type: 'string',
          description: 'The bash command to execute'
        },
        sudo: {
          type: 'boolean',
          description: 'Whether to run with sudo (default: false)'
        }
      },
      required: ['target', 'command']
    }
  },
  {
    name: 'ssh_multi_exec',
    description: 'Execute the same command on multiple VMs. Useful for checking status across all VMs.',
    inputSchema: {
      type: 'object',
      properties: {
        targets: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of IP addresses or "coordinator"'
        },
        command: {
          type: 'string',
          description: 'The bash command to execute on all targets'
        },
        sudo: {
          type: 'boolean',
          description: 'Whether to run with sudo'
        }
      },
      required: ['targets', 'command']
    }
  },
  {
    name: 'ssh_upload_file',
    description: 'Upload a local file to a VM via SSH/SCP.',
    inputSchema: {
      type: 'object',
      properties: {
        target: {
          type: 'string',
          description: 'IP address of the VM, or "coordinator"'
        },
        localPath: {
          type: 'string',
          description: 'Path to the local file to upload'
        },
        remotePath: {
          type: 'string',
          description: 'Destination path on the VM'
        }
      },
      required: ['target', 'localPath', 'remotePath']
    }
  },
  {
    name: 'ssh_download_file',
    description: 'Download a file from a VM to local machine via SSH/SCP.',
    inputSchema: {
      type: 'object',
      properties: {
        target: {
          type: 'string',
          description: 'IP address of the VM, or "coordinator"'
        },
        remotePath: {
          type: 'string',
          description: 'Path to the file on the VM'
        },
        localPath: {
          type: 'string',
          description: 'Destination path on local machine'
        }
      },
      required: ['target', 'remotePath', 'localPath']
    }
  },
  // Firebase tools
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
        project: {
          type: 'string',
          enum: ['dev', 'prod'],
          description: 'Which Firebase project to use'
        },
        path: {
          type: 'string',
          description: 'Database path to write to'
        },
        data: {
          description: 'The data to write (any JSON value)'
        }
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
        project: {
          type: 'string',
          enum: ['dev', 'prod'],
          description: 'Which Firebase project to use'
        },
        path: {
          type: 'string',
          description: 'Database path to update'
        },
        data: {
          type: 'object',
          description: 'The data to merge at this path'
        }
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
        project: {
          type: 'string',
          enum: ['dev', 'prod'],
          description: 'Which Firebase project to use'
        },
        path: {
          type: 'string',
          description: 'Database path to delete'
        }
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
        project: {
          type: 'string',
          enum: ['dev', 'prod'],
          description: 'Which Firebase project to use'
        },
        path: {
          type: 'string',
          description: 'Path to export (use "/" for entire database)'
        }
      },
      required: ['project', 'path']
    }
  },
  {
    name: 'firebase_list_paths',
    description: 'List all child keys at a path (shallow read).',
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
          description: 'Database path to list children of'
        }
      },
      required: ['project', 'path']
    }
  },
  {
    name: 'firebase_sync_to_prod',
    description: 'Copy data from dev Firebase to prod Firebase at a given path. Creates backup of prod first.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to sync (use "/" for entire database)'
        },
        createBackup: {
          type: 'boolean',
          description: 'Whether to backup prod data first (default: true)'
        }
      },
      required: ['path']
    }
  },
  // Security Group tools
  {
    name: 'aws_list_security_group_rules',
    description: 'List inbound rules for the gymnastics-graphics security group.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'aws_open_port',
    description: 'Open a port in the gymnastics-graphics security group for inbound traffic.',
    inputSchema: {
      type: 'object',
      properties: {
        port: {
          type: 'number',
          description: 'The port number to open (e.g., 8080)'
        },
        description: {
          type: 'string',
          description: 'Description for this rule (e.g., "Test server")'
        }
      },
      required: ['port']
    }
  },
  {
    name: 'aws_close_port',
    description: 'Close a port in the gymnastics-graphics security group.',
    inputSchema: {
      type: 'object',
      properties: {
        port: {
          type: 'number',
          description: 'The port number to close'
        }
      },
      required: ['port']
    }
  }
];

// Helper: Resolve target to IP
function resolveTarget(target) {
  if (target === 'coordinator') {
    return CONFIG.coordinatorIp;
  }
  return target;
}

// Helper: Create SSH connection
async function createSSHConnection(ip) {
  const ssh = new NodeSSH();

  // Check if key file exists
  if (!existsSync(CONFIG.sshKeyPath)) {
    throw new Error(`SSH key not found at ${CONFIG.sshKeyPath}`);
  }

  await ssh.connect({
    host: ip,
    username: CONFIG.sshUsername,
    privateKeyPath: CONFIG.sshKeyPath,
    readyTimeout: CONFIG.sshTimeout,
  });

  return ssh;
}

// Tool implementations
async function listInstances(stateFilter) {
  const command = new DescribeInstancesCommand({
    Filters: [
      {
        Name: 'tag:Project',
        Values: [CONFIG.projectTag]
      },
      ...(stateFilter ? [{
        Name: 'instance-state-name',
        Values: [stateFilter]
      }] : [])
    ]
  });

  const response = await ec2.send(command);

  const instances = [];
  for (const reservation of response.Reservations || []) {
    for (const instance of reservation.Instances || []) {
      const nameTag = instance.Tags?.find(t => t.Key === 'Name');
      instances.push({
        instanceId: instance.InstanceId,
        name: nameTag?.Value || 'unnamed',
        state: instance.State?.Name,
        publicIp: instance.PublicIpAddress || null,
        privateIp: instance.PrivateIpAddress || null,
        instanceType: instance.InstanceType,
        launchTime: instance.LaunchTime?.toISOString(),
      });
    }
  }

  return instances;
}

async function startInstance(instanceId) {
  const command = new StartInstancesCommand({
    InstanceIds: [instanceId]
  });

  const response = await ec2.send(command);
  const stateChange = response.StartingInstances?.[0];

  return {
    instanceId,
    previousState: stateChange?.PreviousState?.Name,
    currentState: stateChange?.CurrentState?.Name,
    message: `Instance ${instanceId} is starting. It will take 1-2 minutes to be fully available.`
  };
}

async function stopInstance(instanceId) {
  const command = new StopInstancesCommand({
    InstanceIds: [instanceId]
  });

  const response = await ec2.send(command);
  const stateChange = response.StoppingInstances?.[0];

  return {
    instanceId,
    previousState: stateChange?.PreviousState?.Name,
    currentState: stateChange?.CurrentState?.Name,
    message: `Instance ${instanceId} is stopping.`
  };
}

async function createAMI(instanceId, name, description) {
  const command = new CreateImageCommand({
    InstanceId: instanceId,
    Name: name,
    Description: description || `AMI created from ${instanceId}`,
    NoReboot: true, // Don't reboot the instance
    TagSpecifications: [
      {
        ResourceType: 'image',
        Tags: [
          { Key: 'Project', Value: CONFIG.projectTag },
          { Key: 'SourceInstance', Value: instanceId },
          { Key: 'CreatedAt', Value: new Date().toISOString() }
        ]
      }
    ]
  });

  const response = await ec2.send(command);

  return {
    amiId: response.ImageId,
    name,
    message: `AMI creation started. ID: ${response.ImageId}. It will take 5-10 minutes to complete.`
  };
}

async function listAMIs() {
  const command = new DescribeImagesCommand({
    Owners: ['self'],
    Filters: [
      {
        Name: 'name',
        Values: ['gymnastics-*', '*gymnastics*']
      }
    ]
  });

  const response = await ec2.send(command);

  const amis = (response.Images || []).map(ami => ({
    amiId: ami.ImageId,
    name: ami.Name,
    state: ami.State,
    creationDate: ami.CreationDate,
    description: ami.Description,
  }));

  // Sort by creation date descending
  amis.sort((a, b) => new Date(b.creationDate) - new Date(a.creationDate));

  return amis;
}

async function sshExec(target, command, sudo = false) {
  const ip = resolveTarget(target);
  const ssh = await createSSHConnection(ip);

  try {
    const cmd = sudo ? `sudo ${command}` : command;
    const result = await ssh.execCommand(cmd, {
      execOptions: { timeout: CONFIG.commandTimeout }
    });

    return {
      target: ip,
      command: cmd,
      exitCode: result.code,
      stdout: result.stdout,
      stderr: result.stderr,
      success: result.code === 0
    };
  } finally {
    ssh.dispose();
  }
}

async function sshMultiExec(targets, command, sudo = false) {
  const results = await Promise.all(
    targets.map(async (target) => {
      try {
        return await sshExec(target, command, sudo);
      } catch (error) {
        return {
          target: resolveTarget(target),
          command,
          success: false,
          error: error.message
        };
      }
    })
  );

  return {
    command,
    results,
    successCount: results.filter(r => r.success).length,
    failureCount: results.filter(r => !r.success).length
  };
}

async function sshUploadFile(target, localPath, remotePath) {
  const ip = resolveTarget(target);
  const ssh = await createSSHConnection(ip);

  try {
    await ssh.putFile(localPath, remotePath);
    return {
      target: ip,
      localPath,
      remotePath,
      success: true,
      message: `File uploaded successfully to ${ip}:${remotePath}`
    };
  } finally {
    ssh.dispose();
  }
}

async function sshDownloadFile(target, remotePath, localPath) {
  const ip = resolveTarget(target);
  const ssh = await createSSHConnection(ip);

  try {
    await ssh.getFile(localPath, remotePath);
    return {
      target: ip,
      remotePath,
      localPath,
      success: true,
      message: `File downloaded successfully to ${localPath}`
    };
  } finally {
    ssh.dispose();
  }
}

// Firebase implementations
async function firebaseGet(project, path) {
  const db = getFirebaseDb(project);
  const snapshot = await db.ref(path).once('value');
  const data = snapshot.val();

  return {
    project,
    path,
    exists: snapshot.exists(),
    data,
  };
}

async function firebaseSet(project, path, data) {
  const db = getFirebaseDb(project);
  await db.ref(path).set(data);

  return {
    project,
    path,
    success: true,
    message: `Data written to ${project}:${path}`,
  };
}

async function firebaseUpdate(project, path, data) {
  const db = getFirebaseDb(project);
  await db.ref(path).update(data);

  return {
    project,
    path,
    success: true,
    message: `Data updated at ${project}:${path}`,
  };
}

async function firebaseDelete(project, path) {
  const db = getFirebaseDb(project);
  await db.ref(path).remove();

  return {
    project,
    path,
    success: true,
    message: `Data deleted at ${project}:${path}`,
  };
}

async function firebaseExport(project, path) {
  const db = getFirebaseDb(project);
  const snapshot = await db.ref(path).once('value');
  const data = snapshot.val();

  return {
    project,
    path,
    exportedAt: new Date().toISOString(),
    data,
  };
}

async function firebaseListPaths(project, path) {
  const db = getFirebaseDb(project);
  const snapshot = await db.ref(path).once('value');

  if (!snapshot.exists()) {
    return {
      project,
      path,
      exists: false,
      children: [],
    };
  }

  const val = snapshot.val();
  const children = typeof val === 'object' && val !== null ? Object.keys(val) : [];

  return {
    project,
    path,
    exists: true,
    children,
    childCount: children.length,
  };
}

async function firebaseSyncToProd(path, createBackup = true) {
  const devDb = getFirebaseDb('dev');
  const prodDb = getFirebaseDb('prod');

  // Get dev data
  const devSnapshot = await devDb.ref(path).once('value');
  const devData = devSnapshot.val();

  if (!devSnapshot.exists()) {
    return {
      success: false,
      message: `No data found at dev:${path}`,
    };
  }

  let backup = null;

  // Backup prod data first if requested
  if (createBackup) {
    const prodSnapshot = await prodDb.ref(path).once('value');
    backup = {
      path,
      backedUpAt: new Date().toISOString(),
      data: prodSnapshot.val(),
    };
  }

  // Write dev data to prod
  await prodDb.ref(path).set(devData);

  return {
    success: true,
    path,
    syncedAt: new Date().toISOString(),
    message: `Data synced from dev to prod at ${path}`,
    backup: createBackup ? backup : 'Backup skipped',
  };
}

// Security Group implementations
async function getGymnasticsSecurityGroup() {
  // First, get an instance to find its security group
  const instancesCommand = new DescribeInstancesCommand({
    Filters: [
      { Name: 'tag:Project', Values: [CONFIG.projectTag] }
    ]
  });

  const instancesResponse = await ec2.send(instancesCommand);

  for (const reservation of instancesResponse.Reservations || []) {
    for (const instance of reservation.Instances || []) {
      if (instance.SecurityGroups && instance.SecurityGroups.length > 0) {
        return instance.SecurityGroups[0].GroupId;
      }
    }
  }

  throw new Error('No security group found for gymnastics-graphics instances');
}

async function listSecurityGroupRules() {
  const groupId = await getGymnasticsSecurityGroup();

  const command = new DescribeSecurityGroupsCommand({
    GroupIds: [groupId]
  });

  const response = await ec2.send(command);
  const sg = response.SecurityGroups?.[0];

  if (!sg) {
    throw new Error('Security group not found');
  }

  const rules = (sg.IpPermissions || []).map(rule => ({
    protocol: rule.IpProtocol,
    fromPort: rule.FromPort,
    toPort: rule.ToPort,
    sources: [
      ...(rule.IpRanges || []).map(r => ({ type: 'cidr', value: r.CidrIp, description: r.Description })),
      ...(rule.Ipv6Ranges || []).map(r => ({ type: 'cidrv6', value: r.CidrIpv6, description: r.Description })),
    ]
  }));

  return {
    securityGroupId: groupId,
    securityGroupName: sg.GroupName,
    inboundRules: rules
  };
}

async function openPort(port, description = '') {
  const groupId = await getGymnasticsSecurityGroup();

  const command = new AuthorizeSecurityGroupIngressCommand({
    GroupId: groupId,
    IpPermissions: [
      {
        IpProtocol: 'tcp',
        FromPort: port,
        ToPort: port,
        IpRanges: [
          {
            CidrIp: '0.0.0.0/0',
            Description: description || `Port ${port} opened via MCP`
          }
        ]
      }
    ]
  });

  await ec2.send(command);

  return {
    success: true,
    securityGroupId: groupId,
    port,
    message: `Port ${port} opened for inbound TCP traffic`
  };
}

async function closePort(port) {
  const groupId = await getGymnasticsSecurityGroup();

  const command = new RevokeSecurityGroupIngressCommand({
    GroupId: groupId,
    IpPermissions: [
      {
        IpProtocol: 'tcp',
        FromPort: port,
        ToPort: port,
        IpRanges: [
          {
            CidrIp: '0.0.0.0/0'
          }
        ]
      }
    ]
  });

  await ec2.send(command);

  return {
    success: true,
    securityGroupId: groupId,
    port,
    message: `Port ${port} closed for inbound TCP traffic`
  };
}

// Main server setup
async function main() {
  const server = new Server(
    {
      name: 'gymnastics-mcp-server',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Handle list tools request
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: TOOLS };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      let result;

      switch (name) {
        case 'aws_list_instances':
          result = await listInstances(args?.stateFilter);
          break;

        case 'aws_start_instance':
          result = await startInstance(args.instanceId);
          break;

        case 'aws_stop_instance':
          result = await stopInstance(args.instanceId);
          break;

        case 'aws_create_ami':
          result = await createAMI(args.instanceId, args.name, args.description);
          break;

        case 'aws_list_amis':
          result = await listAMIs();
          break;

        case 'ssh_exec':
          result = await sshExec(args.target, args.command, args.sudo);
          break;

        case 'ssh_multi_exec':
          result = await sshMultiExec(args.targets, args.command, args.sudo);
          break;

        case 'ssh_upload_file':
          result = await sshUploadFile(args.target, args.localPath, args.remotePath);
          break;

        case 'ssh_download_file':
          result = await sshDownloadFile(args.target, args.remotePath, args.localPath);
          break;

        // Firebase tools
        case 'firebase_get':
          result = await firebaseGet(args.project, args.path);
          break;

        case 'firebase_set':
          result = await firebaseSet(args.project, args.path, args.data);
          break;

        case 'firebase_update':
          result = await firebaseUpdate(args.project, args.path, args.data);
          break;

        case 'firebase_delete':
          result = await firebaseDelete(args.project, args.path);
          break;

        case 'firebase_export':
          result = await firebaseExport(args.project, args.path);
          break;

        case 'firebase_list_paths':
          result = await firebaseListPaths(args.project, args.path);
          break;

        case 'firebase_sync_to_prod':
          result = await firebaseSyncToProd(args.path, args.createBackup ?? true);
          break;

        // Security Group tools
        case 'aws_list_security_group_rules':
          result = await listSecurityGroupRules();
          break;

        case 'aws_open_port':
          result = await openPort(args.port, args.description);
          break;

        case 'aws_close_port':
          result = await closePort(args.port);
          break;

        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: error.message,
              tool: name,
              args
            }, null, 2),
          },
        ],
        isError: true,
      };
    }
  });

  // Start the server
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('Gymnastics MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
