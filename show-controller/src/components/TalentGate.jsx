import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { db, ref, get } from '../lib/firebase';

/**
 * TalentGate - lets a signed-in email-link user into Talent View only when the roster
 * email of a confirmed assignment (competitions/{compId}/commentary) matches theirs.
 * Producers (non-link accounts) pass without a check.
 */
export default function TalentGate({ compId, children }) {
  const { user, isTalentSession, signOut } = useAuth();
  const [allowed, setAllowed] = useState(null);

  useEffect(() => {
    if (!isTalentSession) return;
    let cancelled = false;
    (async () => {
      try {
        const email = (user.email || '').trim().toLowerCase();
        const snap = await get(ref(db, `competitions/${compId}/commentary`));
        const assignments = snap.val() || {};
        const ids = Object.keys(assignments).filter((id) => assignments[id]?.status === 'confirmed');
        const emails = await Promise.all(ids.map((id) => get(ref(db, `talentRoster/${id}/email`)).then((s) => s.val())));
        const ok = emails.some((e) => typeof e === 'string' && e.trim().toLowerCase() === email);
        if (!cancelled) setAllowed(ok);
      } catch {
        if (!cancelled) setAllowed(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isTalentSession, user, compId]);

  if (!isTalentSession) return children;

  if (allowed === null) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-gray-400">
        Checking your assignment...
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
        <div className="max-w-sm w-full bg-gray-800 border border-gray-700 rounded-xl p-6 text-center">
          <h1 className="text-xl font-bold text-white mb-2">Access denied</h1>
          <p className="text-gray-300 text-sm mb-4">
            {user.email} does not have a confirmed commentary assignment for this competition.
            Ask your producer to confirm you in the talent roster.
          </p>
          <button onClick={() => signOut()} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white text-sm">
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return children;
}
