import { createContext, useContext, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { db, ref, onValue } from '../lib/firebase';
import { getServerUrl } from '../lib/serverUrl';

// Error types for different failure scenarios
export const CompetitionErrorType = {
  NOT_FOUND: 'NOT_FOUND',
  NO_VM_ADDRESS: 'NO_VM_ADDRESS',
  VM_UNREACHABLE: 'VM_UNREACHABLE',
  FIREBASE_ERROR: 'FIREBASE_ERROR'
};

const CompetitionContext = createContext(null);

/**
 * CompetitionProvider wraps routes that need competition-specific configuration.
 * It extracts the compId from the URL, fetches the competition config from Firebase,
 * and derives the socket URL for connecting to the competition's VM.
 *
 * Special handling for compId='local' enables local development mode.
 */
export function CompetitionProvider({ children }) {
  const { compId } = useParams();
  const [searchParams] = useSearchParams();

  // Competition config from Firebase
  const [competitionConfig, setCompetitionConfig] = useState(null);

  // Loading and error states
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [errorType, setErrorType] = useState(null);

  // Derived values
  const isLocalMode = compId === 'local';

  // Extract vmAddress and gender from config
  const vmAddress = competitionConfig?.vmAddress || null;
  const gender = competitionConfig?.gender || 'womens';

  // Derive socket URL from vmAddress
  // In production (HTTPS), always use the coordinator API to avoid Mixed Content errors
  // The coordinator handles routing to the appropriate VM based on compId
  const socketUrl = (() => {
    if (isLocalMode) {
      // In local mode, use centralized server URL resolution
      return getServerUrl();
    }

    // Check if we're on HTTPS (production) - if so, use coordinator to avoid Mixed Content
    const isSecureContext = typeof window !== 'undefined' &&
      (window.location.protocol === 'https:' || window.location.hostname === 'commentarygraphic.com');

    if (isSecureContext) {
      // In production, always use the secure coordinator API
      // The coordinator will handle VM-specific connections server-side
      return 'https://api.commentarygraphic.com';
    }

    // In development (HTTP), can connect directly to VM
    if (vmAddress) {
      // Ensure vmAddress doesn't already have protocol
      if (vmAddress.startsWith('http://') || vmAddress.startsWith('https://')) {
        return vmAddress;
      }
      return `http://${vmAddress}`;
    }
    return null;
  })();

  // WebSocket URL (same as socket URL for socket.io)
  const websocketUrl = socketUrl;

  useEffect(() => {
    // Reset state when compId changes
    setCompetitionConfig(null);
    setError(null);
    setErrorType(null);
    setIsLoading(true);

    if (!compId) {
      setIsLoading(false);
      setError('No competition ID provided');
      setErrorType(CompetitionErrorType.NOT_FOUND);
      return;
    }

    // Handle local development mode
    if (isLocalMode) {
      // Support ?gender=mens query param for testing MAG apparatus in local mode
      const genderParam = searchParams.get('gender');
      const localGender = genderParam === 'mens' ? 'mens' : 'womens';
      console.log(`CompetitionContext: Local development mode (gender: ${localGender})`);
      setCompetitionConfig({
        eventName: 'Local Development',
        gender: localGender,
        vmAddress: null // Will use getServerUrl() for local mode
      });
      setIsLoading(false);
      return;
    }

    // Subscribe to competition config from Firebase
    const configRef = ref(db, `competitions/${compId}/config`);

    const unsubscribe = onValue(
      configRef,
      (snapshot) => {
        const config = snapshot.val();

        if (!config) {
          console.log(`CompetitionContext: Competition ${compId} not found`);
          setError(`Competition "${compId}" not found`);
          setErrorType(CompetitionErrorType.NOT_FOUND);
          setCompetitionConfig(null);
          setIsLoading(false);
          return;
        }

        console.log(`CompetitionContext: Loaded config for ${compId}`, {
          eventName: config.eventName,
          vmAddress: config.vmAddress,
          gender: config.gender
        });

        setCompetitionConfig(config);
        setError(null);
        setErrorType(null);
        setIsLoading(false);

        // Check if vmAddress is configured
        if (!config.vmAddress && !isLocalMode) {
          console.warn(`CompetitionContext: Competition ${compId} has no vmAddress configured`);
          // Note: We don't set error here - the UI layer decides if vmAddress is required
        }
      },
      (err) => {
        console.error(`CompetitionContext: Firebase error for ${compId}:`, err);
        setError(err.message);
        setErrorType(CompetitionErrorType.FIREBASE_ERROR);
        setIsLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [compId, isLocalMode, searchParams]);

  const value = {
    // Competition identification
    compId,
    isLocalMode,

    // Competition configuration from Firebase
    competitionConfig,

    // Derived values
    vmAddress,
    gender,
    socketUrl,
    websocketUrl,

    // Loading and error states
    isLoading,
    error,
    errorType
  };

  return (
    <CompetitionContext.Provider value={value}>
      {children}
    </CompetitionContext.Provider>
  );
}

/**
 * Hook to access competition context.
 * Must be used within a CompetitionProvider.
 *
 * @returns {Object} Competition context with:
 *   - compId: Competition ID from URL
 *   - isLocalMode: true if using local development mode (compId='local')
 *   - competitionConfig: Full competition config from Firebase
 *   - vmAddress: VM address for this competition (host:port format)
 *   - gender: Competition gender ('mens' or 'womens')
 *   - socketUrl: Full socket URL for connecting to VM (http://host:port)
 *   - websocketUrl: WebSocket URL (same as socketUrl for socket.io)
 *   - isLoading: true while loading config from Firebase
 *   - error: Error message if loading failed
 *   - errorType: CompetitionErrorType constant for specific error handling
 */
export function useCompetition() {
  const context = useContext(CompetitionContext);
  if (!context) {
    throw new Error('useCompetition must be used within a CompetitionProvider');
  }
  return context;
}
