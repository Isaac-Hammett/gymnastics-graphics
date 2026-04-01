#!/usr/bin/env node

/**
 * buildGraphicsRegistry.js
 *
 * Builds the graphics registry from manifest files in stage/graphics/.
 * Run by: node scripts/buildGraphicsRegistry.js
 *
 * Auto-generated registry is used by:
 * - show-controller (via import)
 * - server (via require)
 *
 * @generated
 */

const fs = require('fs');
const path = require('path');

// Paths
const PROJECT_ROOT = path.resolve(__dirname, '..');
const GRAPHICS_DIR = path.join(PROJECT_ROOT, 'stage', 'graphics');
const CATEGORIES_FILE = path.join(GRAPHICS_DIR, 'categories.json');

/**
 * Recursively find all JSON files in a directory, excluding categories.json
 */
function findManifestFiles(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      findManifestFiles(fullPath, files);
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      // Exclude categories.json
      if (entry.name !== 'categories.json') {
        files.push(fullPath);
      }
    }
  }

  return files;
}

/**
 * Load and parse a JSON file
 */
function loadJSON(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    console.error(`Error reading ${filePath}: ${err.message}`);
    return null;
  }
}

/**
 * Main build function
 */
function build() {
  console.log('Building graphics registry...\n');

  // Step 1: Load categories
  if (!fs.existsSync(CATEGORIES_FILE)) {
    console.error(`ERROR: Categories file not found: ${CATEGORIES_FILE}`);
    process.exit(1);
  }

  const categories = loadJSON(CATEGORIES_FILE);
  if (!categories) {
    console.error('ERROR: Failed to parse categories.json');
    process.exit(1);
  }

  console.log(`Loaded categories: ${Object.keys(categories).join(', ')}`);

  // Step 2: Find all manifest files
  const manifestFiles = findManifestFiles(GRAPHICS_DIR);
  console.log(`Found ${manifestFiles.length} manifest files\n`);

  // Step 3: Parse each manifest
  const manifests = [];
  let parseErrors = 0;

  for (const filePath of manifestFiles) {
    const manifest = loadJSON(filePath);
    if (manifest) {
      // Add source file path for debugging
      manifest._sourceFile = path.relative(PROJECT_ROOT, filePath);
      manifests.push(manifest);
    } else {
      parseErrors++;
    }
  }

  if (parseErrors > 0) {
    console.error(`WARNING: ${parseErrors} files failed to parse`);
  }

  // Step 4: Summary output
  console.log('Manifest summary:');

  // Count by renderer type
  const byRenderer = {};
  for (const m of manifests) {
    const renderer = m.renderer || 'unknown';
    byRenderer[renderer] = (byRenderer[renderer] || 0) + 1;
  }

  for (const [renderer, count] of Object.entries(byRenderer)) {
    console.log(`  - ${renderer}: ${count}`);
  }

  console.log(`\nTotal manifests: ${manifests.length}`);
  console.log('\nBuild complete (scaffolding only - no output file generated yet)');
}

// Run
build();
