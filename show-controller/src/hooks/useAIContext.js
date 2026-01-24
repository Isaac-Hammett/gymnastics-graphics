import { useCallback, useMemo, useState, useEffect } from 'react';
import { useShow } from '../context/ShowContext';

/**
 * Initial state for AI context
 */
const INITIAL_AI_CONTEXT_STATE = {
  context: null,
  isRunning: false,
  isLoading: false,
  error: null,
  lastUpdated: null,
};

/**
 * Hook that provides AI context state and control functions.
 *
 * Returns AI-generated talking points and context during live show execution.
 * The AI Context Service runs on the server and broadcasts updates when
 * segments change during a show.
 *
 * @returns {Object} AI context state, helpers, and actions
 *
 * @example
 * const { talkingPoints, isRunning, refresh } = useAIContext();
 * // talkingPoints = [{ id: 'point-1', text: 'Welcome back...', priority: 'high' }]
 * // isRunning = true (when show is running)
 * // refresh() - force refresh context
 */
export function useAIContext() {
  const { socket, connected, compId } = useShow();

  // Local state for AI context
  const [aiContextState, setAIContextState] = useState(INITIAL_AI_CONTEXT_STATE);

  // Set up socket listeners
  useEffect(() => {
    if (!socket) return;

    // Listen for AI context updates (broadcast when segment changes)
    const handleContextUpdated = (data) => {
      console.log('AI context updated:', data);
      setAIContextState(prev => ({
        ...prev,
        context: data.context,
        isRunning: true,
        lastUpdated: data.timestamp || new Date().toISOString(),
        error: null,
      }));
    };

    // Listen for AI context result (response to getAIContext)
    const handleContextResult = (data) => {
      console.log('AI context result:', data);
      if (data.success) {
        setAIContextState(prev => ({
          ...prev,
          context: data.context,
          isRunning: data.isRunning || false,
          isLoading: false,
          error: null,
          lastUpdated: new Date().toISOString(),
        }));
      } else {
        setAIContextState(prev => ({
          ...prev,
          isLoading: false,
          error: data.error || 'Failed to get AI context',
        }));
      }
    };

    // Listen for AI context refresh result
    const handleRefreshResult = (data) => {
      console.log('AI context refresh result:', data);
      if (data.success) {
        setAIContextState(prev => ({
          ...prev,
          context: data.context,
          isLoading: false,
          error: null,
          lastUpdated: new Date().toISOString(),
        }));
      } else {
        setAIContextState(prev => ({
          ...prev,
          isLoading: false,
          error: data.error || 'Failed to refresh AI context',
        }));
      }
    };

    socket.on('aiContextUpdated', handleContextUpdated);
    socket.on('aiContextResult', handleContextResult);
    socket.on('aiContextRefreshResult', handleRefreshResult);

    return () => {
      socket.off('aiContextUpdated', handleContextUpdated);
      socket.off('aiContextResult', handleContextResult);
      socket.off('aiContextRefreshResult', handleRefreshResult);
    };
  }, [socket]);

  // Reset state when disconnected
  useEffect(() => {
    if (!connected) {
      setAIContextState(INITIAL_AI_CONTEXT_STATE);
    }
  }, [connected]);

  /**
   * Get current AI context from server
   */
  const getContext = useCallback(() => {
    if (!socket || !compId) return;

    setAIContextState(prev => ({ ...prev, isLoading: true, error: null }));
    socket.emit('getAIContext', { compId });
  }, [socket, compId]);

  /**
   * Force refresh AI context
   */
  const refresh = useCallback(() => {
    if (!socket || !compId) return;

    setAIContextState(prev => ({ ...prev, isLoading: true, error: null }));
    socket.emit('refreshAIContext', { compId });
  }, [socket, compId]);

  /**
   * Clear any error state
   */
  const clearError = useCallback(() => {
    setAIContextState(prev => ({ ...prev, error: null }));
  }, []);

  /**
   * Current context object
   * @type {Object|null}
   */
  const context = useMemo(() => {
    return aiContextState.context || null;
  }, [aiContextState.context]);

  /**
   * Current segment ID for this context
   * @type {string|null}
   */
  const segmentId = useMemo(() => {
    return context?.segmentId || null;
  }, [context]);

  /**
   * Current segment name for this context
   * @type {string|null}
   */
  const segmentName = useMemo(() => {
    return context?.segmentName || null;
  }, [context]);

  /**
   * Talking points array
   * @type {Array}
   */
  const talkingPoints = useMemo(() => {
    return context?.talkingPoints || [];
  }, [context]);

  /**
   * High priority talking points (critical + high)
   * @type {Array}
   */
  const highPriorityPoints = useMemo(() => {
    return talkingPoints.filter(p =>
      p.priority === 'critical' || p.priority === 'high'
    );
  }, [talkingPoints]);

  /**
   * Athlete-specific context
   * @type {Array}
   */
  const athleteContext = useMemo(() => {
    return context?.athleteContext || [];
  }, [context]);

  /**
   * Score-related context
   * @type {Object|null}
   */
  const scoreContext = useMemo(() => {
    return context?.scoreContext || null;
  }, [context]);

  /**
   * Milestones (career highs, records, etc.)
   * @type {Array}
   */
  const milestones = useMemo(() => {
    return context?.milestones || [];
  }, [context]);

  /**
   * Whether AI Context Service is running
   * @type {boolean}
   */
  const isRunning = useMemo(() => {
    return aiContextState.isRunning || false;
  }, [aiContextState.isRunning]);

  /**
   * Whether a request is in progress
   * @type {boolean}
   */
  const isLoading = useMemo(() => {
    return aiContextState.isLoading || false;
  }, [aiContextState.isLoading]);

  /**
   * Error message if any
   * @type {string|null}
   */
  const error = useMemo(() => {
    return aiContextState.error || null;
  }, [aiContextState.error]);

  /**
   * Last update timestamp
   * @type {string|null}
   */
  const lastUpdated = useMemo(() => {
    return aiContextState.lastUpdated || null;
  }, [aiContextState.lastUpdated]);

  /**
   * Whether context is available
   * @type {boolean}
   */
  const hasContext = useMemo(() => {
    return context !== null && talkingPoints.length > 0;
  }, [context, talkingPoints]);

  /**
   * Count of talking points
   * @type {number}
   */
  const talkingPointsCount = useMemo(() => {
    return talkingPoints.length;
  }, [talkingPoints]);

  /**
   * Count of high priority points
   * @type {number}
   */
  const highPriorityCount = useMemo(() => {
    return highPriorityPoints.length;
  }, [highPriorityPoints]);

  /**
   * Count of milestones
   * @type {number}
   */
  const milestonesCount = useMemo(() => {
    return milestones.length;
  }, [milestones]);

  return {
    // State
    /**
     * Full context object
     * @type {Object|null}
     */
    context,

    /**
     * Segment ID this context is for
     * @type {string|null}
     */
    segmentId,

    /**
     * Segment name this context is for
     * @type {string|null}
     */
    segmentName,

    /**
     * All talking points
     * @type {Array}
     */
    talkingPoints,

    /**
     * High priority talking points only
     * @type {Array}
     */
    highPriorityPoints,

    /**
     * Athlete-specific context
     * @type {Array}
     */
    athleteContext,

    /**
     * Score-related context
     * @type {Object|null}
     */
    scoreContext,

    /**
     * Milestone alerts
     * @type {Array}
     */
    milestones,

    /**
     * Whether AI Context Service is running
     * @type {boolean}
     */
    isRunning,

    /**
     * Whether a request is in progress
     * @type {boolean}
     */
    isLoading,

    /**
     * Error message if any
     * @type {string|null}
     */
    error,

    /**
     * Last update timestamp
     * @type {string|null}
     */
    lastUpdated,

    /**
     * Whether context is available
     * @type {boolean}
     */
    hasContext,

    /**
     * Count of talking points
     * @type {number}
     */
    talkingPointsCount,

    /**
     * Count of high priority points
     * @type {number}
     */
    highPriorityCount,

    /**
     * Count of milestones
     * @type {number}
     */
    milestonesCount,

    /**
     * Full AI context state object
     * @type {Object}
     */
    aiContextState,

    // Actions
    /**
     * Get current AI context from server
     * @type {function(): void}
     */
    getContext,

    /**
     * Force refresh AI context
     * @type {function(): void}
     */
    refresh,

    /**
     * Clear error state
     * @type {function(): void}
     */
    clearError,
  };
}

export default useAIContext;
