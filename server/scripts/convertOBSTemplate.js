#!/usr/bin/env node

/**
 * Convert Raw OBS JSON Template to Firebase Format
 *
 * This script parses the raw OBS scene collection JSON export and converts it
 * to the Firebase template format expected by obsTemplateManager.applyTemplate().
 *
 * Usage:
 *   node convertOBSTemplate.js <input-json> <output-json>
 *   node convertOBSTemplate.js --dual    # Convert dual meet template
 *   node convertOBSTemplate.js --quad    # Convert quad meet template
 *
 * The conversion:
 * 1. Extracts non-scene sources -> inputs[] (cameras, browser sources, media)
 * 2. Extracts scene sources -> scenes[] with their items[]
 * 3. Replaces hardcoded URLs with template variables
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Template variable mappings for URL replacement
const URL_VARIABLE_MAPPINGS = [
  // SRT camera URLs
  { pattern: /srt:\/\/[^"]+:11001[^"]*/g, variable: '{{cameras.cameraA.srtUrl}}' },
  { pattern: /srt:\/\/[^"]+:11002[^"]*/g, variable: '{{cameras.cameraB.srtUrl}}' },
  { pattern: /srt:\/\/[^"]+:11003[^"]*/g, variable: '{{cameras.cameraC.srtUrl}}' },
  { pattern: /srt:\/\/[^"]+:11004[^"]*/g, variable: '{{cameras.cameraD.srtUrl}}' },

  // VDO.Ninja talent URLs - these contain room and view IDs
  // Note: Individual talent URLs are replaced based on source name in replaceUrlVariablesWithContext
  { pattern: /https:\/\/vdo\.ninja\/\?view=[^"]+/g, variable: '{{talentComms.talentUrl}}' },

  // Graphics overlay URL
  { pattern: /https:\/\/commentarygraphic\.com\/output\.html\?comp=[^"]*/g, variable: '{{graphicsOverlay.url}}' },

  // Stream starting/ending overlays
  { pattern: /https:\/\/commentarygraphic\.com\/overlays\/stream\.html\?title=STREAM\+STARTING[^"]*/g, variable: '{{overlays.streamStarting}}' },
  { pattern: /https:\/\/commentarygraphic\.com\/overlays\/stream\.html\?title=THANKS[^"]*/g, variable: '{{overlays.streamEnding}}' },

  // Dual view frame overlay
  { pattern: /https:\/\/commentarygraphic\.com\/overlays\/frame-dual\.html[^"]*/g, variable: '{{overlays.dualFrame}}' },
];

// Source-name-specific variable mappings
const SOURCE_NAME_VARIABLE_MAPPINGS = {
  'Talent-1': { urlPattern: /https:\/\/vdo\.ninja\/[^"]+/g, variable: '{{talentComms.talent1Url}}' },
  'Talent-2': { urlPattern: /https:\/\/vdo\.ninja\/[^"]+/g, variable: '{{talentComms.talent2Url}}' },
  'Talent-3': { urlPattern: /https:\/\/vdo\.ninja\/[^"]+/g, variable: '{{talentComms.talent3Url}}' },
  'Talent-4': { urlPattern: /https:\/\/vdo\.ninja\/[^"]+/g, variable: '{{talentComms.talent4Url}}' },
  'replay - cam 1': { urlPattern: /.*/, variable: '{{replay.camera1Url}}' },
  'replay - cam 2 ': { urlPattern: /.*/, variable: '{{replay.camera2Url}}' },
  'replay - cam 2': { urlPattern: /.*/, variable: '{{replay.camera2Url}}' },
};

/**
 * Convert raw OBS JSON to Firebase template format
 */
function convertOBSTemplate(rawJson, templateMeta) {
  const sources = rawJson.sources || [];
  const sceneOrder = rawJson.scene_order || [];

  // Separate scenes from other sources
  const sceneSources = [];
  const inputSources = [];

  for (const source of sources) {
    if (source.id === 'scene') {
      sceneSources.push(source);
    } else {
      inputSources.push(source);
    }
  }

  // Build scene name to order index map
  const sceneOrderMap = {};
  sceneOrder.forEach((s, index) => {
    sceneOrderMap[s.name] = index;
  });

  // Convert inputs (non-scene sources)
  const inputs = inputSources.map(source => {
    const input = {
      inputName: source.name,
      inputKind: source.id,
      inputSettings: replaceUrlVariablesWithContext(source.settings || {}, source.name)
    };

    // Include audio settings if relevant
    if (source.volume !== undefined && source.volume !== 1.0) {
      input.volume = source.volume;
    }
    if (source.muted) {
      input.muted = source.muted;
    }

    return input;
  });

  // Convert scenes with their items
  const scenes = sceneSources
    .map(sceneSource => {
      const sceneIndex = sceneOrderMap[sceneSource.name];
      if (sceneIndex === undefined) {
        console.warn(`Scene "${sceneSource.name}" not in scene_order, skipping`);
        return null;
      }

      const items = (sceneSource.settings?.items || []).map(item => {
        return {
          sourceName: item.name,
          sceneItemId: item.id,
          sceneItemEnabled: item.visible !== false,
          sceneItemLocked: item.locked || false,
          sceneItemTransform: {
            positionX: item.pos?.x || 0,
            positionY: item.pos?.y || 0,
            rotation: item.rot || 0,
            scaleX: item.scale?.x || 1,
            scaleY: item.scale?.y || 1,
            cropLeft: item.crop_left || 0,
            cropRight: item.crop_right || 0,
            cropTop: item.crop_top || 0,
            cropBottom: item.crop_bottom || 0,
            boundsType: boundsTypeToString(item.bounds_type),
            boundsWidth: item.bounds?.x || 0,
            boundsHeight: item.bounds?.y || 0,
            boundsAlignment: item.bounds_align || 0,
            alignment: item.align || 5
          }
        };
      });

      return {
        sceneName: sceneSource.name,
        sceneIndex: sceneIndex,
        items: items
      };
    })
    .filter(s => s !== null)
    .sort((a, b) => a.sceneIndex - b.sceneIndex);

  // Build transitions config
  const transitions = {
    currentTransitionName: rawJson.current_transition || 'Fade',
    currentTransitionDuration: rawJson.transition_duration || 300
  };

  // Build complete template
  const template = {
    id: templateMeta.id,
    name: templateMeta.name,
    version: templateMeta.version || '2.0',
    description: templateMeta.description,
    meetTypes: templateMeta.meetTypes || [],
    createdAt: new Date().toISOString(),
    createdBy: 'convertOBSTemplate.js',
    updatedAt: new Date().toISOString(),
    inputs: inputs,
    scenes: scenes,
    transitions: transitions,
    requirements: extractRequirements(inputs, scenes)
  };

  return template;
}

/**
 * Replace hardcoded URLs with template variables
 */
function replaceUrlVariables(settings) {
  return replaceUrlVariablesWithContext(settings, null);
}

/**
 * Replace hardcoded URLs with template variables, with source name context
 */
function replaceUrlVariablesWithContext(settings, sourceName) {
  if (!settings || typeof settings !== 'object') {
    return settings;
  }

  const result = { ...settings };

  // Process URL fields
  for (const key of ['url', 'input', 'local_file']) {
    if (typeof result[key] === 'string') {
      // Check source-name-specific mappings first
      if (sourceName && SOURCE_NAME_VARIABLE_MAPPINGS[sourceName]) {
        const mapping = SOURCE_NAME_VARIABLE_MAPPINGS[sourceName];
        if (mapping.urlPattern.test(result[key])) {
          result[key] = mapping.variable;
          mapping.urlPattern.lastIndex = 0;
          continue;
        }
        mapping.urlPattern.lastIndex = 0;
      }

      // Fall back to general mappings
      for (const mapping of URL_VARIABLE_MAPPINGS) {
        if (mapping.pattern.test(result[key])) {
          result[key] = mapping.variable;
          break;
        }
        // Reset lastIndex for global regexes
        mapping.pattern.lastIndex = 0;
      }
    }
  }

  return result;
}

/**
 * Convert OBS bounds_type number to OBS WebSocket string
 */
function boundsTypeToString(boundsType) {
  const types = {
    0: 'OBS_BOUNDS_NONE',
    1: 'OBS_BOUNDS_STRETCH',
    2: 'OBS_BOUNDS_SCALE_INNER',
    3: 'OBS_BOUNDS_SCALE_OUTER',
    4: 'OBS_BOUNDS_SCALE_TO_WIDTH',
    5: 'OBS_BOUNDS_SCALE_TO_HEIGHT',
    6: 'OBS_BOUNDS_MAX_ONLY'
  };
  return types[boundsType] || 'OBS_BOUNDS_NONE';
}

/**
 * Extract requirements from inputs and scenes
 */
function extractRequirements(inputs, scenes) {
  const requirements = {
    cameras: [],
    browserSources: [],
    mediaSources: []
  };

  for (const input of inputs) {
    // Check for camera inputs (SRT sources)
    if (input.inputKind === 'ffmpeg_source' &&
        input.inputSettings?.input?.includes('{{cameras')) {
      const match = input.inputSettings.input.match(/cameras\.(\w+)/);
      if (match) {
        requirements.cameras.push(match[1]);
      }
    }

    // Check for browser sources
    if (input.inputKind === 'browser_source') {
      requirements.browserSources.push(input.inputName);
    }
  }

  return requirements;
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);

  let inputFile, outputFile, templateMeta;

  if (args.includes('--dual')) {
    inputFile = path.join(__dirname, '../config/sceneTemplates/20260119-obs-template-ai-dual.json');
    outputFile = path.join(__dirname, '../config/sceneTemplates/gymnastics-dual-v2-firebase.json');
    templateMeta = {
      id: 'gymnastics-dual-v1',
      name: 'Gymnastics Dual Meet',
      version: '2.0',
      description: 'Standard dual meet setup with 2 cameras (A & B). Includes full screen, dual view, replay, and graphics-only scenes. Full source definitions with transforms.',
      meetTypes: ['mens-dual', 'womens-dual']
    };
  } else if (args.includes('--quad')) {
    inputFile = path.join(__dirname, '../config/sceneTemplates/20260119-obs-template-ai-quad.json');
    outputFile = path.join(__dirname, '../config/sceneTemplates/gymnastics-quad-v2-firebase.json');
    templateMeta = {
      id: 'gymnastics-quad-v1',
      name: 'Gymnastics Quad Meet',
      version: '2.0',
      description: 'Quad meet setup with 4 cameras. Includes full screen, quad view, dual views, replay, and graphics-only scenes. Full source definitions with transforms.',
      meetTypes: ['mens-quad', 'womens-quad', 'mens-tri', 'womens-tri']
    };
  } else if (args.length >= 2) {
    inputFile = args[0];
    outputFile = args[1];
    templateMeta = {
      id: path.basename(outputFile, '.json'),
      name: 'Custom Template',
      version: '1.0',
      description: 'Converted from OBS scene collection',
      meetTypes: []
    };
  } else {
    console.log('Usage:');
    console.log('  node convertOBSTemplate.js <input-json> <output-json>');
    console.log('  node convertOBSTemplate.js --dual    # Convert dual meet template');
    console.log('  node convertOBSTemplate.js --quad    # Convert quad meet template');
    process.exit(1);
  }

  console.log(`Converting: ${inputFile}`);
  console.log(`Output: ${outputFile}`);

  // Read input
  const rawContent = fs.readFileSync(inputFile, 'utf8');
  const rawJson = JSON.parse(rawContent);

  // Convert
  const template = convertOBSTemplate(rawJson, templateMeta);

  // Write output
  fs.writeFileSync(outputFile, JSON.stringify(template, null, 2));

  console.log(`\nConversion complete!`);
  console.log(`  Inputs: ${template.inputs.length}`);
  console.log(`  Scenes: ${template.scenes.length}`);
  console.log(`  Total scene items: ${template.scenes.reduce((sum, s) => sum + s.items.length, 0)}`);

  // Print summary
  console.log('\nScenes:');
  for (const scene of template.scenes) {
    console.log(`  ${scene.sceneIndex}: ${scene.sceneName} (${scene.items.length} items)`);
  }

  console.log('\nInputs (sources):');
  const inputsByKind = {};
  for (const input of template.inputs) {
    inputsByKind[input.inputKind] = (inputsByKind[input.inputKind] || 0) + 1;
  }
  for (const [kind, count] of Object.entries(inputsByKind)) {
    console.log(`  ${kind}: ${count}`);
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
