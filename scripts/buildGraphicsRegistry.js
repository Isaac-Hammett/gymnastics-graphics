#!/usr/bin/env node

/**
 * buildGraphicsRegistry.js
 *
 * Builds the graphics registry from manifest files in stage/graphics/.
 * Run by: node scripts/buildGraphicsRegistry.js
 *         node scripts/buildGraphicsRegistry.js --status
 *
 * Auto-generated registry is used by:
 * - show-controller (via import)
 * - server (via require)
 *
 * @generated
 */

const fs = require('fs');
const path = require('path');

// CLI argument parsing
const args = process.argv.slice(2);
const STATUS_MODE = args.includes('--status') || args.includes('-s');

// Paths
const PROJECT_ROOT = path.resolve(__dirname, '..');
const GRAPHICS_DIR = path.join(PROJECT_ROOT, 'stage', 'graphics');
const CATEGORIES_FILE = path.join(GRAPHICS_DIR, 'categories.json');
const SKELETONS_DIR = path.join(PROJECT_ROOT, 'stage', 'skeletons');
const BLOCKS_DIR = path.join(PROJECT_ROOT, 'stage', 'blocks');
const OUTPUT_JS_FILE = path.join(PROJECT_ROOT, 'show-controller', 'src', 'lib', 'graphicsRegistry.generated.js');
const OUTPUT_JSON_FILE = path.join(PROJECT_ROOT, 'stage', 'graphics-registry.json');

// Track validated blocks to avoid duplicate warnings
const validatedBlocks = new Set();

// Block and skeleton catalogs for migration status
// These are the PLANNED blocks/skeletons from the PRD block catalog
const PLANNED_BLOCKS = [
  'header-bar',
  'leaderboard-table',
  'athlete-grid',
  'score-card',
  'team-summary',
  'apparatus-scores',
  'event-bar',
  'medal-table',
  'sponsor-grid',
  'athlete-stats',
  'rotation-progress',
  'team-comparison'
];

const PLANNED_SKELETONS = [
  'full-screen-card',
  'lower-third',
  'full-bleed',
  'split-screen'
];

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
 * Check if a skeleton file exists (HTML or CSS)
 * Returns true if either .html or .css exists
 */
function skeletonExists(skeletonName) {
  const htmlPath = path.join(SKELETONS_DIR, `${skeletonName}.html`);
  const cssPath = path.join(SKELETONS_DIR, `${skeletonName}.css`);
  return fs.existsSync(htmlPath) || fs.existsSync(cssPath);
}

/**
 * Check if a block file exists (.js file required)
 * Returns true if .js file exists
 */
function blockExists(blockName) {
  const jsPath = path.join(BLOCKS_DIR, `${blockName}.js`);
  return fs.existsSync(jsPath);
}

/**
 * Extract themeVars array from a block JS file using regex
 * Returns array of variable names or empty array if not found
 */
