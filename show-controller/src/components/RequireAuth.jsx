import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * RequireAuth - Route guard component for protected pages
 *
 * Wraps routes that require authentication. If the user is not signed in,
 * redirects to /login with the original destination stored in state.
 *
 * Also displays a floating sign-out button in the top-right corner of every
 * protected page, showing the user's email and allowing them to sign out.
 *
 * Usage in App.jsx:
 * ```jsx
 * <Route path="/talent" element={
 *   <RequireAuth>
 *     <TalentPage />
 *   </RequireAuth>
 * } />
 * ```
 */
export default function RequireAuth({ children }) {
  const { user, loading, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Handle sign out
  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  // Show loading state while auth status is being resolved
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  // If not authenticated, redirect to login with the current path stored
  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // User is authenticated, render the protected content with sign-out button
  return (
    <>
      <div
        style={{
          position: 'fixed',
          top: 12,
          right: 16,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span style={{ color: '#9CA3AF', fontSize: 13 }}>{user.email}</span>
        <button
          onClick={handleSignOut}
          style={{
            backgroundColor: 'transparent',
            border: '1px solid #4B5563',
            borderRadius: 4,
            color: '#9CA3AF',
            fontSize: 12,
            padding: '4px 10px',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = '#374151';
            e.target.style.color = '#F3F4F6';
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = 'transparent';
            e.target.style.color = '#9CA3AF';
          }}
        >
          Sign Out
        </button>
      </div>
      {children}
    </>
  );
}
