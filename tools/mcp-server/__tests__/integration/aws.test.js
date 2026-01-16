/**
 * Integration Tests for AWS EC2 Operations
 *
 * These tests verify AWS EC2 operations work correctly.
 * Requires AWS credentials to be configured.
 *
 * Run with: npm run test:integration
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { EC2Client, DescribeInstancesCommand, DescribeImagesCommand, DescribeSecurityGroupRulesCommand } from '@aws-sdk/client-ec2';
import {
  AWS_REGION,
  SECURITY_GROUP_ID,
  EXPECTED_PORTS,
  VALID_INSTANCE_STATES,
  isValidInstanceId,
  isValidAmiId,
  isValidSecurityGroupId
} from '../helpers/testConfig.js';

// Initialize EC2 client
const ec2 = new EC2Client({ region: AWS_REGION });

// Helper function to list instances (replicates MCP server logic)
async function listInstances(stateFilter) {
  const command = new DescribeInstancesCommand({
    Filters: [
      {
        Name: 'tag:Project',
        Values: ['gymnastics-graphics']
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

// Helper function to list AMIs
async function listAMIs() {
  const command = new DescribeImagesCommand({
    Owners: ['self'],
    Filters: [
      {
        Name: 'name',
        Values: ['gymnastics-vm-*']
      }
    ]
  });

  const response = await ec2.send(command);
  const amis = (response.Images || []).map(image => ({
    amiId: image.ImageId,
    name: image.Name,
    state: image.State,
    creationDate: image.CreationDate,
    description: image.Description || ''
  }));

  // Sort by creation date descending
  amis.sort((a, b) => new Date(b.creationDate) - new Date(a.creationDate));
  return amis;
}

// Helper function to list security group rules
async function listSecurityGroupRules() {
  const command = new DescribeSecurityGroupRulesCommand({
    Filters: [
      {
        Name: 'group-id',
        Values: [SECURITY_GROUP_ID]
      }
    ]
  });

  const response = await ec2.send(command);
  const rules = response.SecurityGroupRules || [];

  const inboundRules = rules
    .filter(rule => !rule.IsEgress)
    .map(rule => ({
      protocol: rule.IpProtocol,
      fromPort: rule.FromPort,
      toPort: rule.ToPort,
      cidrIpv4: rule.CidrIpv4 || null,
      description: rule.Description || ''
    }));

  return {
    securityGroupId: SECURITY_GROUP_ID,
    inboundRules
  };
}

describe('AWS EC2 Operations', { skip: !process.env.AWS_ACCESS_KEY_ID && !process.env.AWS_PROFILE }, () => {

  describe('aws_list_instances', () => {
    test('returns array of instances', async () => {
      const instances = await listInstances();

      assert.ok(Array.isArray(instances), 'Response should be an array');
    });

    test('instances have required fields', async () => {
      const instances = await listInstances();

      if (instances.length === 0) {
        // Skip if no instances exist
        return;
      }

      for (const instance of instances) {
        assert.ok('instanceId' in instance, 'Instance should have instanceId');
        assert.ok('name' in instance, 'Instance should have name');
        assert.ok('state' in instance, 'Instance should have state');
        assert.ok('instanceType' in instance, 'Instance should have instanceType');
      }
    });

    test('instance IDs match pattern', async () => {
      const instances = await listInstances();

      for (const instance of instances) {
        assert.ok(
          isValidInstanceId(instance.instanceId),
          `Instance ID ${instance.instanceId} should match pattern i-[a-f0-9]+`
        );
      }
    });

    test('states are valid EC2 states', async () => {
      const instances = await listInstances();

      for (const instance of instances) {
        assert.ok(
          VALID_INSTANCE_STATES.includes(instance.state),
          `State ${instance.state} should be a valid EC2 state`
        );
      }
    });

    test('state filter returns only matching instances', async () => {
      const runningInstances = await listInstances('running');

      for (const instance of runningInstances) {
        assert.strictEqual(instance.state, 'running', 'All instances should be running');
      }
    });
  });

  describe('aws_list_amis', () => {
    test('returns array of AMIs', async () => {
      const amis = await listAMIs();

      assert.ok(Array.isArray(amis), 'Response should be an array');
    });

    test('AMIs have required fields', async () => {
      const amis = await listAMIs();

      if (amis.length === 0) {
        // Skip if no AMIs exist
        return;
      }

      for (const ami of amis) {
        assert.ok('amiId' in ami, 'AMI should have amiId');
        assert.ok('name' in ami, 'AMI should have name');
        assert.ok('state' in ami, 'AMI should have state');
        assert.ok('creationDate' in ami, 'AMI should have creationDate');
      }
    });

    test('AMI IDs match pattern', async () => {
      const amis = await listAMIs();

      for (const ami of amis) {
        assert.ok(
          isValidAmiId(ami.amiId),
          `AMI ID ${ami.amiId} should match pattern ami-[a-f0-9]+`
        );
      }
    });

    test('AMIs are sorted by creation date descending', async () => {
      const amis = await listAMIs();

      if (amis.length < 2) {
        // Need at least 2 AMIs to test sorting
        return;
      }

      for (let i = 1; i < amis.length; i++) {
        const prevDate = new Date(amis[i - 1].creationDate);
        const currDate = new Date(amis[i].creationDate);
        assert.ok(
          prevDate >= currDate,
          'AMIs should be sorted by creation date descending'
        );
      }
    });
  });

  describe('aws_list_security_group_rules', () => {
    test('returns security group with inbound rules', async () => {
      const result = await listSecurityGroupRules();

      assert.ok('securityGroupId' in result, 'Response should have securityGroupId');
      assert.ok('inboundRules' in result, 'Response should have inboundRules');
      assert.ok(Array.isArray(result.inboundRules), 'inboundRules should be an array');
    });

    test('security group ID is valid', async () => {
      const result = await listSecurityGroupRules();

      assert.ok(
        isValidSecurityGroupId(result.securityGroupId),
        'Security group ID should match pattern sg-[a-f0-9]+'
      );
    });

    test('expected ports are configured', async () => {
      const result = await listSecurityGroupRules();
      const configuredPorts = result.inboundRules.map(rule => rule.fromPort);

      for (const port of EXPECTED_PORTS) {
        assert.ok(
          configuredPorts.includes(port),
          `Port ${port} should be configured in security group`
        );
      }
    });
  });
});
