/**
 * Centralized server URL configuration
 *
 * This module provides a single source of truth for server URL resolution.
 * All components should import from here instead of hardcoding localhost:3003.
 *
 * Environment variables (checked in order):
 * - VITE_API_URL: Primary production server URL (e.g., https://api.commentarygraphic.com)
 * - VITE_LOCAL_SERVER: Override for local development
 * - Falls back to http://localhost:3003 for local development only
 */

/**
 * Get the server URL based on environment
 * @param {string} [socketUrl] - Optional socket URL passed from context (takes priority if provided)
 * @returns {string} The server URL to use
 */
export function getServerUrl(socketUrl) {
  // If a socket URL is explicitly passed (from competition context), use it
  if (socketUrl) {
    return socketUrl;
  }

  // Use VITE_API_URL for production coordinator
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  // Fallback to VITE_LOCAL_SERVER if set
  if (import.meta.env.VITE_LOCAL_SERVER) {
    return import.meta.env.VITE_LOCAL_SERVER;
  }

  // Default to localhost for local development
  return 'http://localhost:3003';
}

/**
 * Default server URL (evaluated at module load time)
 * Use this for simple cases where you don't need dynamic socket URL from context
 */
export const SERVER_URL = getServerUrl();

// Debug: Log resolved URL at module load (build timestamp: 2026-01-17T18:00)
console.log('[serverUrl] Resolved SERVER_URL:', SERVER_URL, 'VITE_API_URL:', import.meta.env.VITE_API_URL);

export default getServerUrl;
