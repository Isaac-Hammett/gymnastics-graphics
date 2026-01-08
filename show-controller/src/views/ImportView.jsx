import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpTrayIcon, DocumentArrowDownIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/solid';

export default function ImportView() {
  const [file, setFile] = useState(null);
  const [showName, setShowName] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.name.endsWith('.csv')) {
      setFile(droppedFile);
      setError(null);
      setResult(null);
    } else {
      setError('Please upload a CSV file');
    }
  };

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a CSV file first');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('csv', file);
      if (showName) {
        formData.append('showName', showName);
      }

      const response = await fetch('/api/import-csv', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (response.ok) {
        setResult(data);
        setFile(null);
        setShowName('');
      } else {
        setError(data.error || 'Failed to import CSV');
      }
    } catch (err) {
      setError(err.message || 'Failed to upload file');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 p-8 relative">
      <Link
        to="/"
        className="absolute top-5 left-5 flex items-center gap-2 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-300 text-sm hover:bg-zinc-700 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        Back to Hub
      </Link>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-2">Import Show Plan</h1>
        <p className="text-zinc-400 mb-8">Upload a CSV file to create your run of show</p>

        {/* Download Template */}
        <div className="mb-8">
          <a
            href="/api/csv-template"
            download="show-template.csv"
            className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors"
          >
            <DocumentArrowDownIcon className="w-5 h-5" />
            Download CSV Template
          </a>
        </div>

        {/* Show Name Input */}
        <div className="mb-6">
          <label className="block text-sm text-zinc-400 mb-2">Show Name (optional)</label>
          <input
            type="text"
            value={showName}
            onChange={(e) => setShowName(e.target.value)}
            placeholder="e.g., CGA All Stars 2025"
            className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Drop Zone */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          className={`
            border-2 border-dashed rounded-xl p-12 text-center transition-colors
            ${dragOver ? 'border-blue-500 bg-blue-500/10' : 'border-zinc-700 hover:border-zinc-600'}
            ${file ? 'border-green-500 bg-green-500/10' : ''}
          `}
        >
          {file ? (
            <div>
              <CheckCircleIcon className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <p className="text-white font-medium">{file.name}</p>
              <p className="text-zinc-400 text-sm mt-1">{(file.size / 1024).toFixed(1)} KB</p>
              <button
                onClick={() => setFile(null)}
                className="mt-4 text-sm text-red-400 hover:text-red-300"
              >
                Remove
              </button>
            </div>
          ) : (
            <div>
              <ArrowUpTrayIcon className="w-12 h-12 text-zinc-500 mx-auto mb-4" />
              <p className="text-zinc-300 mb-2">Drag and drop your CSV file here</p>
              <p className="text-zinc-500 text-sm mb-4">or</p>
              <label className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg cursor-pointer transition-colors">
                <span>Browse Files</span>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>
            </div>
          )}
        </div>

        {/* Upload Button */}
        <button
          onClick={handleUpload}
          disabled={!file || loading}
          className={`
            w-full mt-6 py-4 rounded-xl font-bold text-lg transition-all
            ${file && !loading
              ? 'bg-green-600 hover:bg-green-500 text-white'
              : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
            }
          `}
        >
          {loading ? 'Importing...' : 'Import Show Plan'}
        </button>

        {/* Error Message */}
        {error && (
          <div className="mt-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg flex items-start gap-3">
            <XCircleIcon className="w-6 h-6 text-red-500 flex-shrink-0" />
            <div>
              <p className="text-red-400 font-medium">Import Failed</p>
              <p className="text-red-300 text-sm mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Success Message */}
        {result && (
          <div className="mt-6 p-4 bg-green-500/20 border border-green-500/50 rounded-lg flex items-start gap-3">
            <CheckCircleIcon className="w-6 h-6 text-green-500 flex-shrink-0" />
            <div>
              <p className="text-green-400 font-medium">Import Successful!</p>
              <p className="text-green-300 text-sm mt-1">
                Imported {result.segments} segments for "{result.showName}"
              </p>
              <Link
                to="/producer"
                className="inline-block mt-3 text-sm text-green-400 hover:text-green-300 underline"
              >
                Go to Producer View
              </Link>
            </div>
          </div>
        )}

        {/* CSV Format Help */}
        <div className="mt-8 p-6 bg-zinc-900 rounded-xl border border-zinc-800">
          <h3 className="text-white font-medium mb-3">CSV Format</h3>
          <p className="text-zinc-400 text-sm mb-4">
            Your CSV should have these columns (only <code className="text-blue-400">name</code> is required):
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-zinc-500 border-b border-zinc-800">
                  <th className="pb-2 pr-4">Column</th>
                  <th className="pb-2 pr-4">Description</th>
                  <th className="pb-2">Example</th>
                </tr>
              </thead>
              <tbody className="text-zinc-300">
                <tr className="border-b border-zinc-800">
                  <td className="py-2 pr-4 text-blue-400">name</td>
                  <td className="py-2 pr-4">Segment name</td>
                  <td className="py-2 text-zinc-500">Floor Exercise</td>
                </tr>
                <tr className="border-b border-zinc-800">
                  <td className="py-2 pr-4">type</td>
                  <td className="py-2 pr-4">video, live, or graphic</td>
                  <td className="py-2 text-zinc-500">live</td>
                </tr>
                <tr className="border-b border-zinc-800">
                  <td className="py-2 pr-4">obsScene</td>
                  <td className="py-2 pr-4">OBS scene name</td>
                  <td className="py-2 text-zinc-500">Competition Camera</td>
                </tr>
                <tr className="border-b border-zinc-800">
                  <td className="py-2 pr-4">duration</td>
                  <td className="py-2 pr-4">Duration in seconds or mm:ss</td>
                  <td className="py-2 text-zinc-500">1:30 or 90</td>
                </tr>
                <tr className="border-b border-zinc-800">
                  <td className="py-2 pr-4">autoAdvance</td>
                  <td className="py-2 pr-4">Auto-advance when done</td>
                  <td className="py-2 text-zinc-500">true / false</td>
                </tr>
                <tr className="border-b border-zinc-800">
                  <td className="py-2 pr-4">graphic</td>
                  <td className="py-2 pr-4">Graphic to trigger</td>
                  <td className="py-2 text-zinc-500">event-frame</td>
                </tr>
                <tr className="border-b border-zinc-800">
                  <td className="py-2 pr-4">videoFile</td>
                  <td className="py-2 pr-4">Video file path for Media Source</td>
                  <td className="py-2 text-zinc-500">/Videos/intro.mp4</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">notes</td>
                  <td className="py-2 pr-4">Notes for talent</td>
                  <td className="py-2 text-zinc-500">Welcome viewers</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Navigation */}
        <div className="mt-8 flex gap-4">
          <Link
            to="/"
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors"
          >
            Back to Home
          </Link>
          <Link
            to="/producer"
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors"
          >
            Producer View
          </Link>
        </div>
      </div>
    </div>
  );
}
