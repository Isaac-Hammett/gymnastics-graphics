# PRD-Rundown-10: Import/Export (Phase 4)

**Version:** 1.0
**Date:** 2026-01-22
**Status:** Draft
**Depends On:** PRD-Rundown-06-BackendServices, PRD-Rundown-07-FrontendIntegration
**Blocks:** None

> **Master PRD:** [PRD-AdvancedRundownEditor-2026-01-22.md](../PRD-AdvancedRundownEditor-2026-01-22.md)
> **Section Reference:** Section 11 - Import/Export

---

## Overview

This PRD covers CSV and JSON import/export functionality for rundowns:
- Export rundown to CSV for spreadsheet editing
- Export rundown to JSON for backup/transfer
- Import rundown from CSV
- Import rundown from JSON

---

## Scope

### In Scope
- CSV export with all segment fields
- CSV import with validation
- JSON export (full rundown data)
- JSON import (restore from backup)
- Frontend UI buttons for import/export
- Error handling and validation feedback

### Out of Scope
- Google Sheets integration
- Automatic sync with external systems
- Version control for imports

---

## CSV Format

### Column Specification

```csv
order,name,type,duration_seconds,auto_advance,obs_scene,transition_type,transition_duration,graphic_id,graphic_trigger,graphic_duration,audio_preset,notes
```

### Column Definitions

| Column | Required | Type | Description |
|--------|----------|------|-------------|
| `order` | Yes | integer | Segment order (0-based) |
| `name` | Yes | string | Segment name |
| `type` | Yes | enum | video, live, static, break, hold, graphic |
| `duration_seconds` | No | integer | Duration in seconds (null for hold) |
| `auto_advance` | No | boolean | true/false (default: true) |
| `obs_scene` | Yes | string | OBS scene name |
| `transition_type` | No | string | Cut, Fade, Stinger (default: Cut) |
| `transition_duration` | No | integer | Duration in ms (default: 0) |
| `graphic_id` | No | string | Graphic ID from registry |
| `graphic_trigger` | No | enum | auto, cued, on-score, timed |
| `graphic_duration` | No | integer | Graphic duration in seconds |
| `audio_preset` | No | string | Audio preset ID |
| `notes` | No | string | Producer notes |

### Example CSV

```csv
order,name,type,duration_seconds,auto_advance,obs_scene,transition_type,transition_duration,graphic_id,graphic_trigger,graphic_duration,audio_preset,notes
0,Show Intro,video,45,true,Starting Soon,Cut,0,,,,music-only,
1,Welcome & Host,live,30,true,Talent Camera,Fade,300,hosts,auto,8,commentary-focus,
2,Event Introduction,static,8,true,Graphics Fullscreen,Fade,300,event-info,auto,8,commentary-focus,
3,UCLA Introduction,live,10,true,Single - Camera 2,Fade,300,team-stats,cued,8,commentary-focus,Wait for host
4,Oregon Introduction,live,10,true,Single - Camera 3,Fade,300,team-stats,cued,8,commentary-focus,
5,Utah Introduction,live,10,true,Single - Camera 4,Fade,300,team-stats,cued,8,commentary-focus,
6,Arizona Introduction,live,10,true,Single - Camera 1,Fade,300,team-stats,cued,8,commentary-focus,
7,Floor - Rotation 1,live,,false,Single - Camera 4,Fade,300,event-frame-fx,auto,,commentary-focus,
```

---

## Backend: Export Functions

### CSV Export

```javascript
// server/lib/rundownExport.js

/**
 * Export rundown to CSV format
 */
async function exportToCSV(compId) {
  const rundownService = require('./rundownService');
  const { segments } = await rundownService.getRundown(compId);

  const headers = [
    'order',
    'name',
    'type',
    'duration_seconds',
    'auto_advance',
    'obs_scene',
    'transition_type',
    'transition_duration',
    'graphic_id',
    'graphic_trigger',
    'graphic_duration',
    'audio_preset',
    'notes',
  ];

  const rows = segments.map(segment => [
    segment.order,
    escapeCSV(segment.name),
    segment.type,
    segment.timing?.duration || '',
    segment.timing?.autoAdvance ?? true,
    escapeCSV(segment.obs?.sceneId || ''),
    segment.obs?.transition?.type || 'Cut',
    segment.obs?.transition?.duration || 0,
    segment.graphics?.primary?.graphicId || '',
    segment.graphics?.primary?.triggerMode || '',
    segment.graphics?.primary?.duration || '',
    segment.audio?.preset || '',
    escapeCSV(segment.notes || ''),
  ]);

  const csv = [
    headers.join(','),
    ...rows.map(row => row.join(',')),
  ].join('\n');

  return csv;
}

function escapeCSV(value) {
  if (typeof value !== 'string') return value;
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
```

