#!/usr/bin/env node
/**
 * Migration Script: show-config.json to Firebase Production Config
 *
 * This script migrates a local show-config.json file to Firebase's
 * production configuration structure for a specific competition.
 *
 * Usage:
 *   node server/scripts/migrateToFirebase.js --competitionId <id> --gender <mens|womens> [options]
 *
 * Options:
 *   --competitionId, -c  Competition ID to migrate to (required)
 *   --gender, -g         Gender: mens or womens (required for apparatus validation)
 *   --config, -f         Path to show-config.json (default: server/config/show-config.json)
 *   --dry-run            Preview migration without writing to Firebase
 *   --force              Overwrite existing production config
 *   --help, -h           Show this help message
 *
 * Firebase path structure:
 *   competitions/{compId}/production/
 *     cameras/     - Camera configurations (object keyed by id)
 *     rundown/     - Rundown with segments array
 *     settings/    - Production settings (transitions, audio, graphics, nimble)
 *     history/     - Empty array for segment history
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get directory of this script
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import Firebase service and apparatus config
// Use dynamic imports to handle module resolution
let productionConfigService;
let apparatusConfig;

async function loadModules() {
  productionConfigService = (await import('../lib/productionConfigService.js')).default;
  apparatusConfig = await import('../lib/apparatusConfig.js');
}

// ============================================================================
// CLI Argument Parsing
// ============================================================================

function parseArgs(args) {
  const options = {
    competitionId: null,
    gender: null,
    configPath: resolve(__dirname, '../config/show-config.json'),
    dryRun: false,
    force: false,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--competitionId':
      case '-c':
        options.competitionId = args[++i];
        break;
      case '--gender':
      case '-g':
        options.gender = args[++i];
        break;
      case '--config':
      case '-f':
        options.configPath = resolve(process.cwd(), args[++i]);
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--force':
        options.force = true;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
    }
  }

  return options;
}

function showHelp() {
  console.log(`
Migration Script: show-config.json to Firebase Production Config

Usage:
  node server/scripts/migrateToFirebase.js --competitionId <id> --gender <mens|womens> [options]

Required Arguments:
  --competitionId, -c  Competition ID to migrate to
  --gender, -g         Gender: mens or womens (for apparatus validation)

Options:
  --config, -f         Path to show-config.json (default: server/config/show-config.json)
  --dry-run            Preview migration without writing to Firebase
  --force              Overwrite existing production config
  --help, -h           Show this help message

Examples:
  # Migrate to a women's competition
  node server/scripts/migrateToFirebase.js -c comp-2025-01-13-wag -g womens

  # Dry run to preview migration
  node server/scripts/migrateToFirebase.js -c comp-2025-01-13-wag -g womens --dry-run

  # Migrate with custom config file
  node server/scripts/migrateToFirebase.js -c comp-2025-01-13-wag -g womens -f ./custom-config.json

  # Force overwrite existing config
  node server/scripts/migrateToFirebase.js -c comp-2025-01-13-wag -g womens --force
`);
}

// ============================================================================
// Validation
// ============================================================================

function validateCameraApparatus(cameras, gender) {
  const warnings = [];
  const validCodes = apparatusConfig.getApparatusCodes(gender);

  for (const camera of cameras) {
    if (!camera.expectedApparatus || camera.expectedApparatus.length === 0) {
      continue;
    }

    const validation = apparatusConfig.validateApparatusCodes(gender, camera.expectedApparatus);

    if (!validation.valid) {
      warnings.push({
        cameraId: camera.id,
        cameraName: camera.name,
        invalidCodes: validation.invalidCodes,
        message: `Camera "${camera.name}" has invalid apparatus codes for ${gender}: ${validation.invalidCodes.join(', ')}`
      });
    }
  }

  return warnings;
}

function validateSegmentApparatus(segments, gender) {
  const warnings = [];
  const validCodes = apparatusConfig.getApparatusCodes(gender);

  for (const segment of segments) {
    if (!segment.intendedApparatus || segment.intendedApparatus.length === 0) {
      continue;
    }

    const validation = apparatusConfig.validateApparatusCodes(gender, segment.intendedApparatus);

    if (!validation.valid) {
      warnings.push({
        segmentId: segment.id,
        segmentName: segment.name,
        invalidCodes: validation.invalidCodes,
        message: `Segment "${segment.name}" has invalid apparatus codes for ${gender}: ${validation.invalidCodes.join(', ')}`
      });
    }
  }

  return warnings;
}

// ============================================================================
// Migration
// ============================================================================

function buildProductionConfig(showConfig, gender) {
  const { cameras = [], segments = [], nimbleServer, audioConfig, graphicsOverlay, transitions, showName } = showConfig;

  // Build cameras array (already in array format in show-config.json)
  const productionCameras = cameras.map(camera => ({
    id: camera.id,
    name: camera.name,
    srtPort: camera.srtPort,
    srtUrl: camera.srtUrl,
    expectedApparatus: camera.expectedApparatus || [],
    fallbackCameraId: camera.fallbackCameraId || null
  }));

  // Build rundown
  const rundown = {
    showName: showName || 'Untitled Show',
    segments: segments.map(segment => ({
      id: segment.id,
      name: segment.name,
      type: segment.type,
      obsScene: segment.obsScene,
      cameraId: segment.cameraId || null,
      cameraIds: segment.cameraIds || null,
      intendedApparatus: segment.intendedApparatus || null,
      duration: segment.duration,
      autoAdvance: segment.autoAdvance,
      notes: segment.notes || null,
      graphic: segment.graphic || null,
      graphicData: segment.graphicData || null,
      transition: segment.transition || null,
      minDuration: segment.minDuration || null,
      maxDuration: segment.maxDuration || null
    })),
    lastModified: new Date().toISOString()
  };

  // Build settings
  const settings = {
    nimbleServer: nimbleServer || {
      host: 'nimble.local',
      statsPort: 8086,
      pollIntervalMs: 2000
    },
    audioConfig: audioConfig || {
      venue: { sourceName: 'Venue Audio', defaultVolume: 0.8 },
      commentary: { sourceName: 'Commentary Mix', defaultVolume: 1.0 }
    },
    graphicsOverlay: graphicsOverlay || {
      url: 'http://localhost:5173/graphics',
      queryParams: {}
    },
    transitions: transitions || {
      default: { type: 'cut', durationMs: 0 },
      toBreak: { type: 'fade', durationMs: 500 },
      fromBreak: { type: 'fade', durationMs: 500 }
    },
    gender: gender
  };

  return {
    cameras: productionCameras,
    rundown,
    settings,
    history: []
  };
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  // Validate required arguments
  if (!options.competitionId) {
    console.error('Error: --competitionId is required');
    console.error('Run with --help for usage information');
    process.exit(1);
  }

  if (!options.gender) {
    console.error('Error: --gender is required');
    console.error('Run with --help for usage information');
    process.exit(1);
  }

  // Normalize gender
  const normalizedGender = options.gender.toLowerCase();
  if (normalizedGender !== 'mens' && normalizedGender !== 'womens') {
    console.error('Error: --gender must be "mens" or "womens"');
    process.exit(1);
  }

  // Load modules
  try {
    await loadModules();
  } catch (error) {
    console.error('Error loading modules:', error.message);
    process.exit(1);
  }

  console.log('\n=== Migration: show-config.json to Firebase ===\n');
  console.log(`Competition ID: ${options.competitionId}`);
  console.log(`Gender: ${normalizedGender}`);
  console.log(`Config file: ${options.configPath}`);
  console.log(`Dry run: ${options.dryRun}`);
  console.log(`Force: ${options.force}`);
  console.log('');

  // Read show-config.json
  let showConfig;
  try {
    const configContent = readFileSync(options.configPath, 'utf-8');
    showConfig = JSON.parse(configContent);
    console.log(`Loaded config: "${showConfig.showName || 'Untitled'}"`);
    console.log(`  - Cameras: ${showConfig.cameras?.length || 0}`);
    console.log(`  - Segments: ${showConfig.segments?.length || 0}`);
  } catch (error) {
    console.error(`Error reading config file: ${error.message}`);
    process.exit(1);
  }

  // Validate apparatus codes
  console.log('\n--- Validating Apparatus Codes ---\n');

  const cameraWarnings = validateCameraApparatus(showConfig.cameras || [], normalizedGender);
  const segmentWarnings = validateSegmentApparatus(showConfig.segments || [], normalizedGender);
  const allWarnings = [...cameraWarnings, ...segmentWarnings];

  if (allWarnings.length > 0) {
    console.log(`Found ${allWarnings.length} apparatus validation warning(s):\n`);
    for (const warning of allWarnings) {
      console.log(`  WARNING: ${warning.message}`);
    }
    console.log('');
    console.log(`Valid apparatus for ${normalizedGender}: ${apparatusConfig.getApparatusCodes(normalizedGender).join(', ')}`);
    console.log('');
  } else {
    console.log('All apparatus codes are valid for the specified gender.');
  }

  // Build production config
  console.log('\n--- Building Production Config ---\n');
  const productionConfig = buildProductionConfig(showConfig, normalizedGender);

  console.log('Production config structure:');
  console.log(`  - Cameras: ${productionConfig.cameras.length}`);
  console.log(`  - Rundown segments: ${productionConfig.rundown.segments.length}`);
  console.log(`  - Settings: nimbleServer, audioConfig, graphicsOverlay, transitions`);
  console.log(`  - History: empty array (will be populated during show)`);

  // Dry run - just show what would be written
  if (options.dryRun) {
    console.log('\n--- DRY RUN: Preview Only ---\n');
    console.log('Would write to Firebase paths:');
    console.log(`  - competitions/${options.competitionId}/production/cameras`);
    console.log(`  - competitions/${options.competitionId}/production/rundown`);
    console.log(`  - competitions/${options.competitionId}/production/settings`);
    console.log(`  - competitions/${options.competitionId}/production/history`);
    console.log('\nNo changes were made. Remove --dry-run to perform migration.');

    // Print summary
    printSummary(showConfig, productionConfig, allWarnings, true);
    process.exit(0);
  }

  // Check if Firebase is available
  if (!productionConfigService.isAvailable()) {
    console.error('\nError: Firebase is not available.');
    console.error('Make sure GOOGLE_APPLICATION_CREDENTIALS is set or Firebase is properly configured.');
    process.exit(1);
  }

  // Check for existing config
  console.log('\n--- Checking for Existing Config ---\n');
  const existingConfig = await productionConfigService.getProductionConfig(options.competitionId);

  if (existingConfig && !options.force) {
    console.error('Error: Production config already exists for this competition.');
    console.error('Use --force to overwrite existing config.');
    process.exit(1);
  }

  if (existingConfig && options.force) {
    console.log('Existing config found - will be overwritten (--force enabled)');
  } else {
    console.log('No existing config found - creating new production config');
  }

  // Write to Firebase
  console.log('\n--- Writing to Firebase ---\n');

  try {
    // Save cameras
    const camerasSuccess = await productionConfigService.saveCameras(
      options.competitionId,
      productionConfig.cameras
    );
    console.log(`  Cameras: ${camerasSuccess ? 'SUCCESS' : 'FAILED'}`);

    // Save rundown
    const rundownSuccess = await productionConfigService.saveRundown(
      options.competitionId,
      productionConfig.rundown
    );
    console.log(`  Rundown: ${rundownSuccess ? 'SUCCESS' : 'FAILED'}`);

    // Save settings
    const settingsSuccess = await productionConfigService.saveSettings(
      options.competitionId,
      productionConfig.settings
    );
    console.log(`  Settings: ${settingsSuccess ? 'SUCCESS' : 'FAILED'}`);

    if (!camerasSuccess || !rundownSuccess || !settingsSuccess) {
      console.error('\nMigration completed with errors.');
      process.exit(1);
    }

    console.log('\nMigration completed successfully!');

  } catch (error) {
    console.error(`\nMigration failed: ${error.message}`);
    process.exit(1);
  }

  // Print summary
  printSummary(showConfig, productionConfig, allWarnings, false);
}

function printSummary(showConfig, productionConfig, warnings, isDryRun) {
  console.log('\n=== Migration Summary ===\n');
  console.log(`Show Name: ${showConfig.showName || 'Untitled'}`);
  console.log(`Cameras migrated: ${productionConfig.cameras.length}`);
  console.log(`Segments migrated: ${productionConfig.rundown.segments.length}`);
  console.log(`Warnings: ${warnings.length}`);
  console.log(`Status: ${isDryRun ? 'DRY RUN (no changes made)' : 'COMPLETE'}`);
  console.log('');
}

// Run main
main().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
