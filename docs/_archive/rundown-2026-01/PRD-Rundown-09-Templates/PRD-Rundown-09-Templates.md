# PRD-Rundown-09: Template System (Phase 4)

**Version:** 1.0
**Date:** 2026-01-22
**Status:** Draft
**Depends On:** PRD-Rundown-06-BackendServices, PRD-Rundown-07-FrontendIntegration
**Blocks:** None

> **Master PRD:** [PRD-AdvancedRundownEditor-2026-01-22.md](../PRD-AdvancedRundownEditor-2026-01-22.md)
> **Section Reference:** Section 9 - Template System

---

## Overview

The Template System allows producers to:
- Save rundown configurations as reusable templates
- Load templates for new competitions
- Auto-load default templates based on meet type
- Use variable substitution for team names

---

## Scope

### In Scope
- Template CRUD operations
- Template application to competitions
- Variable substitution (team names, competition info)
- Default template auto-loading
- Template dropdown in Rundown Editor toolbar

### Out of Scope
- Template sharing between accounts
- Template versioning/history
- Template preview before applying

---

## Firebase Data Structure

### Template Path

```
templates/rundown/{meetType}/{templateId}
```

### Template Schema

```json
{
  "id": "womens-quad-default",
  "meetType": "womens-quad",
  "name": "Women's Quad - Standard",
  "description": "Standard format for 4-team women's meets",
  "version": "1.3",
  "isDefault": true,
  "createdAt": "2026-01-05T10:00:00Z",
  "modifiedAt": "2026-01-13T14:00:00Z",
  "createdBy": "producer@example.com",

  "metadata": {
    "estimatedDuration": 8100,
    "rotationCount": 4,
    "segmentCount": 45,
    "preShowDuration": 360
  },

  "segments": [
    {
      "name": "Show Intro",
      "type": "video",
      "timing": { "duration": 45, "autoAdvance": true },
      "obs": { "sceneId": "Starting Soon" }
    },
    {
      "name": "{{team1.name}} Introduction",
      "type": "live",
      "timing": { "duration": 10, "autoAdvance": true },
      "graphics": {
        "primary": {
          "graphicId": "team-stats",
          "parameters": { "teamId": "{{team1.id}}" }
        }
      }
    }
  ]
}
```

---

## Variable Substitution

### Available Variables

| Variable | Source | Example Value |
|----------|--------|---------------|
| `{{team1.name}}` | Competition config teams[0] | "UCLA" |
| `{{team1.id}}` | Competition config teams[0] | "ucla" |
| `{{team2.name}}` | Competition config teams[1] | "Oregon" |
| `{{team2.id}}` | Competition config teams[1] | "oregon" |
| `{{team3.name}}` | Competition config teams[2] | "Utah" |
| `{{team4.name}}` | Competition config teams[3] | "Arizona" |
| `{{competition.name}}` | Competition name | "Women's Quad Meet" |
| `{{competition.venue}}` | Competition venue | "Pauley Pavilion" |
| `{{competition.date}}` | Competition date | "2026-01-22" |
| `{{competition.gender}}` | Competition gender | "womens" |

### Substitution Logic

```javascript
function substituteVariables(template, competition) {
  const teams = competition.teams || [];
  const variables = {
    'team1.name': teams[0]?.name || 'Team 1',
    'team1.id': teams[0]?.id || 'team1',
    'team2.name': teams[1]?.name || 'Team 2',
    'team2.id': teams[1]?.id || 'team2',
    'team3.name': teams[2]?.name || 'Team 3',
    'team3.id': teams[2]?.id || 'team3',
    'team4.name': teams[3]?.name || 'Team 4',
    'team4.id': teams[3]?.id || 'team4',
    'competition.name': competition.name || 'Competition',
    'competition.venue': competition.venue || 'Venue',
    'competition.date': competition.date || '',
    'competition.gender': competition.gender || 'womens',
  };

  let result = JSON.stringify(template);

  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(regex, value);
  }

  return JSON.parse(result);
}
```

---

## Backend Service: rundownTemplateService.js

