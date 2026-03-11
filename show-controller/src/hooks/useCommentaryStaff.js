import { useState, useEffect, useCallback } from 'react';
import { db, ref, onValue, set, update, remove } from '../lib/firebase';

/**
 * useCommentaryStaff - Per-competition commentary assignment management.
 *
 * Firebase path: competitions/{compId}/commentary/
 *
 * Staff status workflow:
 *   assigned → invited → confirmed / declined → briefed
 */
export function useCommentaryStaff(compId) {
  const [staff, setStaff] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!compId) return;
    const staffRef = ref(db, `competitions/${compId}/commentary`);
    const unsubscribe = onValue(staffRef, (snapshot) => {
      setStaff(snapshot.val() || {});
      setLoading(false);
    });
    return () => unsubscribe();
  }, [compId]);

  const assignTalent = useCallback(async (talentId, role) => {
    await set(ref(db, `competitions/${compId}/commentary/${talentId}`), {
      role, // 'pbp' | 'analyst' | 'producer'
      status: 'assigned',
      assignedAt: new Date().toISOString(),
      calendarInviteSent: false,
      preProductionMeetingScheduled: false,
    });
  }, [compId]);

  const updateStatus = useCallback(async (talentId, status) => {
    const updates = { status };
    if (status === 'invited') updates.invitedAt = new Date().toISOString();
    if (status === 'confirmed') updates.confirmedAt = new Date().toISOString();
    if (status === 'declined') updates.declinedAt = new Date().toISOString();
    if (status === 'briefed') updates.briefedAt = new Date().toISOString();
    await update(ref(db, `competitions/${compId}/commentary/${talentId}`), updates);
  }, [compId]);

  const updateField = useCallback(async (talentId, field, value) => {
    await update(ref(db, `competitions/${compId}/commentary/${talentId}`), { [field]: value });
  }, [compId]);

  const updateNotes = useCallback(async (talentId, notes) => {
    await update(ref(db, `competitions/${compId}/commentary/${talentId}`), { notes });
  }, [compId]);

  const removeAssignment = useCallback(async (talentId) => {
    await remove(ref(db, `competitions/${compId}/commentary/${talentId}`));
  }, [compId]);

  const staffList = Object.entries(staff).map(([talentId, data]) => ({ talentId, ...data }));

  return {
    staff,
    staffList,
    loading,
    assignTalent,
    updateStatus,
    updateField,
    updateNotes,
    removeAssignment,
  };
}

// ─── Staff status helpers ─────────────────────────────────────────────────────

export const STAFF_STATUS = {
  ASSIGNED: 'assigned',
  INVITED: 'invited',
  CONFIRMED: 'confirmed',
  DECLINED: 'declined',
  BRIEFED: 'briefed',
};

export function getStaffStatusLabel(status) {
  const labels = {
    assigned: 'Assigned',
    invited: 'Invited',
    confirmed: 'Confirmed',
    declined: 'Declined',
    briefed: 'Briefed',
  };
  return labels[status] || status;
}

export function getStaffStatusColor(status) {
  const colors = {
    assigned: 'bg-gray-600 text-gray-200',
    invited: 'bg-yellow-700 text-yellow-100',
    confirmed: 'bg-green-700 text-green-100',
    declined: 'bg-red-700 text-red-100',
    briefed: 'bg-blue-700 text-blue-100',
  };
  return colors[status] || 'bg-gray-600 text-gray-200';
}

export function getRoleLabel(role) {
  const labels = { pbp: 'Play by Play', analyst: 'Color / Analyst', producer: 'Producer' };
  return labels[role] || role;
}
