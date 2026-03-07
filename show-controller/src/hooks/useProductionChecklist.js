/**
 * Production Checklist Hook
 *
 * Main hook for checklist state management. Subscribes to Firebase for
 * manual item states, computes auto-validated items from system state,
 * and provides actions for toggling items and updating notes.
 *
 * Reference: docs/PRD-Production-Checklist/PLAN-Production-Checklist-2026-01-24.md
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useCompetition } from '../context/CompetitionContext';
import { useShow } from '../context/ShowContext';
import { useOBS } from '../context/OBSContext';
import { db, ref, onValue, set, get } from '../lib/firebase';
import { checkVmStatus } from './useCompetitions';
import { CHECKLIST_PHASES, getAllItems } from '../lib/checklistItems';
import { getTeamCount, buildTeamKey, getGenderFromCompType } from '../lib/competitionUtils';
import { runValidator } from '../lib/checklistValidators';

/**
 * useProductionChecklist - Main hook for production checklist state
 *
 * @returns {Object} Checklist state and actions:
 *   - phases: Computed phases with status
 *   - summary: { total, complete, warnings, errors, pending, percentage }
 *   - contacts: Team contacts from Firebase
 *   - teamKeys: Array of team keys for the competition
 *   - toggleItem: (itemId) => Promise<void>
 *   - updateNote: (itemId, note) => Promise<void>
 *   - updateContact: (teamKey, contactId, data) => Promise<void>
 *   - deleteContact: (teamKey, contactId) => Promise<void>
 *   - refresh: () => void
 *   - loading: boolean
 *   - lastUpdated: ISO timestamp or null
 */