### Location
`server/lib/rundownTemplateService.js`

### Methods

```javascript
const admin = require('firebase-admin');

/**
 * List all templates, optionally filtered by meet type
 */
async function listTemplates(meetType = null) {
  const db = admin.database();
  let ref = db.ref('templates/rundown');

  if (meetType) {
    ref = ref.child(meetType);
  }

  const snapshot = await ref.once('value');
  const data = snapshot.val() || {};

  // Flatten nested structure
  const templates = [];
  if (meetType) {
    Object.values(data).forEach(t => templates.push(t));
  } else {
    Object.values(data).forEach(meetTypeTemplates => {
      Object.values(meetTypeTemplates).forEach(t => templates.push(t));
    });
  }

  return templates.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Get a specific template
 */
async function getTemplate(meetType, templateId) {
  const db = admin.database();
  const ref = db.ref(`templates/rundown/${meetType}/${templateId}`);

  const snapshot = await ref.once('value');
  return snapshot.val();
}

/**
 * Get the default template for a meet type
 */
async function getDefaultTemplate(meetType) {
  const templates = await listTemplates(meetType);
  return templates.find(t => t.isDefault) || templates[0] || null;
}

/**
 * Create a new template from current rundown
 */
async function createTemplate(compId, templateData) {
  const db = admin.database();
  const rundownService = require('./rundownService');

  // Get current rundown
  const { segments } = await rundownService.getRundown(compId);

  // Generate template ID
  const id = `template-${Date.now()}`;

  const template = {
    id,
    meetType: templateData.meetType,
    name: templateData.name,
    description: templateData.description || '',
    version: '1.0',
    isDefault: templateData.isDefault || false,
    createdAt: new Date().toISOString(),
    modifiedAt: new Date().toISOString(),
    createdBy: templateData.createdBy || 'system',
    metadata: {
      estimatedDuration: segments.reduce((sum, s) => sum + (s.timing?.duration || 0), 0),
      segmentCount: segments.length,
    },
    segments: segments.map(s => ({
      name: s.name,
      type: s.type,
      timing: s.timing,
      obs: s.obs,
      graphics: s.graphics,
      audio: s.audio,
      notes: s.notes,
      milestone: s.milestone,
    })),
  };

  // If setting as default, unset other defaults
  if (template.isDefault) {
    const existingTemplates = await listTemplates(template.meetType);
    const updates = {};
    existingTemplates
      .filter(t => t.isDefault && t.id !== id)
      .forEach(t => {
        updates[`templates/rundown/${template.meetType}/${t.id}/isDefault`] = false;
      });

    if (Object.keys(updates).length > 0) {
      await db.ref().update(updates);
    }
  }

  // Save template
  await db.ref(`templates/rundown/${template.meetType}/${id}`).set(template);

  return template;
}

/**
 * Apply a template to a competition
 */
async function applyTemplate(compId, templateId, meetType) {
  const db = admin.database();
  const rundownService = require('./rundownService');

  // Get template
  const template = await getTemplate(meetType, templateId);
  if (!template) {
    throw new Error(`Template ${templateId} not found`);
  }

  // Get competition for variable substitution
  const compSnapshot = await db.ref(`competitions/${compId}`).once('value');
  const competition = compSnapshot.val() || {};

  // Substitute variables
  const processedTemplate = substituteVariables(template, competition);

  // Clear existing rundown
  await db.ref(`competitions/${compId}/production/rundown/segments`).remove();

  // Create segments from template
  for (let i = 0; i < processedTemplate.segments.length; i++) {
    const segmentData = processedTemplate.segments[i];
    await rundownService.createSegment(compId, {
      ...segmentData,
      order: i,
    }, -1);
  }

  // Update metadata
  await db.ref(`competitions/${compId}/production/rundown/metadata`).update({
    templateId: template.id,
    templateAppliedAt: new Date().toISOString(),
  });

  return { segmentsCreated: processedTemplate.segments.length };
}

/**
 * Delete a template
 */
async function deleteTemplate(meetType, templateId) {
  const db = admin.database();
  await db.ref(`templates/rundown/${meetType}/${templateId}`).remove();
}

module.exports = {
  listTemplates,
  getTemplate,
  getDefaultTemplate,
  createTemplate,
  applyTemplate,
  deleteTemplate,
};
```

