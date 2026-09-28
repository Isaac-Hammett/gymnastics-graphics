import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * TalentSignInPage - passwordless email-link sign-in for commentators.
 * URL: /talent-sign-in  (the emailed link also lands here, with ?from=<talent path>)
 * Access is decided after sign-in by the confirmed CRM assignment (see TalentGate).
 */
export default function TalentSignInPage() {
  const { user, loading, sendTalentLink, isTalentLink, pendingTalentEmail, completeTalentLink } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const from = params.get('from') || location.state?.from || '/';

  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const arrivedByLink = isTalentLink();

  async function finish(address) {
    setBusy(true);
    setError(null);
    try {
      await completeTalentLink(address);
      navigate(from, { replace: true });
    } catch {
      setError('That sign-in link is invalid or has expired. Request a new one.');
      setBusy(false);
    }
  }

  useEffect(() => {
    if (arrivedByLink && pendingTalentEmail()) finish(pendingTalentEmail());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loading && user && !arrivedByLink) navigate(from, { replace: true });
  }, [user, loading, arrivedByLink, navigate, from]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (arrivedByLink) return finish(email);
    setBusy(true);
    setError(null);
    try {
      await sendTalentLink(email, from);
      setSent(true);
    } catch (err) {
      setError(err.code === 'auth/invalid-email' ? 'Invalid email address' : 'Could not send the sign-in link. Please try again.');
    }
    setBusy(false);
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="max-w-sm w-full bg-gray-800 border border-gray-700 rounded-xl p-6">
        <h1 className="text-xl font-bold text-white mb-2 text-center">Talent Sign In</h1>
        {sent ? (
          <p className="text-gray-300 text-sm text-center">Check your email for a sign-in link, then open it on this device.</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-gray-400 text-sm text-center">
              {arrivedByLink ? 'Confirm your email to finish signing in.' : 'Enter the email your producer has on file. We will send you a sign-in link.'}
            </p>
            <input
              id="talent-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              aria-label="Email"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
              placeholder="you@example.com"
            />
            {error && <div className="text-red-400 text-sm text-center">{error}</div>}
            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg font-medium text-white transition-colors"
            >
              {busy ? 'Working...' : arrivedByLink ? 'Finish sign in' : 'Email me a sign-in link'}
            </button>
          </form>
        )}
        {sent && error && <div className="text-red-400 text-sm text-center mt-3">{error}</div>}
      </div>
    </div>
  );
}
