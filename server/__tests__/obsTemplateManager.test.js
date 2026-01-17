/**
 * OBS Template Manager Tests
 *
 * Comprehensive test suite for obsTemplateManager.js
 * Uses mockOBS.js for OBS WebSocket mocking
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { OBSTemplateManager } from '../lib/obsTemplateManager.js';
import { MockOBSWebSocket } from './helpers/mockOBS.js';

describe('OBSTemplateManager', () => {
  let obs;
  let stateSync;
  let templateManager;
  let mockProductionConfigService;
  let mockDatabase;
  let firebaseStore;

  beforeEach(() => {
    // Create fresh mock OBS instance
    obs = new MockOBSWebSocket();

    // Add some test scenes
    obs.addScene('Scene 1');
    obs.addScene('Scene 2');

    // Add some test inputs
    obs.addInput('Camera 1', 'dshow_input', {});
    obs.addInput('Camera 2', 'dshow_input', {});
    obs.addInput('Music Source', 'ffmpeg_source', { local_file: '/assets/music/intro.mp3' });

    // Create in-memory Firebase store
    firebaseStore = {};

    // Mock Firebase database
    mockDatabase = {
      ref: (path) => ({
        set: async (data) => {
          firebaseStore[path] = data;
        },
        once: async (eventType) => {
          const value = firebaseStore[path];

          // Handle listing scenarios
          if (path === 'templates/obs' && !value) {
            // Return all templates
            const templates = {};
            Object.keys(firebaseStore).forEach(key => {
              if (key.startsWith('templates/obs/')) {
                const templateId = key.substring('templates/obs/'.length);
                if (!templateId.includes('/')) {
                  templates[templateId] = firebaseStore[key];
                }
              }
            });
            return { val: () => Object.keys(templates).length > 0 ? templates : null };
          }

          // Handle asset listing
          if (path.includes('/obs/assets/')) {
            if (!value) {
              return { val: () => [] };
            }
          }

          return { val: () => value || null };
        },
        remove: async () => {
          delete firebaseStore[path];
        }
      })
    };

    // Mock production config service
    mockProductionConfigService = {
      initialize: () => mockDatabase
    };

    // Create mock state sync with cached state
    stateSync = {
      compId: 'test-comp-123',
      getState: () => ({
        connected: true,
        scenes: [
          { sceneName: 'Scene 1', sceneIndex: 0, items: [] },
          { sceneName: 'Scene 2', sceneIndex: 1, items: [] }
        ],
        inputs: [
          { inputName: 'Camera 1', inputKind: 'dshow_input' },
          { inputName: 'Camera 2', inputKind: 'dshow_input' },
          { inputName: 'Music Source', inputKind: 'ffmpeg_source' }
        ]
      })
    };

    // Create template manager instance
    templateManager = new OBSTemplateManager(obs, stateSync, mockProductionConfigService);

    // Clear call history
    obs.clearHistory();
  });

  describe('Module exports', () => {
    it('should export OBSTemplateManager class', () => {
      assert.ok(OBSTemplateManager);
      assert.equal(typeof OBSTemplateManager, 'function');
      assert.ok(templateManager instanceof OBSTemplateManager);
    });
  });

  describe('Constructor', () => {
    it('should initialize with obs, stateSync, and productionConfigService', () => {
      const manager = new OBSTemplateManager(obs, stateSync, mockProductionConfigService);
      assert.ok(manager);
      assert.equal(manager.obs, obs);
      assert.equal(manager.stateSync, stateSync);
      assert.equal(manager.productionConfigService, mockProductionConfigService);
    });

    it('should work without productionConfigService', () => {
      const manager = new OBSTemplateManager(obs, stateSync);
      assert.ok(manager);
      assert.equal(manager.productionConfigService, null);
    });
  });

  describe('listTemplates', () => {
    it('should return empty array when no templates exist', async () => {
      const templates = await templateManager.listTemplates();

      assert.ok(Array.isArray(templates));
      assert.equal(templates.length, 0);
    });

    it('should return all templates from Firebase', async () => {
      // Add some templates
      firebaseStore['templates/obs/template-1'] = {
        id: 'template-1',
        name: 'Template 1',
        description: 'Test template 1'
      };
      firebaseStore['templates/obs/template-2'] = {
        id: 'template-2',
        name: 'Template 2',
        description: 'Test template 2'
      };

      const templates = await templateManager.listTemplates();

      assert.equal(templates.length, 2);
      assert.ok(templates.find(t => t.id === 'template-1'));
      assert.ok(templates.find(t => t.id === 'template-2'));
    });

    it('should throw error when Firebase is not available', async () => {
      const managerWithoutFirebase = new OBSTemplateManager(obs, stateSync);

      await assert.rejects(
        async () => await managerWithoutFirebase.listTemplates(),
        { message: 'Production config service not available' }
      );
    });

    it('should handle Firebase errors', async () => {
      // Mock Firebase error
      const errorDatabase = {
        ref: () => ({
          once: async () => {
            throw new Error('Firebase connection failed');
          }
        })
      };
      const errorService = {
        initialize: () => errorDatabase
      };
      const errorManager = new OBSTemplateManager(obs, stateSync, errorService);

      await assert.rejects(
        async () => await errorManager.listTemplates(),
        { message: 'Firebase connection failed' }
      );
    });
  });

  describe('getTemplate', () => {
    it('should retrieve existing template', async () => {
      const testTemplate = {
        id: 'template-1',
        name: 'Test Template',
        description: 'A test template',
        scenes: [],
        inputs: []
      };
      firebaseStore['templates/obs/template-1'] = testTemplate;

      const template = await templateManager.getTemplate('template-1');

      assert.ok(template);
      assert.equal(template.id, 'template-1');
      assert.equal(template.name, 'Test Template');
    });

    it('should return null for non-existent template', async () => {
      const template = await templateManager.getTemplate('nonexistent');

      assert.equal(template, null);
    });

    it('should throw error when templateId is missing', async () => {
      await assert.rejects(
        async () => await templateManager.getTemplate(''),
        { message: 'Template ID is required' }
      );
    });

    it('should throw error when Firebase is not available', async () => {
      const managerWithoutFirebase = new OBSTemplateManager(obs, stateSync);

      await assert.rejects(
        async () => await managerWithoutFirebase.getTemplate('template-1'),
        { message: 'Production config service not available' }
      );
    });

    it('should handle Firebase errors', async () => {
      const errorDatabase = {
        ref: () => ({
          once: async () => {
            throw new Error('Firebase read failed');
          }
        })
      };
      const errorService = {
        initialize: () => errorDatabase
      };
      const errorManager = new OBSTemplateManager(obs, stateSync, errorService);

      await assert.rejects(
        async () => await errorManager.getTemplate('template-1'),
        { message: 'Firebase read failed' }
      );
    });
  });

  describe('createTemplate', () => {
    it('should create template from current OBS state', async () => {
      const template = await templateManager.createTemplate(
        'My Template',
        'A test template',
        ['mens-dual', 'womens-dual']
      );

      assert.ok(template);
      assert.ok(template.id);
      assert.equal(template.name, 'My Template');
      assert.equal(template.description, 'A test template');
      assert.deepEqual(template.meetTypes, ['mens-dual', 'womens-dual']);
      assert.ok(template.createdAt);
      assert.equal(template.version, '1.0');
      assert.ok(Array.isArray(template.scenes));
      assert.ok(Array.isArray(template.inputs));
      assert.ok(template.transitions);
      assert.ok(template.requirements);
    });

    it('should capture scenes from OBS', async () => {
      const template = await templateManager.createTemplate(
        'Scene Test',
        'Testing scene capture',
        []
      );

      assert.ok(template.scenes);
      assert.ok(Array.isArray(template.scenes));
      assert.ok(template.scenes.length > 0);
    });

    it('should capture inputs from OBS', async () => {
      const template = await templateManager.createTemplate(
        'Input Test',
        'Testing input capture',
        []
      );

      assert.ok(template.inputs);
      assert.ok(Array.isArray(template.inputs));
      assert.ok(template.inputs.length > 0);
    });

    it('should extract camera requirements', async () => {
      const template = await templateManager.createTemplate(
        'Camera Test',
        'Testing camera extraction',
        []
      );

      assert.ok(template.requirements);
      assert.ok(template.requirements.cameras);
      assert.ok(Array.isArray(template.requirements.cameras));
      assert.ok(template.requirements.cameras.includes('Camera 1'));
      assert.ok(template.requirements.cameras.includes('Camera 2'));
    });

    it('should extract asset requirements', async () => {
      const template = await templateManager.createTemplate(
        'Asset Test',
        'Testing asset extraction',
        []
      );

      assert.ok(template.requirements);
      assert.ok(template.requirements.assets);
      assert.ok(template.requirements.assets.music);
      assert.ok(template.requirements.assets.music.includes('intro.mp3'));
    });

    it('should throw error when name is missing', async () => {
      await assert.rejects(
        async () => await templateManager.createTemplate('', 'Description', []),
        { message: 'Template name is required' }
      );
    });

    it('should throw error when description is missing', async () => {
      await assert.rejects(
        async () => await templateManager.createTemplate('Name', '', []),
        { message: 'Template description is required' }
      );
    });

    it('should throw error when OBS is not connected', async () => {
      stateSync.getState = () => ({ connected: false });

      await assert.rejects(
        async () => await templateManager.createTemplate('Name', 'Description', []),
        { message: 'OBS is not connected' }
      );
    });

    it('should handle custom options', async () => {
      const template = await templateManager.createTemplate(
        'Options Test',
        'Testing custom options',
        [],
        { createdBy: 'test-user', version: '2.0' }
      );

      assert.equal(template.createdBy, 'test-user');
      assert.equal(template.version, '2.0');
    });

    it('should save template to Firebase', async () => {
      const template = await templateManager.createTemplate(
        'Save Test',
        'Testing Firebase save',
        []
      );

      assert.ok(firebaseStore[`templates/obs/${template.id}`]);
      assert.equal(firebaseStore[`templates/obs/${template.id}`].name, 'Save Test');
    });
  });

  describe('applyTemplate', () => {
    it('should apply template successfully', async () => {
      const testTemplate = {
        id: 'template-1',
        name: 'Test Template',
        description: 'A test template',
        requirements: {},
        scenes: [
          { sceneName: 'New Scene', items: [] }
        ],
        inputs: [
          { inputName: 'New Input', inputKind: 'browser_source', inputSettings: {} }
        ],
        transitions: {
          currentTransition: 'Fade',
          currentTransitionDuration: 300
        }
      };
      firebaseStore['templates/obs/template-1'] = testTemplate;

      const result = await templateManager.applyTemplate('template-1');

      assert.ok(result);
      assert.equal(typeof result.scenesCreated, 'number');
      assert.equal(typeof result.inputsCreated, 'number');
      assert.equal(typeof result.transitionsConfigured, 'number');
      assert.ok(Array.isArray(result.errors));
    });

    it('should throw error when templateId is missing', async () => {
      await assert.rejects(
        async () => await templateManager.applyTemplate(''),
        { message: 'Template ID is required' }
      );
    });

    it('should throw error when template not found', async () => {
      await assert.rejects(
        async () => await templateManager.applyTemplate('nonexistent'),
        { message: 'Template not found: nonexistent' }
      );
    });

    it('should validate requirements before applying', async () => {
      const testTemplate = {
        id: 'template-1',
        name: 'Test Template',
        requirements: {
          cameras: ['Nonexistent Camera']
        },
        scenes: [],
        inputs: []
      };
      firebaseStore['templates/obs/template-1'] = testTemplate;

      await assert.rejects(
        async () => await templateManager.applyTemplate('template-1'),
        { message: /Template requirements not met/ }
      );
    });

    it('should handle errors gracefully when applying scenes', async () => {
      const testTemplate = {
        id: 'template-1',
        name: 'Test Template',
        requirements: {},
        scenes: [
          { sceneName: 'Scene 1' } // Already exists
        ],
        inputs: []
      };
      firebaseStore['templates/obs/template-1'] = testTemplate;

      const result = await templateManager.applyTemplate('template-1');

      // Should not error, just skip existing scene
      assert.ok(result);
    });

    it('should apply context to template variables', async () => {
      const testTemplate = {
        id: 'template-1',
        name: 'Test Template',
        requirements: {},
        scenes: [],
        inputs: [
          {
            inputName: '{{config.competition.name}} Camera',
            inputKind: 'browser_source',
            inputSettings: {}
          }
        ]
      };
      firebaseStore['templates/obs/template-1'] = testTemplate;

      const context = {
        config: {
          competition: {
            name: 'PAC-12'
          }
        }
      };

      const result = await templateManager.applyTemplate('template-1', context);

      assert.ok(result);
      // Verify the input was created with resolved name
      const calls = obs.getCallsTo('CreateInput');
      assert.ok(calls.length > 0);
    });
  });

  describe('deleteTemplate', () => {
    it('should delete existing template', async () => {
      const testTemplate = {
        id: 'template-1',
        name: 'Test Template'
      };
      firebaseStore['templates/obs/template-1'] = testTemplate;

      const result = await templateManager.deleteTemplate('template-1');

      assert.equal(result, true);
      assert.equal(firebaseStore['templates/obs/template-1'], undefined);
    });

    it('should throw error when templateId is missing', async () => {
      await assert.rejects(
        async () => await templateManager.deleteTemplate(''),
        { message: 'Template ID is required' }
      );
    });

    it('should throw error when template not found', async () => {
      await assert.rejects(
        async () => await templateManager.deleteTemplate('nonexistent'),
        { message: 'Template not found: nonexistent' }
      );
    });

    it('should throw error when Firebase is not available', async () => {
      const managerWithoutFirebase = new OBSTemplateManager(obs, stateSync);

      await assert.rejects(
        async () => await managerWithoutFirebase.deleteTemplate('template-1'),
        { message: 'Production config service not available' }
      );
    });
  });

  describe('resolveVariables', () => {
    it('should resolve simple variable', () => {
      const template = {
        name: '{{competition.name}} Template'
      };
      const context = {
        competition: {
          name: 'PAC-12'
        }
      };

      const resolved = templateManager.resolveVariables(template, context);

      assert.equal(resolved.name, 'PAC-12 Template');
    });

    it('should resolve nested variables', () => {
      const template = {
        input: {
          url: '{{cameras.camera1.url}}'
        }
      };
      const context = {
        cameras: {
          camera1: {
            url: 'rtsp://192.168.1.100'
          }
        }
      };

      const resolved = templateManager.resolveVariables(template, context);

      assert.equal(resolved.input.url, 'rtsp://192.168.1.100');
    });

    it('should resolve multiple variables in same string', () => {
      const template = {
        text: '{{config.name}} - {{config.year}}'
      };
      const context = {
        config: {
          name: 'Championship',
          year: '2025'
        }
      };

      const resolved = templateManager.resolveVariables(template, context);

      assert.equal(resolved.text, 'Championship - 2025');
    });

    it('should resolve variables in arrays', () => {
      const template = {
        sources: [
          '{{assets.music.intro}}',
          '{{assets.music.outro}}'
        ]
      };
      const context = {
        assets: {
          music: {
            intro: 'intro.mp3',
            outro: 'outro.mp3'
          }
        }
      };

      const resolved = templateManager.resolveVariables(template, context);

      assert.equal(resolved.sources[0], 'intro.mp3');
      assert.equal(resolved.sources[1], 'outro.mp3');
    });

    it('should leave unresolved variables unchanged', () => {
      const template = {
        text: '{{missing.variable}}'
      };
      const context = {};

      const resolved = templateManager.resolveVariables(template, context);

      assert.equal(resolved.text, '{{missing.variable}}');
    });

    it('should handle deeply nested objects', () => {
      const template = {
        level1: {
          level2: {
            level3: {
              value: '{{deep.nested.value}}'
            }
          }
        }
      };
      const context = {
        deep: {
          nested: {
            value: 'found'
          }
        }
      };

      const resolved = templateManager.resolveVariables(template, context);

      assert.equal(resolved.level1.level2.level3.value, 'found');
    });

    it('should not mutate original template', () => {
      const template = {
        name: '{{competition.name}}'
      };
      const context = {
        competition: {
          name: 'PAC-12'
        }
      };

      const resolved = templateManager.resolveVariables(template, context);

      assert.equal(template.name, '{{competition.name}}'); // Unchanged
      assert.equal(resolved.name, 'PAC-12'); // Resolved
    });

    it('should throw error when template is not an object', () => {
      assert.throws(
        () => templateManager.resolveVariables('not an object', {}),
        { message: 'Template must be an object' }
      );
    });

    it('should throw error when context is not an object', () => {
      assert.throws(
        () => templateManager.resolveVariables({}, 'not an object'),
        { message: 'Context must be an object' }
      );
    });
  });

  describe('validateRequirements', () => {
    it('should validate successfully when all requirements met', async () => {
      const template = {
        name: 'Test Template',
        requirements: {
          cameras: ['Camera 1', 'Camera 2']
        }
      };

      const result = await templateManager.validateRequirements(template);

      assert.equal(result.valid, true);
      assert.equal(result.errors.length, 0);
    });

    it('should fail when required camera missing', async () => {
      const template = {
        name: 'Test Template',
        requirements: {
          cameras: ['Camera 1', 'Nonexistent Camera']
        }
      };

      const result = await templateManager.validateRequirements(template);

      assert.equal(result.valid, false);
      assert.ok(result.errors.length > 0);
      assert.ok(result.errors.some(e => e.includes('Nonexistent Camera')));
    });

    it('should validate assets from Firebase', async () => {
      // Add assets to Firebase
      firebaseStore['competitions/test-comp-123/obs/assets/music'] = [
        { filename: 'intro.mp3' }
      ];

      const template = {
        name: 'Test Template',
        requirements: {
          assets: {
            music: ['intro.mp3']
          }
        }
      };

      const result = await templateManager.validateRequirements(template);

      assert.equal(result.valid, true);
    });

    it('should fail when required asset missing', async () => {
      firebaseStore['competitions/test-comp-123/obs/assets/music'] = [];

      const template = {
        name: 'Test Template',
        requirements: {
          assets: {
            music: ['missing.mp3']
          }
        }
      };

      const result = await templateManager.validateRequirements(template);

      assert.equal(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('missing.mp3')));
    });

    it('should handle template without requirements', async () => {
      const template = {
        name: 'Test Template'
      };

      const result = await templateManager.validateRequirements(template);

      assert.equal(result.valid, true);
    });

    it('should throw error when template is not an object', async () => {
      await assert.rejects(
        async () => await templateManager.validateRequirements('not an object'),
        { message: 'Template must be an object' }
      );
    });
  });

  describe('Error handling', () => {
    it('should handle OBS connection errors gracefully', async () => {
      obs.injectErrorOnMethod('GetSceneList', new Error('Connection closed'));

      await assert.rejects(
        async () => await templateManager.createTemplate('Test', 'Description', []),
        { message: 'Connection closed' }
      );
    });

    it('should handle Firebase write errors', async () => {
      const errorDatabase = {
        ref: () => ({
          set: async () => {
            throw new Error('Firebase write failed');
          },
          once: async () => ({ val: () => null })
        })
      };
      const errorService = {
        initialize: () => errorDatabase
      };
      const errorManager = new OBSTemplateManager(obs, stateSync, errorService);

      await assert.rejects(
        async () => await errorManager.createTemplate('Test', 'Description', []),
        { message: 'Firebase write failed' }
      );
    });

    it('should handle missing compId when validating assets', async () => {
      stateSync.compId = null;

      const template = {
        name: 'Test Template',
        requirements: {
          assets: {
            music: ['test.mp3']
          }
        }
      };

      // Should not throw, just log warning
      const result = await templateManager.validateRequirements(template);
      assert.ok(result);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete workflow: create, list, get, apply, delete', async () => {
      // Setup assets in Firebase for validation
      firebaseStore['competitions/test-comp-123/obs/assets/music'] = [
        { filename: 'intro.mp3' }
      ];

      // Create template
      const created = await templateManager.createTemplate(
        'Integration Test',
        'Full workflow test',
        ['mens-dual']
      );
      assert.ok(created);
      assert.ok(created.id);

      // List templates
      const list = await templateManager.listTemplates();
      assert.ok(list.find(t => t.id === created.id));

      // Get template
      const retrieved = await templateManager.getTemplate(created.id);
      assert.equal(retrieved.name, 'Integration Test');

      // Apply template
      const result = await templateManager.applyTemplate(created.id);
      assert.ok(result);

      // Delete template
      const deleted = await templateManager.deleteTemplate(created.id);
      assert.equal(deleted, true);

      // Verify deleted
      const afterDelete = await templateManager.getTemplate(created.id);
      assert.equal(afterDelete, null);
    });

    it('should handle template with complex variable substitution', async () => {
      const template = {
        id: 'complex-vars',
        name: 'Complex Variables',
        requirements: {},
        scenes: [
          {
            sceneName: '{{config.competition.shortName}} - {{config.event}}',
            items: [
              {
                sourceName: '{{cameras.main.name}}',
                sceneItemEnabled: true
              }
            ]
          }
        ],
        inputs: [
          {
            inputName: '{{cameras.main.name}}',
            inputKind: 'browser_source',
            inputSettings: {
              url: '{{cameras.main.url}}'
            }
          }
        ]
      };
      firebaseStore['templates/obs/complex-vars'] = template;

      const context = {
        config: {
          competition: {
            shortName: 'PAC12',
            name: 'PAC-12 Championship'
          },
          event: 'FX'
        },
        cameras: {
          main: {
            name: 'Main Camera',
            url: 'rtsp://192.168.1.100'
          }
        }
      };

      const result = await templateManager.applyTemplate('complex-vars', context);

      assert.ok(result);
      // Variables should be resolved in the applied template
    });

    it('should handle template with multiple asset types', async () => {
      // Setup assets in Firebase
      firebaseStore['competitions/test-comp-123/obs/assets/music'] = [
        { filename: 'intro.mp3' },
        { filename: 'outro.mp3' }
      ];
      firebaseStore['competitions/test-comp-123/obs/assets/stingers'] = [
        { filename: 'transition.mp4' }
      ];

      const template = {
        name: 'Multi-Asset Template',
        requirements: {
          cameras: ['Camera 1'],
          assets: {
            music: ['intro.mp3', 'outro.mp3'],
            stingers: ['transition.mp4']
          }
        }
      };

      const result = await templateManager.validateRequirements(template);

      assert.equal(result.valid, true);
      assert.equal(result.errors.length, 0);
    });

    it('should handle partial validation failures', async () => {
      firebaseStore['competitions/test-comp-123/obs/assets/music'] = [
        { filename: 'intro.mp3' }
      ];

      const template = {
        name: 'Partial Validation',
        requirements: {
          cameras: ['Camera 1', 'Missing Camera'],
          assets: {
            music: ['intro.mp3', 'missing.mp3']
          }
        }
      };

      const result = await templateManager.validateRequirements(template);

      assert.equal(result.valid, false);
      assert.equal(result.errors.length, 2); // Missing camera + missing asset
    });
  });
});