---

## API Routes

### Add to server/routes/rundown.js

```javascript
const templateService = require('../lib/rundownTemplateService');

// GET /api/rundown/templates - List templates
router.get('/templates', async (req, res) => {
  try {
    const meetType = req.query.meetType || null;
    const templates = await templateService.listTemplates(meetType);
    res.json({ templates });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/rundown/templates/:meetType/:id - Get template
router.get('/templates/:meetType/:id', async (req, res) => {
  try {
    const template = await templateService.getTemplate(
      req.params.meetType,
      req.params.id
    );
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json(template);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/rundown/templates - Create template from current rundown
router.post('/templates', async (req, res) => {
  try {
    const template = await templateService.createTemplate(req.compId, req.body);
    res.status(201).json(template);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/rundown/templates/:meetType/:id/apply - Apply template
router.post('/templates/:meetType/:id/apply', async (req, res) => {
  try {
    const result = await templateService.applyTemplate(
      req.compId,
      req.params.id,
      req.params.meetType
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/rundown/templates/:meetType/:id - Delete template
router.delete('/templates/:meetType/:id', async (req, res) => {
  try {
    await templateService.deleteTemplate(req.params.meetType, req.params.id);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

---

## Frontend: Template Dropdown

### UI in RundownEditorPage Toolbar

```
┌─ TOOLBAR ───────────────────────────────────────────────────────────────┐
│                                                                          │
│  [+ Add Segment]  [Templates ▼]  [Import CSV]  [↻ Sync OBS]             │
│                    │                                                     │
│                    └─────────────────────────────────────────────┐       │
│                    │ ─── Load Template ─────────────────────── │       │
│                    │ Women's Quad - Standard              ✓ Default │   │
│                    │ Women's Quad - Short Format                    │   │
│                    │ Women's Quad - Extended Pre-Show               │   │
│                    │ ────────────────────────────────────────────── │   │
│                    │ [Save Current as Template...]                  │   │
│                    └─────────────────────────────────────────────────┘   │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Implementation

```jsx
// components/rundown/TemplateDropdown.jsx

import { useState, useEffect } from 'react';
import { useShow } from '../../context/ShowContext';

export function TemplateDropdown({ onApply }) {
  const { competition } = useShow();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  const meetType = competition?.type; // e.g., "womens-quad"

  useEffect(() => {
    if (!meetType) return;

    async function fetchTemplates() {
      const response = await fetch(`/api/rundown/templates?meetType=${meetType}`);
      const data = await response.json();
      setTemplates(data.templates || []);
    }

    fetchTemplates();
  }, [meetType]);

  const handleApply = async (template) => {
    if (!confirm(`Apply template "${template.name}"? This will replace the current rundown.`)) {
      return;
    }

    setLoading(true);
    try {
      await fetch(`/api/rundown/templates/${template.meetType}/${template.id}/apply`, {
        method: 'POST',
        headers: { 'X-Competition-Id': competition.id },
      });
      onApply?.();
    } catch (error) {
      alert('Failed to apply template: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="template-dropdown">
      <button className="dropdown-trigger">
        Templates ▼
      </button>

      <div className="dropdown-menu">
        <div className="dropdown-section">
          <div className="section-header">Load Template</div>
          {templates.map(template => (
            <button
              key={template.id}
              className="dropdown-item"
              onClick={() => handleApply(template)}
              disabled={loading}
            >
              {template.name}
              {template.isDefault && <span className="default-badge">Default</span>}
            </button>
          ))}
          {templates.length === 0 && (
            <div className="dropdown-empty">No templates for {meetType}</div>
          )}
        </div>

        <div className="dropdown-divider" />

        <button
          className="dropdown-item"
          onClick={() => setShowSaveDialog(true)}
        >
          Save Current as Template...
        </button>
      </div>

      {showSaveDialog && (
        <SaveTemplateDialog
          meetType={meetType}
          onClose={() => setShowSaveDialog(false)}
          onSaved={() => {
            setShowSaveDialog(false);
            // Refresh templates list
          }}
        />
      )}
    </div>
  );
}
```

