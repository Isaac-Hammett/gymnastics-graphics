/**
 * Unit Tests for testConfig.js
 *
 * These tests verify the test configuration helpers work correctly.
 * Run with: npm test or npm run test:unit
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  COORDINATOR_IP,
  COORDINATOR_HOST,
  UNREACHABLE_IP,
  AWS_REGION,
  EXPECTED_PORTS,
  FIREBASE_PROJECTS,
  VALID_INSTANCE_STATES,
  getTestPath,
  isValidInstanceId,
  isValidAmiId,
  isValidSecurityGroupId,
  isValidInstanceState
} from '../helpers/testConfig.js';

describe('testConfig constants', () => {
  test('COORDINATOR_IP is a valid IP address', () => {
    assert.match(COORDINATOR_IP, /^\d+\.\d+\.\d+\.\d+$/);
  });

  test('COORDINATOR_HOST is defined', () => {
    assert.strictEqual(COORDINATOR_HOST, 'coordinator');
  });

  test('UNREACHABLE_IP is in TEST-NET range', () => {
    assert.ok(UNREACHABLE_IP.startsWith('192.0.2.'));
  });

  test('AWS_REGION is us-east-1', () => {
    assert.strictEqual(AWS_REGION, 'us-east-1');
  });

  test('EXPECTED_PORTS includes required ports', () => {
    assert.ok(EXPECTED_PORTS.includes(22), 'Should include SSH port 22');
    assert.ok(EXPECTED_PORTS.includes(443), 'Should include HTTPS port 443');
    assert.ok(EXPECTED_PORTS.includes(3001), 'Should include API port 3001');
  });

  test('FIREBASE_PROJECTS includes dev and prod', () => {
    assert.ok(FIREBASE_PROJECTS.includes('dev'));
    assert.ok(FIREBASE_PROJECTS.includes('prod'));
  });

  test('VALID_INSTANCE_STATES includes all EC2 states', () => {
    assert.ok(VALID_INSTANCE_STATES.includes('running'));
    assert.ok(VALID_INSTANCE_STATES.includes('stopped'));
    assert.ok(VALID_INSTANCE_STATES.includes('pending'));
    assert.ok(VALID_INSTANCE_STATES.includes('stopping'));
    assert.ok(VALID_INSTANCE_STATES.includes('terminated'));
  });
});

describe('testConfig helper functions', () => {
  test('getTestPath returns unique paths', () => {
    const path1 = getTestPath('test-a');
    const path2 = getTestPath('test-b');

    assert.ok(path1.startsWith('mcp-tests/test-a-'));
    assert.ok(path2.startsWith('mcp-tests/test-b-'));
    assert.notStrictEqual(path1, path2);
  });

  test('isValidInstanceId validates correctly', () => {
    assert.ok(isValidInstanceId('i-abc123def456'));
    assert.ok(isValidInstanceId('i-0123456789abcdef0'));
    assert.ok(!isValidInstanceId('abc123'));
    assert.ok(!isValidInstanceId('ami-123'));
    assert.ok(!isValidInstanceId(''));
  });

  test('isValidAmiId validates correctly', () => {
    assert.ok(isValidAmiId('ami-abc123def456'));
    assert.ok(isValidAmiId('ami-0123456789abcdef0'));
    assert.ok(!isValidAmiId('abc123'));
    assert.ok(!isValidAmiId('i-123'));
    assert.ok(!isValidAmiId(''));
  });

  test('isValidSecurityGroupId validates correctly', () => {
    assert.ok(isValidSecurityGroupId('sg-abc123def456'));
    assert.ok(isValidSecurityGroupId('sg-025f1ac53cccb756b'));
    assert.ok(!isValidSecurityGroupId('abc123'));
    assert.ok(!isValidSecurityGroupId('i-123'));
    assert.ok(!isValidSecurityGroupId(''));
  });

  test('isValidInstanceState validates correctly', () => {
    assert.ok(isValidInstanceState('running'));
    assert.ok(isValidInstanceState('stopped'));
    assert.ok(isValidInstanceState('pending'));
    assert.ok(!isValidInstanceState('invalid'));
    assert.ok(!isValidInstanceState(''));
    assert.ok(!isValidInstanceState('RUNNING')); // case-sensitive
  });
});

describe('test framework setup', () => {
  test('placeholder test passes', () => {
    assert.ok(true, 'Test framework is working');
  });

  test('async tests work', async () => {
    const result = await Promise.resolve(42);
    assert.strictEqual(result, 42);
  });
});
