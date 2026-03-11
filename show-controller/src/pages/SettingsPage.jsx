import { useState } from 'react';
import { Link } from 'react-router-dom';
import { db, ref, update, set, push, get } from '../lib/firebase';
import {
  Cog6ToothIcon,
  DocumentArrowUpIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/solid';

/**
 * SettingsPage - Admin settings for batch imports and system configuration
 * URL: /settings
 */
export default function SettingsPage() {
  const [csvFile, setCsvFile] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [preview, setPreview] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  // Parse CSV file and generate preview
  async function handlePreview() {
    if (!csvFile) return;

    const text = await csvFile.text();
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));

    const rows = lines.slice(1).map(line => {
      // Simple CSV parser - handles quoted fields
      const values = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());

      const row = {};
      headers.forEach((header, i) => {
        row[header] = values[i]?.replace(/^"|"$/g, '') || '';
      });
      return row;
    });

    // Load existing talent roster to check for matches
    const talentRef = ref(db, 'talentRoster');
    const snapshot = await get(talentRef);
    const existingTalent = snapshot.val() || {};
    const talentByEmail = {};

    Object.entries(existingTalent).forEach(([id, talent]) => {
      if (talent.email) {
        talentByEmail[talent.email.toLowerCase()] = { id, ...talent };
      }
    });

    // Match rows by email
    const matches = [];
    const newRecords = [];

    rows.forEach(row => {
      const email = row['Email Address'] || row['Email'] || row['email'];
      if (!email) return; // Skip rows without email

      const existing = talentByEmail[email.toLowerCase()];
      if (existing) {
        matches.push({ row, existing });
      } else {
        newRecords.push({ row });
      }
    });

    setParsedData({ matches, newRecords, rows });
    setPreview({ matched: matches.length, new: newRecords.length, total: rows.length });
    setImportResult(null);
  }

  // Confirm and execute the import
  async function handleConfirmImport() {
    if (!parsedData) return;

    setImporting(true);
    let updated = 0;
    let created = 0;

    try {
      const talentRef = ref(db, 'talentRoster');

      // Update matched records
      for (const { row, existing } of parsedData.matches) {
        const updates = buildTalentUpdate(row);
        await update(ref(db, `talentRoster/${existing.id}`), {
          ...updates,
          updatedAt: new Date().toISOString(),
        });
        updated++;
      }

      // Create new records
      for (const { row } of parsedData.newRecords) {
        const newTalent = buildTalentUpdate(row);
        const newRef = push(talentRef);
        await set(newRef, {
          ...newTalent,
          status: 'need-info',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        created++;
      }

      setImportResult({ success: true, updated, created });
      setParsedData(null);
      setPreview(null);
      setCsvFile(null);
    } catch (error) {
      setImportResult({ success: false, error: error.message });
    } finally {
      setImporting(false);
    }
  }

  // Build talent record from CSV row
  function buildTalentUpdate(row) {
    const email = row['Email Address'] || row['Email'] || row['email'] || '';
    const name = row['Name'] || row['Full Name'] || row['name'] || '';
    const wagMag = row['WAG/MAG'] || row['wagMag'] || 'Both';
    const uploadMbps = parseInt(row['Upload Speed (Mbps)'] || row['internetUploadMbps'] || '0', 10) || 0;
    const downloadMbps = parseInt(row['Download Speed (Mbps)'] || row['internetDownloadMbps'] || '0', 10) || 0;
    const micType = row['Microphone Type'] || row['micType'] || '';
    const hasHeadphones = (row['Headphones'] || row['hasHeadphones'] || '').toLowerCase().includes('yes');
    const discordUsername = row['Discord Username'] || row['discordUsername'] || '';
    const commentaryRole = row['Role Preference'] || row['commentaryRole'] || 'Does not matter';

    // Parse availability checkboxes (competition names)
    const surveyAvailability = {};
    Object.keys(row).forEach(key => {
      // Look for checkbox columns that have competition names
      if (key.includes('Competition') || key.includes('Meet') || key.includes('available')) {
        if (row[key] && row[key].toLowerCase().includes('yes')) {
          // We don't have compIds in the CSV - store by competition name
          // The coordinator will need to map these manually
          surveyAvailability[key] = true;
        }
      }
    });

    return {
      name,
      email,
      wagMag,
      internetUploadMbps: uploadMbps,
      internetDownloadMbps: downloadMbps,
      micType,
      hasHeadphones,
      discordUsername,
      commentaryRole,
      surveyAvailability: Object.keys(surveyAvailability).length > 0 ? surveyAvailability : undefined,
      surveyCompleted: true,
    };
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-gray-400 hover:text-white text-sm transition-colors">
              ← Home
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <Cog6ToothIcon className="w-6 h-6 text-gray-400" />
                Settings
              </h1>
              <p className="text-gray-400 text-sm">System configuration and batch imports</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* CSV Batch Import Section */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <div className="flex items-center gap-3 mb-4">
            <DocumentArrowUpIcon className="w-6 h-6 text-blue-400" />
            <div>
              <h2 className="text-lg font-semibold text-white">Batch Import Survey Responses</h2>
              <p className="text-sm text-gray-400 mt-0.5">
                Upload a CSV export from the annual survey (Google Forms export format)
              </p>
            </div>
          </div>

          {/* File Input */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-300 mb-2">Select CSV File</label>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => {
                  setCsvFile(e.target.files[0]);
                  setParsedData(null);
                  setPreview(null);
                  setImportResult(null);
                }}
                className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-600 file:text-white hover:file:bg-blue-500 file:cursor-pointer cursor-pointer"
              />
            </div>

            {/* Preview Button */}
            {csvFile && !preview && (
              <button
                onClick={handlePreview}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors"
              >
                Preview Import
              </button>
            )}

            {/* Preview Results */}
            {preview && (
              <div className="bg-gray-900 rounded-lg border border-gray-700 p-4">
                <h3 className="text-sm font-semibold text-white mb-3">Import Preview</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircleIcon className="w-4 h-4 text-green-400" />
                    <span className="text-gray-300">
                      <span className="font-semibold text-white">{preview.matched}</span> records matched by email (will be updated)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircleIcon className="w-4 h-4 text-blue-400" />
                    <span className="text-gray-300">
                      <span className="font-semibold text-white">{preview.new}</span> new records (will be created with status "Need Info")
                    </span>
                  </div>
                  <div className="text-gray-400 text-xs mt-3 pt-3 border-t border-gray-700">
                    Total rows in CSV: {preview.total}
                  </div>
                </div>

                {/* Confirm Import Button */}
                <div className="flex items-center gap-3 mt-4 pt-4 border-t border-gray-700">
                  <button
                    onClick={handleConfirmImport}
                    disabled={importing}
                    className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
                  >
                    {importing ? 'Importing...' : 'Confirm Import'}
                  </button>
                  <button
                    onClick={() => {
                      setParsedData(null);
                      setPreview(null);
                      setCsvFile(null);
                    }}
                    disabled={importing}
                    className="px-4 py-2 text-gray-400 hover:text-white disabled:opacity-50 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Import Result */}
            {importResult && (
              <div
                className={`rounded-lg border p-4 ${
                  importResult.success
                    ? 'bg-green-900/20 border-green-600'
                    : 'bg-red-900/20 border-red-600'
                }`}
              >
                <div className="flex items-center gap-2">
                  {importResult.success ? (
                    <>
                      <CheckCircleIcon className="w-5 h-5 text-green-400" />
                      <span className="text-green-100 font-medium">Import Complete</span>
                    </>
                  ) : (
                    <>
                      <XCircleIcon className="w-5 h-5 text-red-400" />
                      <span className="text-red-100 font-medium">Import Failed</span>
                    </>
                  )}
                </div>
                {importResult.success ? (
                  <p className="text-sm text-green-200 mt-2">
                    {importResult.updated} records updated, {importResult.created} new records created
                  </p>
                ) : (
                  <p className="text-sm text-red-200 mt-2">{importResult.error}</p>
                )}
              </div>
            )}
          </div>

          {/* CSV Format Guide */}
          <div className="mt-6 pt-6 border-t border-gray-700">
            <h3 className="text-sm font-semibold text-white mb-2">CSV Format</h3>
            <p className="text-xs text-gray-400 mb-3">
              The CSV should contain columns matching the survey form. Records are matched by email address.
              Common column names:
            </p>
            <ul className="text-xs text-gray-500 space-y-1">
              <li>• Email Address (or Email)</li>
              <li>• Name (or Full Name)</li>
              <li>• WAG/MAG</li>
              <li>• Upload Speed (Mbps)</li>
              <li>• Download Speed (Mbps)</li>
              <li>• Microphone Type</li>
              <li>• Headphones (yes/no)</li>
              <li>• Discord Username</li>
              <li>• Role Preference</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
