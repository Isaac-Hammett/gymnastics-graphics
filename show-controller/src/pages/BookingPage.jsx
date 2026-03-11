import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { db, ref, get, update } from '../lib/firebase';
import { CheckCircleIcon, XCircleIcon, CalendarIcon, MapPinIcon } from '@heroicons/react/24/solid';

/**
 * BookingPage - Public booking response page for talent invitations.
 * URL: /book/:token (no auth required)
 *
 * Reads/writes Firebase directly (not via coordinator server).
 */
export default function BookingPage() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tokenData, setTokenData] = useState(null);
  const [competitionData, setCompetitionData] = useState(null);
  const [talentData, setTalentData] = useState(null);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [upcomingCompetitions, setUpcomingCompetitions] = useState([]);
  const [selectedCompIds, setSelectedCompIds] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    loadBookingData();
  }, [token]);

  async function loadBookingData() {
    try {
      setLoading(true);
      setError(null);

      // Read token metadata
      const tokenSnapshot = await get(ref(db, `bookingTokens/${token}`));
      if (!tokenSnapshot.exists()) {
        setError('This booking link is invalid or has expired.');
        setLoading(false);
        return;
      }

      const tokenInfo = tokenSnapshot.val();
      setTokenData(tokenInfo);

      // Check expiry
      if (new Date(tokenInfo.expiresAt) < new Date()) {
        setError('This link has expired.');
        setLoading(false);
        return;
      }

      // Check if already responded
      if (tokenInfo.responded === true) {
        setError("You've already responded to this invitation.");
        setLoading(false);
        return;
      }

      // Load competition data
      const compSnapshot = await get(ref(db, `competitions/${tokenInfo.compId}/config`));
      if (compSnapshot.exists()) {
        setCompetitionData(compSnapshot.val());
      }

      // Load talent data
      const talentSnapshot = await get(ref(db, `talentRoster/${tokenInfo.talentId}`));
      if (talentSnapshot.exists()) {
        setTalentData(talentSnapshot.val());
      }

      setLoading(false);
    } catch (err) {
      setError(`Error loading booking: ${err.message}`);
      setLoading(false);
    }
  }

  async function handleYes() {
    if (!tokenData) return;
    setSubmitting(true);

    try {
      // Update competition commentary status
      await update(ref(db, `competitions/${tokenData.compId}/commentary/${tokenData.talentId}`), {
        status: 'confirmed',
        confirmedAt: new Date().toISOString(),
      });

      // Mark token as responded
      await update(ref(db, `bookingTokens/${token}`), {
        responded: true,
        response: 'yes',
      });

      setConfirmed(true);
    } catch (err) {
      alert(`Error confirming: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleNo() {
    setShowAlternatives(true);
    await loadUpcomingCompetitions();
  }

  async function loadUpcomingCompetitions() {
    try {
      const compsSnapshot = await get(ref(db, 'competitions'));
      if (!compsSnapshot.exists()) return;

      const allComps = compsSnapshot.val();
      const now = new Date();
      const upcoming = Object.entries(allComps)
        .filter(([compId, comp]) => {
          // Exclude the original competition
          if (compId === tokenData.compId) return false;
          // Only future competitions
          const meetDate = comp.config?.meetDate ? new Date(comp.config.meetDate) : null;
          return meetDate && meetDate > now;
        })
        .map(([compId, comp]) => ({
          compId,
          eventName: comp.config?.eventName || 'Unnamed Event',
          meetDate: comp.config?.meetDate || '',
          venue: comp.config?.venue || '',
        }))
        .sort((a, b) => new Date(a.meetDate) - new Date(b.meetDate))
        .slice(0, 5); // Next 5

      setUpcomingCompetitions(upcoming);
    } catch (err) {
      console.error('Error loading upcoming competitions:', err);
    }
  }

  async function submitAlternatives() {
    if (!tokenData || selectedCompIds.length === 0) {
      alert('Please select at least one competition you could do.');
      return;
    }

    setSubmitting(true);
    try {
      // Save interested competitions (keyed object, not array)
      const interestedUpdates = {};
      selectedCompIds.forEach(compId => {
        interestedUpdates[compId] = true;
      });

      await update(ref(db, `talentRoster/${tokenData.talentId}/interested`), interestedUpdates);

      // Mark token as responded
      await update(ref(db, `bookingTokens/${token}`), {
        responded: true,
        response: 'no',
      });

      setConfirmed(true);
    } catch (err) {
      alert(`Error saving: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  }

  function toggleCompSelection(compId) {
    setSelectedCompIds(prev =>
      prev.includes(compId) ? prev.filter(id => id !== compId) : [...prev, compId]
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-gray-800 border border-gray-700 rounded-xl p-6 text-center">
          <XCircleIcon className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">Booking Error</h1>
          <p className="text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  if (confirmed) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-gray-800 border border-gray-700 rounded-xl p-6 text-center">
          <CheckCircleIcon className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">Thank You!</h1>
          <p className="text-gray-400">
            {showAlternatives
              ? "Your availability has been saved. We'll be in touch!"
              : "You're confirmed! We'll send you more details soon."}
          </p>
        </div>
      </div>
    );
  }

  if (showAlternatives) {
    return (
      <div className="min-h-screen bg-gray-900 text-white px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
            <h1 className="text-xl font-bold text-white mb-2">Which meets could you do?</h1>
            <p className="text-gray-400 mb-6 text-sm">
              Select any upcoming competitions you're available for:
            </p>

            {upcomingCompetitions.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No upcoming competitions found.</p>
            ) : (
              <div className="space-y-3 mb-6">
                {upcomingCompetitions.map(comp => (
                  <label
                    key={comp.compId}
                    className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedCompIds.includes(comp.compId)
                        ? 'bg-blue-900/30 border-blue-600'
                        : 'bg-gray-700 border-gray-600 hover:border-gray-500'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedCompIds.includes(comp.compId)}
                      onChange={() => toggleCompSelection(comp.compId)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="font-semibold text-white">{comp.eventName}</div>
                      <div className="text-sm text-gray-400 flex items-center gap-3 mt-1">
                        <span className="flex items-center gap-1">
                          <CalendarIcon className="w-3.5 h-3.5" />
                          {comp.meetDate}
                        </span>
                        {comp.venue && (
                          <span className="flex items-center gap-1">
                            <MapPinIcon className="w-3.5 h-3.5" />
                            {comp.venue}
                          </span>
                        )}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowAlternatives(false)}
                className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors"
              >
                Back
              </button>
              <button
                onClick={submitAlternatives}
                disabled={submitting || selectedCompIds.length === 0}
                className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg font-medium transition-colors"
              >
                {submitting ? 'Saving...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-gray-800 border border-gray-700 rounded-xl p-6">
        <h1 className="text-2xl font-bold text-white mb-1">Commentary Invitation</h1>
        <p className="text-gray-400 mb-6 text-sm">Hi {talentData?.name || 'there'}!</p>

        <div className="space-y-4 mb-6">
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="text-xs text-gray-400 mb-1">Event</div>
            <div className="font-semibold text-white">{competitionData?.eventName || 'Event'}</div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-700 rounded-lg p-4">
              <div className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                <CalendarIcon className="w-3.5 h-3.5" />
                Date
              </div>
              <div className="text-sm font-medium text-white">
                {competitionData?.meetDate || 'TBD'}
              </div>
            </div>

            {competitionData?.venue && (
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                  <MapPinIcon className="w-3.5 h-3.5" />
                  Venue
                </div>
                <div className="text-sm font-medium text-white">{competitionData.venue}</div>
              </div>
            )}
          </div>

          <div className="bg-gray-700 rounded-lg p-4">
            <div className="text-xs text-gray-400 mb-1">Your Role</div>
            <div className="font-semibold text-white capitalize">
              {tokenData?.role || 'Commentary'}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={handleYes}
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded-lg font-semibold transition-colors"
          >
            <CheckCircleIcon className="w-5 h-5" />
            Yes, I'm available
          </button>

          <button
            onClick={handleNo}
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded-lg font-medium transition-colors"
          >
            <XCircleIcon className="w-5 h-5" />
            No, not this one
          </button>
        </div>
      </div>
    </div>
  );
}
