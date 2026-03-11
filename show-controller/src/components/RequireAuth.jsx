import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * RequireAuth - Route guard component for protected pages
 *
 * Wraps routes that require authentication. If the user is not signed in,
 * redirects to /login with the original destination stored in state.
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
  const { user, loading } = useAuth();
  const location = useLocation();

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

  // User is authenticated, render the protected content
  return children;
}