### JSON Export

```javascript
/**
 * Export rundown to JSON format
 */
async function exportToJSON(compId) {
  const rundownService = require('./rundownService');
  const rundown = await rundownService.getRundown(compId);

  return {
    exportedAt: new Date().toISOString(),
    competitionId: compId,
    version: '1.0',
    segments: rundown.segments,
    milestones: rundown.milestones,
    metadata: rundown.metadata,
  };
}

module.exports = { exportToCSV, exportToJSON };
```

---

## Backend: Import Functions

### CSV Import

```javascript
// server/lib/rundownImport.js

/**
 * Import rundown from CSV
 */
async function importFromCSV(compId, csvContent, options = {}) {
  const { replace = false } = options;
  const rundownService = require('./rundownService');

  // Parse CSV
  const lines = csvContent.trim().split('\n');
  const headers = parseCSVLine(lines[0]);

  // Validate headers
  const requiredHeaders = ['order', 'name', 'type', 'obs_scene'];
  const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
  if (missingHeaders.length > 0) {
    throw new Error(`Missing required columns: ${missingHeaders.join(', ')}`);
  }

  // Parse rows
  const segments = [];
  const errors = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index];
    });

    try {
      const segment = csvRowToSegment(row);
      segments.push(segment);
    } catch (error) {
      errors.push({ row: i + 1, error: error.message });
    }
  }

  if (errors.length > 0) {
    throw new Error(`Validation errors:\n${errors.map(e => `Row ${e.row}: ${e.error}`).join('\n')}`);
  }

  // Clear existing if replace mode
  if (replace) {
    const db = require('firebase-admin').database();
    await db.ref(`competitions/${compId}/production/rundown/segments`).remove();
  }

  // Import segments
  for (const segment of segments) {
    await rundownService.createSegment(compId, segment, -1);
  }

  return { imported: segments.length };
}

function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

function csvRowToSegment(row) {
  // Validate required fields
  if (!row.name) throw new Error('Name is required');
  if (!row.type) throw new Error('Type is required');
  if (!row.obs_scene) throw new Error('OBS scene is required');

  const validTypes = ['video', 'live', 'static', 'break', 'hold', 'graphic'];
  if (!validTypes.includes(row.type)) {
    throw new Error(`Invalid type: ${row.type}`);
  }

  const segment = {
    name: row.name,
    type: row.type,
    order: parseInt(row.order) || 0,
    timing: {
      duration: row.duration_seconds ? parseInt(row.duration_seconds) : null,
      autoAdvance: row.auto_advance !== 'false',
    },
    obs: {
      sceneId: row.obs_scene,
      transition: {
        type: row.transition_type || 'Cut',
        duration: parseInt(row.transition_duration) || 0,
      },
    },
    notes: row.notes || '',
  };

  // Optional graphics
  if (row.graphic_id) {
    segment.graphics = {
      primary: {
        graphicId: row.graphic_id,
        triggerMode: row.graphic_trigger || 'cued',
        duration: row.graphic_duration ? parseInt(row.graphic_duration) : 8,
      },
    };
  }

  // Optional audio
  if (row.audio_preset) {
    segment.audio = {
      preset: row.audio_preset,
    };
  }

  return segment;
}
```

### JSON Import