### Save Template Dialog

```jsx
// components/rundown/SaveTemplateDialog.jsx

import { useState } from 'react';
import { useShow } from '../../context/ShowContext';

export function SaveTemplateDialog({ meetType, onClose, onSaved }) {
  const { compId } = useShow();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Name is required');
      return;
    }

    setSaving(true);
    try {
      await fetch('/api/rundown/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Competition-Id': compId,
        },
        body: JSON.stringify({
          name,
          description,
          meetType,
          isDefault,
        }),
      });
      onSaved?.();
    } catch (error) {
      alert('Failed to save template: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal">
      <div className="modal-content">
        <h3>Save as Template</h3>

        <label>
          Name *
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Women's Quad - Standard"
          />
        </label>

        <label>
          Description
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description..."
          />
        </label>

        <label>
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
          />
          Set as default for {meetType}
        </label>

        <div className="modal-actions">
          <button onClick={onClose}>Cancel</button>
          <button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? 'Saving...' : 'Save Template'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## Auto-Load on Competition Setup

When a new competition is created, automatically apply the default template:

```javascript
// In competition creation flow (server-side)

async function createCompetition(competitionData) {
  // ... create competition ...

  // Auto-apply default template
  const meetType = competitionData.type; // e.g., "womens-quad"
  const defaultTemplate = await templateService.getDefaultTemplate(meetType);

  if (defaultTemplate) {
    await templateService.applyTemplate(
      competitionData.id,
      defaultTemplate.id,
      meetType
    );
  }
}
```

---

## Files to Create

| File | Est. Lines | Purpose |
|------|------------|---------|
| `server/lib/rundownTemplateService.js` | 200-250 | Template CRUD operations |
| `show-controller/src/components/rundown/TemplateDropdown.jsx` | 100-120 | Template selection dropdown |
| `show-controller/src/components/rundown/TemplateDropdown.css` | 60 | Dropdown styling |
| `show-controller/src/components/rundown/SaveTemplateDialog.jsx` | 80-100 | Save template modal |
| `show-controller/src/components/rundown/SaveTemplateDialog.css` | 40 | Dialog styling |

---

## Files to Modify

| File | Changes |
|------|---------|
| `server/routes/rundown.js` | Add template endpoints |
| `show-controller/src/pages/RundownEditorPage.jsx` | Add TemplateDropdown to toolbar |

---

## API Summary

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/rundown/templates` | List templates |
| GET | `/api/rundown/templates/:meetType/:id` | Get template |
| POST | `/api/rundown/templates` | Create template |
| POST | `/api/rundown/templates/:meetType/:id/apply` | Apply template |
| DELETE | `/api/rundown/templates/:meetType/:id` | Delete template |

---

## Acceptance Criteria

### Backend
- [ ] `listTemplates()` returns all templates for meet type
- [ ] `getTemplate()` returns single template
- [ ] `getDefaultTemplate()` returns default or first template
- [ ] `createTemplate()` saves current rundown as template
- [ ] `applyTemplate()` replaces rundown with template segments
- [ ] Variable substitution replaces `{{team1.name}}` etc.
- [ ] Setting default unsets other defaults for meet type

### Frontend
- [ ] Template dropdown shows in toolbar
- [ ] Templates listed by meet type
- [ ] Default template marked with badge
- [ ] Clicking template shows confirmation
- [ ] Apply replaces rundown and refreshes
- [ ] "Save Current as Template" opens dialog
- [ ] Save dialog requires name
- [ ] Save creates template and shows in list

### Auto-Load
- [ ] New competitions get default template applied

---

## Dependencies

- PRD-Rundown-06: Backend services
- PRD-Rundown-07: Frontend integration (useRundown refresh)

---

## Next Steps

After this PRD is complete, the full template system is available for use in production.