export function useProductionChecklist() {
  const { compId, competitionConfig } = useCompetition();
  const { connected: socketConnected } = useShow();
  const { obsConnected } = useOBS();

  // Checklist state from Firebase
  const [checklistState, setChecklistState] = useState(null);
  const [localChecklistState, setLocalChecklistState] = useState(null); // for optimistic updates

  // Team data from Firebase (rosters, headshots)
  const [teamData, setTeamData] = useState(null);

  // Rundown segments from Firebase
  const [rundownSegments, setRundownSegments] = useState([]);

  // Team contacts from Firebase
  const [contacts, setContacts] = useState({});

  // VM status
  const [vmStatus, setVmStatus] = useState({ online: false, checking: true });

  // Loading state
  const [loading, setLoading] = useState(true);

  // Last updated timestamp
  const [lastUpdated, setLastUpdated] = useState(null);

  // Derive team count and keys from competition config
  const teamCount = useMemo(() => {
    if (!competitionConfig?.compType) return 2;
    return getTeamCount(competitionConfig.compType);
  }, [competitionConfig?.compType]);

  const gender = useMemo(() => {
    if (competitionConfig?.gender) return competitionConfig.gender;
    return getGenderFromCompType(competitionConfig?.compType) || 'womens';
  }, [competitionConfig?.gender, competitionConfig?.compType]);

  const teamKeys = useMemo(() => {
    const keys = [];
    for (let i = 1; i <= teamCount; i++) {
      const name = competitionConfig?.[`team${i}Name`];
      if (name) {
        keys.push(buildTeamKey(name, gender));
      }
    }
    return keys;
  }, [competitionConfig, teamCount, gender]);

  // Subscribe to checklist state from Firebase
  useEffect(() => {
    if (!compId) return;

    const checklistRef = ref(db, `competitions/${compId}/checklist`);
    const unsubscribe = onValue(checklistRef, (snapshot) => {
      const data = snapshot.val();
      setChecklistState(data);
      setLastUpdated(data?.lastUpdated || null);
      // Clear local optimistic state when Firebase updates
      setLocalChecklistState(null);
      setLoading(false);
    }, (err) => {
      console.error('[useProductionChecklist] Failed to load checklist state:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [compId]);

  // Subscribe to team data from Firebase
  useEffect(() => {
    if (!compId) return;

    const teamDataRef = ref(db, `competitions/${compId}/teamData`);
    const unsubscribe = onValue(teamDataRef, (snapshot) => {
      setTeamData(snapshot.val());
    });

    return () => unsubscribe();
  }, [compId]);

  // Subscribe to rundown segments from Firebase
  // IMPORTANT: Path is competitions/{compId}/rundown/segments (NOT production/rundown/segments/)
  useEffect(() => {
    if (!compId) return;

    const segmentsRef = ref(db, `competitions/${compId}/rundown/segments`);
    const unsubscribe = onValue(segmentsRef, (snapshot) => {
      const data = snapshot.val();
      setRundownSegments(data ? Object.values(data) : []);
    });

    return () => unsubscribe();
  }, [compId]);

  // Subscribe to team contacts from Firebase
  useEffect(() => {
    if (teamKeys.length === 0) return;

    const unsubscribes = [];
    const contactsData = {};

    for (const teamKey of teamKeys) {
      const contactsRef = ref(db, `teamsDatabase/contacts/${teamKey}`);
      const unsub = onValue(contactsRef, (snapshot) => {
        contactsData[teamKey] = snapshot.val() || {};
        setContacts({ ...contactsData });
      });
      unsubscribes.push(unsub);
    }

    return () => {
      for (const unsub of unsubscribes) {
        unsub();
      }
    };
  }, [teamKeys]);

  // VM status polling (30s interval)
  useEffect(() => {
    if (!competitionConfig?.vmAddress) {
      setVmStatus({ online: false, checking: false });
      return;
    }

    const poll = async () => {
      setVmStatus(prev => ({ ...prev, checking: true }));
      try {
        const result = await checkVmStatus(competitionConfig.vmAddress, 5000, compId);
        setVmStatus({ online: result.online, checking: false, error: result.error });
      } catch (err) {
        setVmStatus({ online: false, checking: false, error: err.message });
      }
    };

    poll();
    const interval = setInterval(poll, 30000);
    return () => clearInterval(interval);
  }, [competitionConfig?.vmAddress, compId]);

  // Compute effective checklist state (local optimistic or Firebase)
  const effectiveChecklistState = useMemo(() => {
    return localChecklistState || checklistState || { items: {}, notes: {} };
  }, [localChecklistState, checklistState]);

  // Build validator context
  const validatorContext = useMemo(() => ({
    config: competitionConfig,
    teamData,
    rundownSegments,
    socketConnected,
    obsConnected,
    vmStatus,
    contacts,
    teamCount,
    gender
  }), [competitionConfig, teamData, rundownSegments, socketConnected, obsConnected, vmStatus, contacts, teamCount, gender]);

  // Compute phases with item statuses
  const phases = useMemo(() => {
    return CHECKLIST_PHASES.map(phase => ({
      ...phase,
      categories: phase.categories.map(category => ({
        ...category,
        items: category.items.map(item => {
          // Compute status for this item
          let status = 'pending';
          let detail = null;

          if (item.type === 'auto' && item.validator) {
            // Auto-validated items - compute status from validators
            const result = runValidator(item.validator, validatorContext);
            status = result.status;
            detail = result.detail;
          } else {
            // Manual items - get from Firebase state
            const itemState = effectiveChecklistState.items?.[item.id];
            status = itemState?.checked ? 'complete' : 'pending';
          }

          // Get note if any
          const note = effectiveChecklistState.notes?.[item.id] || null;

          // Build fix link with compId substitution
          let fixLink = item.fixLink || null;
          if (fixLink && compId) {
            fixLink = fixLink.replace('{compId}', compId);
          }

          // Compute auto-assist hint for manual items with autoAssist field
          // This provides a visual indicator when the related contact exists
          // but does NOT change the item's status or make it auto-complete
          let autoAssistHint = null;
          if (item.type === 'manual' && item.autoAssist) {
            // Check if any team has this contact role filled
            for (const teamKey of teamKeys) {
              const contact = contacts[teamKey]?.[item.autoAssist];
              if (contact && contact.name) {
                autoAssistHint = {
                  contactName: contact.name,
                  contactRole: contact.role || item.autoAssist,
                  teamKey
                };
                break; // Found at least one, that's enough for hint
              }
            }
          }

          return {
            ...item,
            status,
            detail,
            note,
            fixLink,
            checked: effectiveChecklistState.items?.[item.id]?.checked || false,
            checkedAt: effectiveChecklistState.items?.[item.id]?.checkedAt || null,
            autoAssistHint
          };
        })
      }))
    }));
  }, [effectiveChecklistState, compId, validatorContext, teamKeys, contacts]);

  // Compute summary stats
  const summary = useMemo(() => {
    const allItems = getAllItems();
    const total = allItems.length;
    let complete = 0;
    let warnings = 0;
    let errors = 0;
    let pending = 0;

    for (const phase of phases) {
      for (const category of phase.categories) {
        for (const item of category.items) {
          switch (item.status) {
            case 'complete':
              complete++;
              break;
            case 'warning':
              warnings++;
              break;
            case 'error':
              errors++;
              break;
            default:
              pending++;
          }
        }
      }
    }

    const percentage = total > 0 ? Math.round((complete / total) * 100) : 0;

    return { total, complete, warnings, errors, pending, percentage };
  }, [phases]);

  // Toggle item action - optimistic update with rollback
  const toggleItem = useCallback(async (itemId) => {
    if (!compId) return;

    let previousState;
    const now = new Date().toISOString();

    // Optimistic update — use functional form to safely read current local state
    setLocalChecklistState(prev => {
      const baseState = prev || checklistState || { items: {}, notes: {} };
      previousState = baseState.items?.[itemId]?.checked ?? false;
      return {
        ...baseState,
        items: {
          ...(baseState.items || {}),
          [itemId]: { checked: !previousState, checkedAt: now }
        }
      };
    });

    try {
      await set(ref(db, `competitions/${compId}/checklist/items/${itemId}`), {
        checked: !previousState,
        checkedAt: now
      });
      // Update lastUpdated timestamp
      await set(ref(db, `competitions/${compId}/checklist/lastUpdated`), now);
    } catch (error) {
      console.error('[useProductionChecklist] Failed to toggle item:', error);
      // Rollback on failure — only revert this specific item
      setLocalChecklistState(prev => {
        const baseState = prev || checklistState || { items: {}, notes: {} };
        return {
          ...baseState,
          items: {
            ...(baseState.items || {}),
            [itemId]: { checked: previousState }
          }
        };
      });
      throw error; // Re-throw for toast handling in UI
    }
  }, [compId, checklistState]);

  // Update note action
  const updateNote = useCallback(async (itemId, note) => {
    if (!compId) return;

    try {
      const now = new Date().toISOString();
      await set(ref(db, `competitions/${compId}/checklist/notes/${itemId}`), note);
      await set(ref(db, `competitions/${compId}/checklist/lastUpdated`), now);
    } catch (error) {
      console.error('[useProductionChecklist] Failed to save note:', error);
      throw error; // Re-throw for toast handling in UI
    }
  }, [compId]);

  // Update contact action
  const updateContact = useCallback(async (teamKey, contactId, contactData) => {
    if (!teamKey || !contactId) return;

    try {
      await set(ref(db, `teamsDatabase/contacts/${teamKey}/${contactId}`), {
        ...contactData,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('[useProductionChecklist] Failed to save contact:', error);
      throw error; // Re-throw for toast handling in UI
    }
  }, []);

  // Delete contact action
  const deleteContact = useCallback(async (teamKey, contactId) => {
    if (!teamKey || !contactId) return;

    try {
      await set(ref(db, `teamsDatabase/contacts/${teamKey}/${contactId}`), null);
    } catch (error) {
      console.error('[useProductionChecklist] Failed to delete contact:', error);
      throw error; // Re-throw for toast handling in UI
    }
  }, []);

  // Refresh action - force re-fetch from Firebase
  const refresh = useCallback(() => {
    // Clear local state to force re-read from Firebase
    setLocalChecklistState(null);
  }, []);

  return {
    phases,
    summary,
    contacts,
    teamKeys,
    toggleItem,
    updateNote,
    updateContact,
    deleteContact,
    refresh,
    loading,
    lastUpdated,
    // Expose additional context for components that need it
    validatorContext,
    competitionConfig,
    teamCount,
    gender
  };
}