```javascript
/**
 * Import rundown from JSON
 */
async function importFromJSON(compId, jsonContent, options = {}) {
  const { replace = false } = options;
  const rundownService = require('./rundownService');

  let data;
  try {
    data = typeof jsonContent === 'string' ? JSON.parse(jsonContent) : jsonContent;
  } catch (error) {
    throw new Error('Invalid JSON format');
  }

  if (!data.segments || !Array.isArray(data.segments)) {
    throw new Error('JSON must contain a segments array');
  }

  // Clear existing if replace mode
  if (replace) {
    const db = require('firebase-admin').database();
    await db.ref(`competitions/${compId}/production/rundown/segments`).remove();
  }

  // Import segments
  for (const segment of data.segments) {
    await rundownService.createSegment(compId, segment, -1);
  }

  return { imported: data.segments.length };
}

module.exports = { importFromCSV, importFromJSON };
```

---

## API Routes

### Add to server/routes/rundown.js

```javascript
const { exportToCSV, exportToJSON } = require('../lib/rundownExport');
const { importFromCSV, importFromJSON } = require('../lib/rundownImport');

// GET /api/rundown/export/csv - Export as CSV
router.get('/export/csv', async (req, res) => {
  try {
    const csv = await exportToCSV(req.compId);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="rundown-${req.compId}.csv"`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/rundown/export/json - Export as JSON
