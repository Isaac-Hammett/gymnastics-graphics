import { useState, useEffect, useCallback } from 'react';
import { db, ref, onValue, push, set, update, remove } from '../lib/firebase';

/**
 * useTalentRoster - Global hook for managing the commentary talent database.
 *
 * Firebase path: talentRoster/
 *
 * Status tiers (matches existing Google Sheets):
 *   need-info    — Name + affiliation only, no contact details
 *   has-contact  — Partial contact info (email or phone)
 *   did-YYYY     — Worked in a prior season (e.g. "did-2025"), needs re-confirmation
 *   ready        — Fully confirmed for current season
 */
export function useTalentRoster() {
  const [talents, setTalents] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const talentRef = ref(db, 'talentRoster');
    const unsubscribe = onValue(
      talentRef,
      (snapshot) => {
        setTalents(snapshot.val() || {});
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const createTalent = useCallback(async (data) => {
    const listRef = ref(db, 'talentRoster');
    const newRef = push(listRef);
    await set(newRef, {
      ...data,
      totalCompetitions: data.totalCompetitions || 0,
      competitionHistory: data.competitionHistory || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return newRef.key;
  }, []);

  const updateTalent = useCallback(async (talentId, data) => {
    await update(ref(db, `talentRoster/${talentId}`), {
      ...data,
      updatedAt: new Date().toISOString(),
    });
  }, []);

  const deleteTalent = useCallback(async (talentId) => {
    await remove(ref(db, `talentRoster/${talentId}`));
  }, []);

  // Sorted array for rendering
  const talentList = Object.entries(talents)
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  return {
    talents,
    talentList,
    loading,
    error,
    createTalent,
    updateTalent,
    deleteTalent,
  };
}

// ─── Status helpers ───────────────────────────────────────────────────────────

export const TALENT_STATUS = {
  NEED_INFO: 'need-info',
  HAS_CONTACT: 'has-contact',
  READY: 'ready',
};

export function getStatusLabel(status) {
  if (!status) return 'Unknown';
  if (status === 'need-info') return 'Need Info';
  if (status === 'has-contact') return 'Has Contact';
  if (status === 'ready') return 'Ready';
  if (status.startsWith('did-')) return `Did ${status.slice(4)}`;
  return status;
}

export function getStatusColor(status) {
  if (status === 'ready') return 'bg-green-700 text-green-100';
  if (status === 'has-contact') return 'bg-blue-700 text-blue-100';
  if (status === 'need-info') return 'bg-gray-600 text-gray-200';
  if (status?.startsWith('did-')) return 'bg-amber-700 text-amber-100';
  return 'bg-gray-600 text-gray-200';
}

export function wagMagLabel(wagMag) {
  if (wagMag === 'WAG') return { label: 'WAG', color: 'bg-pink-700 text-pink-100' };
  if (wagMag === 'MAG') return { label: 'MAG', color: 'bg-blue-700 text-blue-100' };
  return { label: 'Both', color: 'bg-purple-700 text-purple-100' };
}
