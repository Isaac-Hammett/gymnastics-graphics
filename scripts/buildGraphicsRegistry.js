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
const SKELETONS_DIR = path.join(PROJECT_ROOT, 'stage', 'skeletons');
const BLOCKS_DIR = path.join(PROJECT_ROOT, 'stage', 'blocks');

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
 * Validate a single manifest against requirements
 * Returns array of error messages (empty = valid)
 */
function validateManifest(manifest, categories, filePath) {
  const errors = [];
  const relPath = path.relative(PROJECT_ROOT, filePath);

  // Required fields for ALL manifests
  const requiredAll = ['id', 'label', 'category', 'renderer'];
  for (const field of requiredAll) {
    if (!manifest[field]) {
      errors.push(`${relPath}: Missing required field '${field}'`);
    }
  }

  // Category validation
  if (manifest.category && !categories[manifest.category]) {
    const validCategories = Object.keys(categories).join(', ');
    errors.push(`${relPath}: Invalid category '${manifest.category}'. Valid: ${validCategories}`);
  }

  // Subcategory validation (if present)
  if (manifest.subcategory && manifest.category && categories[manifest.category]) {
    const validSubcats = categories[manifest.category].subcategories || {};
    if (Object.keys(validSubcats).length > 0 && !validSubcats[manifest.subcategory]) {
      const validNames = Object.keys(validSubcats).join(', ');
      errors.push(`${relPath}: Invalid subcategory '${manifest.subcategory}' for category '${manifest.category}'. Valid: ${validNames}`);
    }
  }

  // Renderer-specific validation
  if (manifest.renderer === 'stage') {
    // Stage engine manifests require skeleton and blocks
    if (!manifest.skeleton) {
      errors.push(`${relPath}: Stage renderer requires 'skeleton' field`);
    }
    if (!manifest.blocks || !Array.isArray(manifest.blocks) || manifest.blocks.length === 0) {
      errors.push(`${relPath}: Stage renderer requires non-empty 'blocks' array`);
    }
  } else if (manifest.renderer === 'overlay' || manifest.renderer === 'output') {
    // Legacy manifests require file
    if (!manifest.file) {
      errors.push(`${relPath}: Renderer '${manifest.renderer}' requires 'file' field`);
    }
  } else if (manifest.renderer && !['stage', 'overlay', 'output'].includes(manifest.renderer)) {
    errors.push(`${relPath}: Invalid renderer '${manifest.renderer}'. Valid: stage, overlay, output`);
  }

  return errors;
}

/**
 * Check for duplicate IDs across all manifests
 * Returns array of error messages
 */
function checkDuplicateIds(manifests) {
  const errors = [];
  const seenIds = new Map(); // id -> filePath

  for (const manifest of manifests) {
    if (manifest.id) {
      if (seenIds.has(manifest.id)) {
        errors.push(`Duplicate ID '${manifest.id}' found in:\n  - ${seenIds.get(manifest.id)}\n  - ${manifest._sourceFile}`);
      } else {
        seenIds.set(manifest.id, manifest._sourceFile);
      }
    }
  }

  return errors;
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

  // Step 4: Validate all manifests
  console.log('Validating manifests...');
  const validationErrors = [];

  for (const manifest of manifests) {
    const filePath = path.join(PROJECT_ROOT, manifest._sourceFile);
    const errors = validateManifest(manifest, categories, filePath);
    validationErrors.push(...errors);
  }

  // Check for duplicate IDs
  const duplicateErrors = checkDuplicateIds(manifests);
  validationErrors.push(...duplicateErrors);

  // Report validation errors
  if (validationErrors.length > 0) {
    console.error('\n=== VALIDATION ERRORS ===\n');
    for (const error of validationErrors) {
      console.error(`  ERROR: ${error}`);
    }
    console.error(`\nTotal errors: ${validationErrors.length}`);
    console.error('Build failed due to validation errors.');
    process.exit(1);
  }

  console.log('All manifests valid.\n');

  // Step 5: Summary output
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
