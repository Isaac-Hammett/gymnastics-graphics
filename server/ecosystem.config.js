/**
 * PM2 Ecosystem Configuration for Coordinator Server
 *
 * This configuration is used to manage the coordinator application
 * on the production EC2 instance.
 *
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 restart coordinator
 *   pm2 stop coordinator
 *   pm2 logs coordinator
 *
 * @see docs/PRD-CoordinatorDeployment-2026-01-15.md
 */

module.exports = {
  apps: [
    {
      name: 'coordinator',
      script: 'index.js',
      cwd: '/opt/gymnastics-graphics/server',
      instances: 1,
      exec_mode: 'fork',

      // Environment variables
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        GOOGLE_APPLICATION_CREDENTIALS: '/opt/gymnastics-graphics/firebase-service-account.json',
        FIREBASE_DATABASE_URL: process.env.FIREBASE_DATABASE_URL || 'https://gymnastics-graphics-default-rtdb.firebaseio.com',
        COORDINATOR_MODE: 'true',
        AUTO_SHUTDOWN_MINUTES: 120
      },

      // Log configuration with rotation
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '/opt/gymnastics-graphics/server/logs/coordinator-error.log',
      out_file: '/opt/gymnastics-graphics/server/logs/coordinator-out.log',
      merge_logs: true,
      max_size: '10M',
      retain: 5,

      // Restart policy
      max_restarts: 10,
      min_uptime: '5000ms',
      restart_delay: 4000,

      // Auto-restart on file changes (disabled in production)
      watch: false,
      ignore_watch: ['node_modules', 'logs', '*.log'],

      // Process management
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000
    }
  ]
};
