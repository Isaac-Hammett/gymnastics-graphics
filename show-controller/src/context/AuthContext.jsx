import { createContext, useContext, useEffect, useState } from 'react';
import {
  auth, signInWithEmailAndPassword, signOut as firebaseSignOut, onAuthStateChanged,
  sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink,
} from '../lib/firebase';

// Email-link (talent) sessions are tagged locally so the app can tell a commentator
// from a producer account: both are Firebase users on the same password provider.
const TALENT_UID_KEY = 'talentEmailLinkUid';
const PENDING_EMAIL_KEY = 'talentEmailForSignIn';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signIn = (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  const signOut = () => {
    return firebaseSignOut(auth);
  };

  const sendTalentLink = async (email, from) => {
    const url = `${window.location.origin}/talent-sign-in?from=${encodeURIComponent(from || '/')}`;
    await sendSignInLinkToEmail(auth, email, { url, handleCodeInApp: true });
    window.localStorage.setItem(PENDING_EMAIL_KEY, email);
  };

  const isTalentLink = () => isSignInWithEmailLink(auth, window.location.href);
  const pendingTalentEmail = () => window.localStorage.getItem(PENDING_EMAIL_KEY) || '';

  const completeTalentLink = async (email) => {
    const cred = await signInWithEmailLink(auth, email, window.location.href);
    window.localStorage.setItem(TALENT_UID_KEY, cred.user.uid);
    window.localStorage.removeItem(PENDING_EMAIL_KEY);
    return cred;
  };

  // A password sign-in by the same uid clears nothing; only uids that signed in by link are talent.
  const isTalentSession = !!user && window.localStorage.getItem(TALENT_UID_KEY) === user.uid;

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, sendTalentLink, isTalentLink, pendingTalentEmail, completeTalentLink, isTalentSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