router.get('/export/json', async (req, res) => {
  try {
    const json = await exportToJSON(req.compId);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="rundown-${req.compId}.json"`);
    res.json(json);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/rundown/import/csv - Import from CSV
router.post('/import/csv', async (req, res) => {
  try {
    const { content, replace } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'CSV content required' });
    }
    const result = await importFromCSV(req.compId, content, { replace });
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /api/rundown/import/json - Import from JSON
router.post('/import/json', async (req, res) => {
  try {
    const { content, replace } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'JSON content required' });
    }
    const result = await importFromJSON(req.compId, content, { replace });
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
```

---

## Frontend: Export Buttons

### Add to RundownEditorPage Toolbar

```jsx
// components/rundown/ExportButtons.jsx

import { useShow } from '../../context/ShowContext';

export function ExportButtons() {
  const { compId } = useShow();

  const handleExportCSV = async () => {
    try {
      const response = await fetch(`/api/rundown/export/csv`, {
        headers: { 'X-Competition-Id': compId },
      });
      const blob = await response.blob();
      downloadBlob(blob, `rundown-${compId}.csv`);
    } catch (error) {
      alert('Export failed: ' + error.message);
    }
  };

  const handleExportJSON = async () => {
    try {
      const response = await fetch(`/api/rundown/export/json`, {
        headers: { 'X-Competition-Id': compId },
      });
      const blob = await response.blob();
      downloadBlob(blob, `rundown-${compId}.json`);
    } catch (error) {
      alert('Export failed: ' + error.message);
    }
  };

  return (
    <div className="export-buttons">
      <button onClick={handleExportCSV}>Export CSV</button>
      <button onClick={handleExportJSON}>Export JSON</button>
    </div>
  );
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
```

---

## Frontend: Import Dialog

### UI Layout

```
┌─ IMPORT RUNDOWN ────────────────────────────────────────────────────────┐
│                                                                          │
│  Select a file to import:                                                │
│                                                                          │
│  [Choose File]  No file selected                                         │
│                                                                          │
│  Format: ○ CSV  ○ JSON                                                   │
│                                                                          │
│  ☑ Replace existing rundown (uncheck to append)                         │
│                                                                          │
│  ⚠️ Warning: Replacing will delete all existing segments                │
│                                                                          │
│                                        [Cancel]  [Import]                │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Implementation

```jsx
// components/rundown/ImportDialog.jsx

import { useState } from 'react';
import { useShow } from '../../context/ShowContext';
import { useRundownContext } from '../../context/RundownContext';

export function ImportDialog({ onClose }) {
  const { compId } = useShow();
  const { refresh } = useRundownContext();

  const [file, setFile] = useState(null);
  const [format, setFormat] = useState('csv');
  const [replace, setReplace] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    setFile(selectedFile);

    // Auto-detect format from extension
    if (selectedFile) {
      if (selectedFile.name.endsWith('.csv')) {
        setFormat('csv');
      } else if (selectedFile.name.endsWith('.json')) {
        setFormat('json');
      }
    }
  };

  const handleImport = async () => {
    if (!file) {
      setError('Please select a file');
      return;
    }

    setImporting(true);
    setError(null);

    try {
      const content = await file.text();

      const response = await fetch(`/api/rundown/import/${format}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Competition-Id': compId,
        },
        body: JSON.stringify({ content, replace }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Import failed');
      }

      const result = await response.json();
      alert(`Successfully imported ${result.imported} segments`);
      refresh();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="modal">
      <div className="modal-content">
        <h3>Import Rundown</h3>

        <div className="form-group">
          <label>Select a file to import:</label>
          <input type="file" accept=".csv,.json" onChange={handleFileChange} />
          <span className="file-name">{file?.name || 'No file selected'}</span>
        </div>

        <div className="form-group">
          <label>Format:</label>
          <label>
            <input
              type="radio"
              value="csv"
              checked={format === 'csv'}
              onChange={(e) => setFormat(e.target.value)}
            />
            CSV
          </label>
          <label>
            <input
              type="radio"
              value="json"
              checked={format === 'json'}
              onChange={(e) => setFormat(e.target.value)}
            />
            JSON
          </label>
        </div>

        <div className="form-group">
          <label>
            <input
              type="checkbox"
              checked={replace}
              onChange={(e) => setReplace(e.target.checked)}
            />
            Replace existing rundown (uncheck to append)
          </label>
        </div>

        {replace && (
          <div className="warning">
            Warning: Replacing will delete all existing segments
          </div>
        )}

        {error && <div className="error">{error}</div>}

        <div className="modal-actions">
          <button onClick={onClose}>Cancel</button>
          <button onClick={handleImport} disabled={importing || !file}>
            {importing ? 'Importing...' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## Files to Create

| File | Est. Lines | Purpose |
|------|------------|---------|
| `server/lib/rundownExport.js` | 80-100 | CSV/JSON export logic |
| `server/lib/rundownImport.js` | 150-180 | CSV/JSON import with validation |
| `show-controller/src/components/rundown/ExportButtons.jsx` | 50-60 | Export button group |
| `show-controller/src/components/rundown/ImportDialog.jsx` | 100-120 | Import file dialog |
| `show-controller/src/components/rundown/ImportDialog.css` | 40 | Dialog styling |

---

## Files to Modify

| File | Changes |
|------|---------|
| `server/routes/rundown.js` | Add import/export endpoints |
| `show-controller/src/pages/RundownEditorPage.jsx` | Add ExportButtons, Import button |

---

## API Summary

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/rundown/export/csv` | Download CSV |
| GET | `/api/rundown/export/json` | Download JSON |
| POST | `/api/rundown/import/csv` | Import from CSV |
| POST | `/api/rundown/import/json` | Import from JSON |

---

## Acceptance Criteria

### CSV Export
- [ ] Downloads file with correct headers
- [ ] All segments included in order
- [ ] All fields properly escaped (commas, quotes)
- [ ] Empty fields export as empty (not null/undefined)
- [ ] Filename includes competition ID

### JSON Export
- [ ] Downloads valid JSON file
- [ ] Includes segments, milestones, metadata
- [ ] Includes export timestamp and version
- [ ] Filename includes competition ID

### CSV Import
- [ ] Validates required columns present
- [ ] Validates each row for required fields
- [ ] Reports row-by-row validation errors
- [ ] Supports replace mode (clear existing)
- [ ] Supports append mode (add to existing)
- [ ] Correctly parses quoted values with commas

### JSON Import
- [ ] Validates JSON is parseable
- [ ] Validates segments array exists
- [ ] Supports replace mode
- [ ] Supports append mode
- [ ] Imports all segment fields

### Frontend
- [ ] Export CSV button downloads file
- [ ] Export JSON button downloads file
- [ ] Import CSV button opens dialog
- [ ] File picker accepts .csv and .json
- [ ] Format auto-detected from extension
- [ ] Replace warning shown when checkbox checked
- [ ] Error messages displayed clearly
- [ ] Success message shows count
- [ ] Rundown refreshes after import

---

## Dependencies

- PRD-Rundown-06: Backend services (rundownService)
- PRD-Rundown-07: Frontend integration (useRundownContext.refresh)

---

## Next Steps

This is the final PRD in the series. After implementation, the full Rundown Editor system is complete.
