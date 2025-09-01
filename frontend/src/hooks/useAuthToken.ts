import React from 'react';
import { logout as apiLogout } from '../api';

/**
 * React hook to track the auth token stored in localStorage.
 * Relies on the global `authTokenChanged` CustomEvent dispatched in `setToken`.
 */
export function useAuthToken() {
  const [token, setToken] = React.useState<string | null>(() => {
    try {
      return localStorage.getItem('token');
    } catch {
      return null;
    }
  });

  React.useEffect(() => {
    const listener = (e: Event) => {
      try {
        setToken(localStorage.getItem('token'));
      } catch {
        setToken(null);
      }
    };
    window.addEventListener('authTokenChanged', listener);
    return () => window.removeEventListener('authTokenChanged', listener);
  }, []);

  const logout = React.useCallback(() => {
    apiLogout();
  }, []);

  return { token, hasToken: !!token, logout };
}
