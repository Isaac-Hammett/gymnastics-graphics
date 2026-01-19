import { useState, useEffect, useRef } from 'react';
import {
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowPathIcon,
  TrashIcon,
  ArrowUpTrayIcon,
  MusicalNoteIcon,
  FilmIcon,
  PhotoIcon,
  SparklesIcon,
  FolderOpenIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { useOBS } from '../../context/OBSContext';
import { useShow } from '../../context/ShowContext';

/**
 * Helper function to format file sizes
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * AssetManager - Manage media assets (music, stingers, backgrounds, logos)
 */
export default function AssetManager() {
  const { obsConnected } = useOBS();
  const { socketUrl } = useShow();

  const [activeTab, setActiveTab] = useState('music');
  const [assets, setAssets] = useState({});
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const fileInputRef = useRef(null);
  const dropZoneRef = useRef(null);

  // Asset type configuration
  const assetTypes = {
    music: {
      label: 'Music',
      icon: MusicalNoteIcon,
      color: 'purple',
      accept: '.mp3,.wav,.flac,.m4a,.ogg',
      extensions: ['mp3', 'wav', 'flac', 'm4a', 'ogg'],
      maxSize: 50 * 1024 * 1024, // 50MB
      maxSizeLabel: '50MB'
    },
    stingers: {
      label: 'Stingers',
      icon: FilmIcon,
      color: 'blue',
      accept: '.mp4,.mov,.webm',
      extensions: ['mp4', 'mov', 'webm'],
      maxSize: 100 * 1024 * 1024, // 100MB
      maxSizeLabel: '100MB'
    },
    backgrounds: {
      label: 'Backgrounds',
      icon: PhotoIcon,
      color: 'green',
      accept: '.jpg,.jpeg,.png,.webp',
      extensions: ['jpg', 'jpeg', 'png', 'webp'],
      maxSize: 20 * 1024 * 1024, // 20MB
      maxSizeLabel: '20MB'
    },
    logos: {
      label: 'Logos',
      icon: SparklesIcon,
      color: 'yellow',
      accept: '.png,.svg,.webp',
      extensions: ['png', 'svg', 'webp'],
      maxSize: 10 * 1024 * 1024, // 10MB
      maxSizeLabel: '10MB'
    }
  };

  // Fetch assets on mount and when tab changes
  useEffect(() => {
    if (obsConnected) {
      fetchAssets();
    }
  }, [obsConnected, activeTab]);

  const fetchAssets = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch assets for the active tab type
      const response = await fetch(`${socketUrl}/api/obs/assets/${activeTab}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch assets: ${response.statusText}`);
      }
      const data = await response.json();
      // API returns { assets: [...] }, extract the array
      const assetList = Array.isArray(data) ? data : (data.assets || []);
      setAssets(prev => ({
        ...prev,
        [activeTab]: assetList
      }));
    } catch (err) {
      console.error('Error fetching assets:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleFileUpload = async (file) => {
    setError(null);
    setSuccess(null);
    setUploadProgress(0);

    const typeConfig = assetTypes[activeTab];

    // Validate file type
    const fileExt = file.name.split('.').pop().toLowerCase();
    if (!typeConfig.extensions.includes(fileExt)) {
      setError(`Invalid file type. Allowed types: ${typeConfig.extensions.join(', ')}`);
      return;
    }

    // Validate file size
    if (file.size > typeConfig.maxSize) {
      setError(`File too large. Maximum size: ${typeConfig.maxSizeLabel}`);
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      // IMPORTANT: 'type' must come BEFORE 'file' for multer's fileFilter to work
      // Multer processes fields in order, and fileFilter runs when processing the file
      formData.append('type', activeTab);
      formData.append('metadata', JSON.stringify({
        originalName: file.name,
        uploadedAt: new Date().toISOString()
      }));
      formData.append('file', file);

      const xhr = new XMLHttpRequest();

      // Track upload progress
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(progress);
        }
      });

      // Handle completion
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setSuccess(`${file.name} uploaded successfully`);
          setUploadProgress(100);
          setTimeout(() => {
            setSuccess(null);
            setUploadProgress(0);
          }, 3000);
          fetchAssets(); // Refresh asset list
        } else {
          const errorData = JSON.parse(xhr.responseText);
          throw new Error(errorData.error || `Upload failed: ${xhr.statusText}`);
        }
        setUploading(false);
      });

      // Handle errors
      xhr.addEventListener('error', () => {
        setError('Upload failed: Network error');
        setUploading(false);
        setUploadProgress(0);
      });

      xhr.open('POST', `${socketUrl}/api/obs/assets/upload`);
      xhr.send(formData);
    } catch (err) {
      console.error('Error uploading file:', err);
      setError(err.message);
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDelete = async (filename) => {
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`${socketUrl}/api/obs/assets/${activeTab}/${encodeURIComponent(filename)}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to delete asset: ${response.statusText}`);
      }

      setSuccess(`${filename} deleted successfully`);
      setTimeout(() => setSuccess(null), 3000);
      setDeleteConfirm(null);
      fetchAssets(); // Refresh asset list
    } catch (err) {
      console.error('Error deleting asset:', err);
      setError(err.message);
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (dropZoneRef.current) {
      dropZoneRef.current.classList.add('border-purple-500', 'bg-purple-900/20');
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (dropZoneRef.current && !dropZoneRef.current.contains(e.relatedTarget)) {
      dropZoneRef.current.classList.remove('border-purple-500', 'bg-purple-900/20');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (dropZoneRef.current) {
      dropZoneRef.current.classList.remove('border-purple-500', 'bg-purple-900/20');
    }

    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  if (!obsConnected) {
    return (
      <div className="text-center text-gray-400 py-12">
        <ExclamationTriangleIcon className="w-16 h-16 text-gray-600 mx-auto mb-4" />
        <p className="text-lg font-semibold text-white mb-2">OBS Not Connected</p>
        <p>Connect to OBS to manage assets</p>
      </div>
    );
  }

  const currentAssets = assets[activeTab] || [];
  const typeConfig = assetTypes[activeTab];
  const Icon = typeConfig.icon;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-white font-semibold text-lg">Asset Manager</h3>
          <p className="text-gray-400 text-sm mt-1">Upload and manage media assets for OBS</p>
        </div>
        <button
          onClick={fetchAssets}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 border border-gray-600 rounded-lg text-gray-300 text-sm hover:bg-gray-600 disabled:opacity-50 transition-colors"
        >
          <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-4 flex items-start gap-3">
          <ExclamationTriangleIcon className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="text-red-300 font-semibold">Error</div>
            <div className="text-red-200/80 text-sm">{error}</div>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-300 hover:text-red-100"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Success Banner */}
      {success && (
        <div className="bg-green-900/20 border border-green-700 rounded-lg p-4 flex items-start gap-3">
          <CheckCircleIcon className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="text-green-300 font-semibold">Success</div>
            <div className="text-green-200/80 text-sm">{success}</div>
          </div>
          <button
            onClick={() => setSuccess(null)}
            className="text-green-300 hover:text-green-100"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Asset Type Tabs */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(assetTypes).map(([key, config]) => {
          const TabIcon = config.icon;
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === key
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              <TabIcon className="w-5 h-5" />
              {config.label}
            </button>
          );
        })}
      </div>

      {/* Upload Area */}
      <div
        ref={dropZoneRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className="bg-gray-700 rounded-lg border-2 border-dashed border-gray-600 p-8 text-center transition-colors"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={typeConfig.accept}
          onChange={handleFileSelect}
          className="hidden"
        />
        <Icon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <div className="text-white font-medium mb-2">
          {uploading ? 'Uploading...' : `Upload ${typeConfig.label}`}
        </div>
        <div className="text-gray-400 text-sm mb-4">
          Drag and drop or{' '}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="text-purple-400 hover:text-purple-300 underline disabled:opacity-50"
          >
            browse files
          </button>
        </div>
        <div className="text-gray-500 text-xs">
          Accepted: {typeConfig.extensions.join(', ').toUpperCase()} (max {typeConfig.maxSizeLabel})
        </div>

        {/* Upload Progress */}
        {uploading && (
          <div className="mt-4">
            <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-purple-600 h-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
            <div className="text-gray-400 text-sm mt-2">{uploadProgress}%</div>
          </div>
        )}
      </div>

      {/* Asset List */}
      <div className="bg-gray-700 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Icon className="w-5 h-5 text-gray-300" />
          <h4 className="text-white font-semibold">
            {typeConfig.label} ({currentAssets.length})
          </h4>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <ArrowPathIcon className="w-8 h-8 text-gray-400 mx-auto mb-2 animate-spin" />
            <div className="text-gray-400">Loading assets...</div>
          </div>
        ) : currentAssets.length === 0 ? (
          <div className="text-center py-12">
            <FolderOpenIcon className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <div className="text-gray-400">No {typeConfig.label.toLowerCase()} uploaded yet</div>
            <div className="text-gray-500 text-sm mt-1">Upload files using the area above</div>
          </div>
        ) : (
          <div className="space-y-2">
            {currentAssets.map((asset) => (
              <AssetCard
                key={asset.filename}
                asset={asset}
                type={activeTab}
                onDelete={() => setDeleteConfirm(asset.filename)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <DeleteConfirmModal
          filename={deleteConfirm}
          onConfirm={() => handleDelete(deleteConfirm)}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
}

/**
 * AssetCard - Individual asset card with preview and actions
 */
function AssetCard({ asset, type, onDelete }) {
  const [showPreview, setShowPreview] = useState(false);

  const isImage = ['backgrounds', 'logos'].includes(type);
  const isVideo = type === 'stingers';
  const isAudio = type === 'music';

  return (
    <div className="bg-gray-800 rounded-lg p-4 flex items-center justify-between hover:bg-gray-750 transition-colors">
      <div className="flex items-center gap-4 flex-1 min-w-0">
        {/* Preview Thumbnail */}
        {isImage && asset.url && (
          <div
            className="w-16 h-16 rounded bg-gray-900 flex-shrink-0 cursor-pointer overflow-hidden"
            onClick={() => setShowPreview(true)}
          >
            <img
              src={asset.url}
              alt={asset.filename}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        {isVideo && asset.url && (
          <div
            className="w-16 h-16 rounded bg-gray-900 flex-shrink-0 cursor-pointer overflow-hidden"
            onClick={() => setShowPreview(true)}
          >
            <video
              src={asset.url}
              className="w-full h-full object-cover"
              muted
            />
          </div>
        )}
        {isAudio && (
          <div className="w-16 h-16 rounded bg-gray-900 flex-shrink-0 flex items-center justify-center">
            <MusicalNoteIcon className="w-8 h-8 text-gray-600" />
          </div>
        )}

        {/* Asset Info */}
        <div className="flex-1 min-w-0">
          <div className="text-white font-medium truncate">{asset.filename}</div>
          <div className="text-gray-400 text-sm flex items-center gap-3">
            <span>{formatFileSize(asset.size)}</span>
            {asset.uploadedAt && (
              <>
                <span>•</span>
                <span>{new Date(asset.uploadedAt).toLocaleDateString()}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 ml-4">
        {(isImage || isVideo) && (
          <button
            onClick={() => setShowPreview(true)}
            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded transition-colors"
          >
            Preview
          </button>
        )}
        <button
          onClick={onDelete}
          className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded transition-colors"
          title="Delete"
        >
          <TrashIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <PreviewModal
          asset={asset}
          type={type}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
}

/**
 * PreviewModal - Modal for previewing images and videos
 */
function PreviewModal({ asset, type, onClose }) {
  const isImage = ['backgrounds', 'logos'].includes(type);
  const isVideo = type === 'stingers';

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 rounded-lg max-w-4xl max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <div className="text-white font-semibold">{asset.filename}</div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6">
          {isImage && (
            <img
              src={asset.url}
              alt={asset.filename}
              className="max-w-full max-h-[70vh] mx-auto"
            />
          )}
          {isVideo && (
            <video
              src={asset.url}
              controls
              className="max-w-full max-h-[70vh] mx-auto"
            />
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * DeleteConfirmModal - Confirmation dialog for deleting assets
 */
function DeleteConfirmModal({ filename, onConfirm, onCancel }) {
  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={onCancel}
    >
      <div
        className="bg-gray-800 rounded-lg max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-10 h-10 rounded-full bg-red-900/20 flex items-center justify-center flex-shrink-0">
              <ExclamationTriangleIcon className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <h3 className="text-white font-semibold text-lg mb-2">Delete Asset</h3>
              <p className="text-gray-400 text-sm">
                Are you sure you want to delete <span className="text-white font-medium">{filename}</span>?
                This action cannot be undone.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
