import { useState, useEffect } from 'react';
import { db, ref, onValue } from '../lib/firebase';

/**
 * useProductionAlerts - Scans Firebase for upcoming competitions and generates
 * actionable pre-production alerts.
 *
 * Alert types:
 * - start-outreach: 6+ weeks out, no commentary assigned
 * - no-confirmed: 3+ weeks out, no confirmed talent
 * - send-calendar: confirmed talent, no calendar invite sent, within 4 weeks
 * - schedule-preproduction: 1 week out, no pre-prod meeting scheduled
 * - follow-up: invited 5+ days ago, no response
 */
export function useProductionAlerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const competitionsRef = ref(db, 'competitions');

    const unsubscribe = onValue(
      competitionsRef,
      (snapshot) => {
        const competitions = snapshot.val() || {};
        const generatedAlerts = [];
        const now = new Date();

        Object.entries(competitions).forEach(([compId, competition]) => {
          // Skip if no meetDate or invalid date
          const meetDateStr = competition?.config?.meetDate;
          if (!meetDateStr) return;

          const meetDate = new Date(meetDateStr);
          if (isNaN(meetDate.getTime())) return;

          // Skip past competitions
          if (meetDate <= now) return;

          const daysUntil = Math.ceil((meetDate - now) / (1000 * 60 * 60 * 24));
          const compName = competition?.config?.eventName || 'Untitled Competition';
          const commentary = competition?.commentary || {};
          const talentEntries = Object.entries(commentary);

          // Alert 1: Start outreach (6 weeks = 42 days, no commentary assigned at all)
          if (daysUntil <= 42 && talentEntries.length === 0) {
            generatedAlerts.push({
              id: `start-outreach-${compId}`,
              type: 'start-outreach',
              message: `Start outreach for ${compName} — no commentary assigned and it's ${daysUntil} days away`,
              compId,
              compName,
            });
          }

          // Alert 2: No confirmed talent (3 weeks = 21 days)
          const hasConfirmed = talentEntries.some(([_, talent]) => talent?.status === 'confirmed');
          if (daysUntil <= 21 && !hasConfirmed && talentEntries.length > 0) {
            generatedAlerts.push({
              id: `no-confirmed-${compId}`,
              type: 'no-confirmed',
              message: `⚠ No confirmed commentary for ${compName} — it's ${daysUntil} days away`,
              compId,
              compName,
            });
          }

          // Alert 3: Send calendar invite (confirmed but no invite sent, within 4 weeks)
          if (daysUntil <= 28) {
            talentEntries.forEach(([talentId, talent]) => {
              if (talent?.status === 'confirmed' && !talent?.calendarInviteSent) {
                generatedAlerts.push({
                  id: `send-calendar-${compId}-${talentId}`,
                  type: 'send-calendar',
                  message: `Send calendar invite to ${talent?.name || 'talent'} for ${compName}`,
                  compId,
                  talentId,
                  compName,
                  talentName: talent?.name,
                });
              }
            });
          }

          // Alert 4: Schedule pre-production (1 week = 7 days, no meeting scheduled)
          if (daysUntil <= 7 && !competition?.preProductionMeetingScheduled) {
            generatedAlerts.push({
              id: `schedule-preproduction-${compId}`,
              type: 'schedule-preproduction',
              message: `Schedule pre-production call for ${compName} — it's ${daysUntil} days away`,
              compId,
              compName,
            });
          }

          // Alert 5: Follow up on invites (invited 5+ days ago, no response)
          talentEntries.forEach(([talentId, talent]) => {
            if (talent?.status === 'invited' && talent?.invitedAt) {
              const invitedAt = new Date(talent.invitedAt);
              if (!isNaN(invitedAt.getTime())) {
                const daysSinceInvite = Math.floor((now - invitedAt) / (1000 * 60 * 60 * 24));
                if (daysSinceInvite > 5) {
                  generatedAlerts.push({
                    id: `follow-up-${compId}-${talentId}`,
                    type: 'follow-up',
                    message: `Follow up with ${talent?.name || 'talent'} — invited ${daysSinceInvite} days ago for ${compName}, no response`,
                    compId,
                    talentId,
                    compName,
                    talentName: talent?.name,
                  });
                }
              }
            }
          });
        });

        setAlerts(generatedAlerts);
        setLoading(false);
      },
      (error) => {
        console.error('useProductionAlerts error:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { alerts, loading };
}