function extractThemeVars(blockName) {
  const jsPath = path.join(BLOCKS_DIR, `${blockName}.js`);
  if (!fs.existsSync(jsPath)) return [];

  try {
    const content = fs.readFileSync(jsPath, 'utf8');
    // Match themeVars: [...] pattern
    const match = content.match(/themeVars\s*:\s*\[([\s\S]*?)\]/);
    if (!match) return [];

    // Extract quoted strings from the array
    const arrayContent = match[1];
    const varMatches = arrayContent.match(/'[^']+'/g) || arrayContent.match(/"[^"]+"/g) || [];
    return varMatches.map(v => v.replace(/['"]/g, ''));
  } catch (err) {
    return [];
  }
}

/**
 * Extract --meet-* CSS variable references from a block CSS file
 * Returns array of variable names used in var() calls
 */
function extractCssThemeVars(blockName) {
  const cssPath = path.join(BLOCKS_DIR, `${blockName}.css`);
  if (!fs.existsSync(cssPath)) return [];

  try {
    const content = fs.readFileSync(cssPath, 'utf8');
    // Match var(--meet-*) patterns
    const matches = content.match(/var\s*\(\s*--meet-[a-z-]+/g) || [];
    // Extract just the variable names
    const vars = matches.map(m => {
      const varMatch = m.match(/--meet-[a-z-]+/);
      return varMatch ? varMatch[0] : null;
    }).filter(Boolean);
    // Deduplicate
    return [...new Set(vars)];
  } catch (err) {
    return [];
  }
}

/**
 * Validate themeVars for a block - compare declared vs used
 * Returns array of warning messages (empty = no warnings)
 */
function validateBlockThemeVars(blockName) {
  const warnings = [];

  // Skip if already validated
  if (validatedBlocks.has(blockName)) return [];
  validatedBlocks.add(blockName);

  // Skip _sample-block
  if (blockName.startsWith('_')) return [];

  const declaredVars = extractThemeVars(blockName);
  const usedVars = extractCssThemeVars(blockName);

  // Check for variables declared but not used in CSS
  for (const varName of declaredVars) {
    if (!usedVars.includes(varName)) {
      warnings.push(`Block '${blockName}': themeVars declares '${varName}' but it's not used in ${blockName}.css`);
    }
  }

  // Check for variables used in CSS but not declared
  for (const varName of usedVars) {
    if (!declaredVars.includes(varName)) {
      warnings.push(`Block '${blockName}': CSS uses '${varName}' but it's not declared in themeVars`);
    }
  }

  return warnings;
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
    } else if (!skeletonExists(manifest.skeleton)) {
      errors.push(`${relPath}: Skeleton '${manifest.skeleton}' not found. Expected: stage/skeletons/${manifest.skeleton}.html (or .css)`);
    }
    if (!manifest.blocks || !Array.isArray(manifest.blocks) || manifest.blocks.length === 0) {
      errors.push(`${relPath}: Stage renderer requires non-empty 'blocks' array`);
    } else {
      // Validate each block exists
      for (const blockName of manifest.blocks) {
        if (!blockExists(blockName)) {
          errors.push(`${relPath}: Block '${blockName}' not found. Expected: stage/blocks/${blockName}.js`);
        }
      }
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
 * Generate the ES module output for show-controller
 */
function generateJsOutput(manifests, categories) {
  const timestamp = new Date().toISOString();

  // Build GRAPHICS object keyed by id
  const graphicsObject = {};
  for (const manifest of manifests) {
    // Create a clean copy without internal fields
    const entry = { ...manifest };
    delete entry._sourceFile;
    graphicsObject[manifest.id] = entry;
  }

  // Generate the JS module content
  const jsContent = `/**
 * Graphics Registry - Auto-Generated
 *
 * DO NOT EDIT THIS FILE MANUALLY.
 * Generated by scripts/buildGraphicsRegistry.js
 *
 * @generated ${timestamp}
 */

/**
 * Complete registry of all graphics keyed by ID
 * @type {Object.<string, GraphicDefinition>}
 */
export const GRAPHICS = ${JSON.stringify(graphicsObject, null, 2)};

/**
 * Categories definition from categories.json
 */
export const CATEGORIES = ${JSON.stringify(categories, null, 2)};
`;

  return jsContent;
}

/**
 * Generate the JSON output for server-side use
 */
function generateJsonOutput(manifests, categories) {
  const timestamp = new Date().toISOString();

  // Build graphics array without internal fields
  const graphics = manifests.map(manifest => {
    const entry = { ...manifest };
    delete entry._sourceFile;
    return entry;
  });

  // Build keyed object as well for quick lookup
  const graphicsByKey = {};
  for (const g of graphics) {
    graphicsByKey[g.id] = g;
  }

  return {
    generatedAt: timestamp,
    graphics: graphicsByKey,
    graphicsArray: graphics,
    categories
  };
}

/**
 * Write output files
 */
function writeOutputFiles(manifests, categories) {
  // Generate JS module for show-controller
  const jsContent = generateJsOutput(manifests, categories);
  fs.writeFileSync(OUTPUT_JS_FILE, jsContent, 'utf8');
  console.log(`Generated: ${path.relative(PROJECT_ROOT, OUTPUT_JS_FILE)}`);

  // Generate JSON for server
  const jsonContent = generateJsonOutput(manifests, categories);
  fs.writeFileSync(OUTPUT_JSON_FILE, JSON.stringify(jsonContent, null, 2), 'utf8');
  console.log(`Generated: ${path.relative(PROJECT_ROOT, OUTPUT_JSON_FILE)}`);
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

  // Step 5: Validate themeVars for stage blocks (warnings only)
  console.log('Checking themeVars CSS consistency...');
  const themeVarsWarnings = [];

  for (const manifest of manifests) {
    if (manifest.renderer === 'stage' && manifest.blocks) {
      for (const blockName of manifest.blocks) {
        const warnings = validateBlockThemeVars(blockName);
        themeVarsWarnings.push(...warnings);
      }
    }
  }

  if (themeVarsWarnings.length > 0) {
    console.log('\n=== THEME VARS WARNINGS ===\n');
    for (const warning of themeVarsWarnings) {
      console.log(`  WARNING: ${warning}`);
    }
    console.log(`\nTotal warnings: ${themeVarsWarnings.length}`);
    console.log('Note: Warnings do not fail the build.\n');
  } else {
    console.log('All block themeVars consistent with CSS.\n');
  }

  // Step 6: Generate output files
  console.log('Generating output files...');
  writeOutputFiles(manifests, categories);

  // Step 7: Summary output
  console.log('\nManifest summary:');

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

  // One-line migration summary
  console.log(`\n${getMigrationSummary(manifests)}`);
  console.log('\nBuild complete.');
}

/**
 * Generate ASCII progress bar
 * @param {number} current - Current count
 * @param {number} total - Total count
 * @param {number} width - Bar width in characters
 * @returns {string} Progress bar string
 */
function progressBar(current, total, width = 20) {
  const percent = total > 0 ? current / total : 0;
  const filled = Math.round(percent * width);
  const empty = width - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  return `[${bar}] ${current}/${total}`;
}

/**
 * Get list of existing blocks (excluding _sample-block)
 */
function getExistingBlocks() {
  const blocks = [];
  if (!fs.existsSync(BLOCKS_DIR)) return blocks;

  const entries = fs.readdirSync(BLOCKS_DIR);
  for (const entry of entries) {
    if (entry.endsWith('.js') && !entry.startsWith('_')) {
      blocks.push(entry.replace('.js', ''));
    }
  }
  return blocks;
}

/**
 * Get list of existing skeletons
 */
function getExistingSkeletons() {
  const skeletons = [];
  if (!fs.existsSync(SKELETONS_DIR)) return skeletons;

  const entries = fs.readdirSync(SKELETONS_DIR);
  const seen = new Set();
  for (const entry of entries) {
    if (entry.endsWith('.html') || entry.endsWith('.css')) {
      const name = entry.replace(/\.(html|css)$/, '');
      if (!seen.has(name)) {
        seen.add(name);
        skeletons.push(name);
      }
    }
  }
  return skeletons;
}

/**
 * Find blocked graphics (stage manifest but missing blocks)
 */
function findBlockedGraphics(manifests) {
  const blocked = [];

  for (const manifest of manifests) {
    if (manifest.renderer === 'stage' && manifest.blocks) {
      const missingBlocks = [];
      for (const blockName of manifest.blocks) {
        if (!blockExists(blockName)) {
          missingBlocks.push(blockName);
        }
      }
      if (missingBlocks.length > 0) {
        blocked.push({
          id: manifest.id,
          missingBlocks
        });
      }
    }
  }

  return blocked;
}

/**
 * Print detailed migration status report
 */
function printStatusReport() {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║              RENDERER SYSTEM MIGRATION STATUS                 ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  // Load categories
  if (!fs.existsSync(CATEGORIES_FILE)) {
    console.error('ERROR: Categories file not found');
    process.exit(1);
  }
  const categories = loadJSON(CATEGORIES_FILE);
  if (!categories) {
    console.error('ERROR: Failed to parse categories.json');
    process.exit(1);
  }

  // Find all manifests
  const manifestFiles = findManifestFiles(GRAPHICS_DIR);
  const manifests = [];
  for (const filePath of manifestFiles) {
    const manifest = loadJSON(filePath);
    if (manifest) {
      manifest._sourceFile = path.relative(PROJECT_ROOT, filePath);
      manifests.push(manifest);
    }
  }

  // === BLOCKS SECTION ===
  console.log('┌───────────────────────────────────────────────────────────────┐');
  console.log('│  BLOCKS                                                       │');
  console.log('└───────────────────────────────────────────────────────────────┘');

  const existingBlocks = getExistingBlocks();
  const builtBlocksCount = existingBlocks.length;
  const plannedBlocksCount = PLANNED_BLOCKS.length;

  console.log(`\n  Progress: ${progressBar(builtBlocksCount, plannedBlocksCount)}`);
  console.log();

  for (const block of PLANNED_BLOCKS) {
    const exists = existingBlocks.includes(block);
    const icon = exists ? '✓' : '✗';
    const color = exists ? '\x1b[32m' : '\x1b[31m';
    const reset = '\x1b[0m';
    console.log(`  ${color}${icon}${reset} ${block}`);
  }

  // Show any extra blocks not in planned list
  const extraBlocks = existingBlocks.filter(b => !PLANNED_BLOCKS.includes(b));
  if (extraBlocks.length > 0) {
    console.log('\n  Extra blocks (not in catalog):');
    for (const block of extraBlocks) {
      console.log(`  \x1b[33m+\x1b[0m ${block}`);
    }
  }
  console.log();

  // === SKELETONS SECTION ===
  console.log('┌───────────────────────────────────────────────────────────────┐');
  console.log('│  SKELETONS                                                    │');
  console.log('└───────────────────────────────────────────────────────────────┘');

  const existingSkeletons = getExistingSkeletons();
  const builtSkeletonsCount = existingSkeletons.length;
  const plannedSkeletonsCount = PLANNED_SKELETONS.length;

  console.log(`\n  Progress: ${progressBar(builtSkeletonsCount, plannedSkeletonsCount)}`);
  console.log();

  for (const skeleton of PLANNED_SKELETONS) {
    const exists = existingSkeletons.includes(skeleton);
    const icon = exists ? '✓' : '✗';
    const color = exists ? '\x1b[32m' : '\x1b[31m';
    const reset = '\x1b[0m';
    console.log(`  ${color}${icon}${reset} ${skeleton}`);
  }

  // Show any extra skeletons not in planned list
  const extraSkeletons = existingSkeletons.filter(s => !PLANNED_SKELETONS.includes(s));
  if (extraSkeletons.length > 0) {
    console.log('\n  Extra skeletons (not in catalog):');
    for (const skeleton of extraSkeletons) {
      console.log(`  \x1b[33m+\x1b[0m ${skeleton}`);
    }
  }
  console.log();

  // === GRAPHICS SECTION ===
  console.log('┌───────────────────────────────────────────────────────────────┐');
  console.log('│  GRAPHICS BY CATEGORY                                         │');
  console.log('└───────────────────────────────────────────────────────────────┘');

  // Count graphics by category and renderer
  const stageGraphics = manifests.filter(m => m.renderer === 'stage');
  const legacyGraphics = manifests.filter(m => m.renderer !== 'stage');
  const totalGraphics = manifests.length;
  const migratedCount = stageGraphics.length;

  console.log(`\n  Overall: ${progressBar(migratedCount, totalGraphics)} migrated to stage engine`);
  console.log();

  // Group by category
  const byCategory = {};
  for (const m of manifests) {
    const cat = m.category || 'unknown';
    if (!byCategory[cat]) {
      byCategory[cat] = { stage: [], legacy: [] };
    }
    if (m.renderer === 'stage') {
      byCategory[cat].stage.push(m.id);
    } else {
      byCategory[cat].legacy.push(m.id);
    }
  }

  // Sort categories by order from categories.json
  const sortedCategories = Object.keys(byCategory).sort((a, b) => {
    const orderA = categories[a]?.order || 999;
    const orderB = categories[b]?.order || 999;
    return orderA - orderB;
  });

  for (const cat of sortedCategories) {
    const data = byCategory[cat];
    const catLabel = categories[cat]?.label || cat;
    const total = data.stage.length + data.legacy.length;
    const migrated = data.stage.length;

    console.log(`  ${catLabel}:`);
    console.log(`    ${progressBar(migrated, total, 15)}`);

    if (data.stage.length > 0) {
      console.log(`    \x1b[32m✓ Migrated:\x1b[0m ${data.stage.join(', ')}`);
    }
    if (data.legacy.length > 0) {
      const legacyStr = data.legacy.length > 5
        ? data.legacy.slice(0, 5).join(', ') + ` (+${data.legacy.length - 5} more)`
        : data.legacy.join(', ');
      console.log(`    \x1b[90m○ Legacy:\x1b[0m ${legacyStr}`);
    }
    console.log();
  }

  // === BLOCKED GRAPHICS SECTION ===
  const blockedGraphics = findBlockedGraphics(manifests);
  if (blockedGraphics.length > 0) {
    console.log('┌───────────────────────────────────────────────────────────────┐');
    console.log('│  BLOCKED GRAPHICS (manifest ready, blocks missing)           │');
    console.log('└───────────────────────────────────────────────────────────────┘');
    console.log();

    for (const item of blockedGraphics) {
      console.log(`  \x1b[33m⚠\x1b[0m ${item.id}`);
      console.log(`    Missing: ${item.missingBlocks.join(', ')}`);
    }
    console.log();
  }

  // === SUMMARY ===
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  SUMMARY                                                      ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log();
  console.log(`  Graphics:  ${migratedCount}/${totalGraphics} migrated (${Math.round(migratedCount/totalGraphics*100)}%)`);
  console.log(`  Blocks:    ${builtBlocksCount}/${plannedBlocksCount} built (${Math.round(builtBlocksCount/plannedBlocksCount*100)}%)`);
  console.log(`  Skeletons: ${builtSkeletonsCount}/${plannedSkeletonsCount} built (${Math.round(builtSkeletonsCount/plannedSkeletonsCount*100)}%)`);
  if (blockedGraphics.length > 0) {
    console.log(`  Blocked:   ${blockedGraphics.length} graphics waiting on blocks`);
  }
  console.log();
}

/**
 * Generate one-line migration summary for normal build output
 */
function getMigrationSummary(manifests) {
  const existingBlocks = getExistingBlocks();
  const existingSkeletons = getExistingSkeletons();

  const stageCount = manifests.filter(m => m.renderer === 'stage').length;
  const totalCount = manifests.length;
  const blocksBuilt = existingBlocks.length;
  const blocksPlanned = PLANNED_BLOCKS.length;
  const skeletonsBuilt = existingSkeletons.length;
  const skeletonsPlanned = PLANNED_SKELETONS.length;

  return `Migration: ${stageCount}/${totalCount} graphics, ${blocksBuilt}/${blocksPlanned} blocks, ${skeletonsBuilt}/${skeletonsPlanned} skeletons`;
}

// Run
if (STATUS_MODE) {
  printStatusReport();
} else {
  build();
}
