import { useState, useEffect, useRef, useCallback } from 'react';
import { PhotoIcon } from '@heroicons/react/24/outline';
import { useShow } from '../../context/ShowContext';

/**
 * SceneThumbnail - Display a thumbnail preview of an OBS scene
 * PRD-OBS-11: Scene Thumbnails (P1)
 *
 * Features:
 * - Fetches scene-specific screenshots via socket
 * - Shows placeholder while loading or on failure
 * - Optional hover preview with larger image
 * - Caches thumbnails to avoid excessive requests
 */
export default function SceneThumbnail({
  sceneName,
  width = 80,
  height = 45,
  showHoverPreview = false,
  hoverWidth = 320,
  hoverHeight = 180,
  className = ''
}) {
  const { socket, connected } = useShow();
  const [thumbnail, setThumbnail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [hoverThumbnail, setHoverThumbnail] = useState(null);
  const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);
  const hoverTimeoutRef = useRef(null);
  const requestedRef = useRef(false);

  // Request thumbnail for this scene
  const requestThumbnail = useCallback(() => {
    if (!socket || !connected || !sceneName || requestedRef.current) {
      return;
    }

    requestedRef.current = true;
    setLoading(true);
    setError(false);

    socket.emit('obs:requestSceneThumbnail', {
      sceneName,
      imageWidth: width,
      imageHeight: height
    });
  }, [socket, connected, sceneName, width, height]);

  // Request larger hover preview
  const requestHoverPreview = useCallback(() => {
    if (!socket || !connected || !sceneName || !showHoverPreview) {
      return;
    }

    socket.emit('obs:requestSceneThumbnail', {
      sceneName,
      imageWidth: hoverWidth,
      imageHeight: hoverHeight,
      isHoverPreview: true
    });
  }, [socket, connected, sceneName, showHoverPreview, hoverWidth, hoverHeight]);

  // Set up socket listeners
  useEffect(() => {
    if (!socket || !connected) {
      return;
    }

    const handleThumbnailData = (data) => {
      if (data.sceneName !== sceneName) {
        return;
      }

      if (data.isHoverPreview) {
        setHoverThumbnail(data.imageData);
      } else {
        setThumbnail(data.imageData);
        setLoading(false);
        setError(false);
      }
    };

    const handleThumbnailError = (data) => {
      if (data.sceneName !== sceneName) {
        return;
      }

      if (!data.isHoverPreview) {
        setLoading(false);
        setError(true);
      }
    };

    socket.on('obs:sceneThumbnailData', handleThumbnailData);
    socket.on('obs:sceneThumbnailError', handleThumbnailError);

    return () => {
      socket.off('obs:sceneThumbnailData', handleThumbnailData);
      socket.off('obs:sceneThumbnailError', handleThumbnailError);
    };
  }, [socket, connected, sceneName]);

  // Request thumbnail on mount
  useEffect(() => {
    requestThumbnail();
  }, [requestThumbnail]);

  // Handle hover for preview
  const handleMouseEnter = (e) => {
    if (!showHoverPreview) return;

    // Calculate position for hover preview
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setHoverPosition({
        x: rect.right + 10,
        y: rect.top
      });
    }

    // Debounce hover to avoid rapid requests
    hoverTimeoutRef.current = setTimeout(() => {
      setShowPreview(true);
      if (!hoverThumbnail) {
        requestHoverPreview();
      }
    }, 200);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    setShowPreview(false);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  // Placeholder/loading state
  if (loading) {
    return (
      <div
        ref={containerRef}
        className={`flex items-center justify-center bg-gray-700 rounded animate-pulse ${className}`}
        style={{ width, height }}
      >
        <PhotoIcon className="w-6 h-6 text-gray-500" />
      </div>
    );
  }

  // Error/fallback state
  if (error || !thumbnail) {
    return (
      <div
        ref={containerRef}
        className={`flex items-center justify-center bg-gray-700 rounded ${className}`}
        style={{ width, height }}
        title={`No preview for ${sceneName}`}
      >
        <PhotoIcon className="w-6 h-6 text-gray-500" />
      </div>
    );
  }

  return (
    <>
      <div
        ref={containerRef}
        className={`relative rounded overflow-hidden cursor-pointer ${className}`}
        style={{ width, height }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <img
          src={thumbnail}
          alt={`Preview of ${sceneName}`}
          className="w-full h-full object-cover"
          style={{ width, height }}
        />
      </div>

      {/* Hover Preview Tooltip */}
      {showPreview && showHoverPreview && (
        <div
          className="fixed z-50 bg-gray-900 rounded-lg shadow-xl border border-gray-600 p-1"
          style={{
            left: hoverPosition.x,
            top: hoverPosition.y,
            // Ensure it doesn't go off screen
            maxWidth: 'calc(100vw - 20px)',
            transform: hoverPosition.y > window.innerHeight / 2 ? 'translateY(-100%)' : 'none'
          }}
        >
          {hoverThumbnail ? (
            <img
              src={hoverThumbnail}
              alt={`Preview of ${sceneName}`}
              className="rounded"
              style={{ width: hoverWidth, height: hoverHeight }}
            />
          ) : (
            <div
              className="flex items-center justify-center bg-gray-700 rounded animate-pulse"
              style={{ width: hoverWidth, height: hoverHeight }}
            >
              <PhotoIcon className="w-10 h-10 text-gray-500" />
            </div>
          )}
          <div className="text-xs text-gray-400 text-center mt-1 pb-1">
            {sceneName}
          </div>
        </div>
      )}
    </>
  );
}
