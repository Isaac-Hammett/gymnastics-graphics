import { useState, useEffect, useCallback } from 'react';
import { db, ref, onValue, remove } from '../lib/firebase';

/**
 * useThemeErrors - Subscribes to theme loading errors from Firebase
 * Path: competitions/{compId}/production/themeErrors
 *
 * Errors are written by theme-loader.js when theme loading fails (timeout, not found, etc.)
 */
export function useThemeErrors(compId) {
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!compId) {
      setErrors([]);
      setLoading(false);
      return;
    }

    const errorsRef = ref(db, `competitions/${compId}/production/themeErrors`);

    const unsubscribe = onValue(
      errorsRef,
      (snapshot) => {
        const data = snapshot.val();
        if (!data) {
          setErrors([]);
          setLoading(false);
          return;
        }

        // Convert object to array with IDs, sorted by timestamp descending (newest first)
        const errorArray = Object.entries(data)
          .map(([id, error]) => ({
            id,
            ...error
          }))
          .sort((a, b) => {
            const timeA = new Date(a.timestamp || 0).getTime();
            const timeB = new Date(b.timestamp || 0).getTime();
            return timeB - timeA; // Newest first
          });

        setErrors(errorArray);
        setLoading(false);
      },
      (error) => {
        console.error('useThemeErrors subscription error:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [compId]);

  // Clear a single error
  const clearError = useCallback(async (errorId) => {
    if (!compId || !errorId) return;
    try {
      const errorRef = ref(db, `competitions/${compId}/production/themeErrors/${errorId}`);
      await remove(errorRef);
    } catch (err) {
      console.error('Failed to clear theme error:', err);
    }
  }, [compId]);

  // Clear all errors
  const clearAllErrors = useCallback(async () => {
    if (!compId) return;
    try {
      const errorsRef = ref(db, `competitions/${compId}/production/themeErrors`);
      await remove(errorsRef);
    } catch (err) {
      console.error('Failed to clear all theme errors:', err);
    }
  }, [compId]);

  return {
    errors,
    errorCount: errors.length,
    loading,
    clearError,
    clearAllErrors
  };
}
