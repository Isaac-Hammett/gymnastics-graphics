/**
 * Test Configuration Constants
 *
 * Centralized configuration for MCP server tests.
 * Import these constants in test files to ensure consistency.
 */

// Target hosts
export const COORDINATOR_IP = '44.193.31.120';
export const COORDINATOR_HOST = 'coordinator'; // Shortcut alias

// Test-NET IP (RFC 5737) - guaranteed unreachable for error testing
export const UNREACHABLE_IP = '192.0.2.1';

// AWS Configuration
export const AWS_REGION = 'us-east-1';
export const SECURITY_GROUP_ID = 'sg-025f1ac53cccb756b';
export const SECURITY_GROUP_NAME = 'gymnastics-vm-pool';

// Expected ports in security group
export const EXPECTED_PORTS = [22, 80, 443, 3001, 8080];

// Firebase Configuration
export const FIREBASE_PROJECTS = ['dev', 'prod'];
export const DEFAULT_FIREBASE_PROJECT = 'dev';

// Test paths in Firebase (use these to avoid polluting real data)
export const FIREBASE_TEST_BASE_PATH = 'mcp-tests';

// Instance ID patterns (regex)
export const INSTANCE_ID_PATTERN = /^i-[a-f0-9]+$/;
export const AMI_ID_PATTERN = /^ami-[a-f0-9]+$/;
export const SECURITY_GROUP_PATTERN = /^sg-[a-f0-9]+$/;

// Valid EC2 instance states
export const VALID_INSTANCE_STATES = ['running', 'stopped', 'pending', 'stopping', 'terminated'];

// Timeouts (ms)
export const SSH_TIMEOUT = 30000;
export const HTTP_TIMEOUT = 5000;
export const AWS_OPERATION_TIMEOUT = 120000;

// Latency thresholds (seconds)
export const MAX_SSH_LATENCY = 5;

// MCP Server connection config
export const MCP_SERVER_PATH = new URL('../../index.js', import.meta.url).pathname;

/**
 * Helper to generate unique test paths in Firebase
 * @param {string} testName - Name of the test
 * @returns {string} Unique path for test data
 */
export function getTestPath(testName) {
  const timestamp = Date.now();
  return `${FIREBASE_TEST_BASE_PATH}/${testName}-${timestamp}`;
}

/**
 * Helper to validate instance ID format
 * @param {string} instanceId
 * @returns {boolean}
 */
export function isValidInstanceId(instanceId) {
  return INSTANCE_ID_PATTERN.test(instanceId);
}

/**
 * Helper to validate AMI ID format
 * @param {string} amiId
 * @returns {boolean}
 */
export function isValidAmiId(amiId) {
  return AMI_ID_PATTERN.test(amiId);
}

/**
 * Helper to validate security group ID format
 * @param {string} sgId
 * @returns {boolean}
 */
export function isValidSecurityGroupId(sgId) {
  return SECURITY_GROUP_PATTERN.test(sgId);
}

/**
 * Helper to check if state is valid
 * @param {string} state
 * @returns {boolean}
 */
export function isValidInstanceState(state) {
  return VALID_INSTANCE_STATES.includes(state);
}

// Default export for convenience
export default {
  COORDINATOR_IP,
  COORDINATOR_HOST,
  UNREACHABLE_IP,
  AWS_REGION,
  SECURITY_GROUP_ID,
  SECURITY_GROUP_NAME,
  EXPECTED_PORTS,
  FIREBASE_PROJECTS,
  DEFAULT_FIREBASE_PROJECT,
  FIREBASE_TEST_BASE_PATH,
  INSTANCE_ID_PATTERN,
  AMI_ID_PATTERN,
  SECURITY_GROUP_PATTERN,
  VALID_INSTANCE_STATES,
  SSH_TIMEOUT,
  HTTP_TIMEOUT,
  AWS_OPERATION_TIMEOUT,
  MAX_SSH_LATENCY,
  MCP_SERVER_PATH,
  getTestPath,
  isValidInstanceId,
  isValidAmiId,
  isValidSecurityGroupId,
  isValidInstanceState
};
