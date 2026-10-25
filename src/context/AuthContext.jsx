import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const AuthContext = createContext(null);
const TOKEN_KEY = 'attendwise:auth_token';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('login'); // 'login' | 'signup'
  const [recentLogins, setRecentLogins] = useState([]);

  // Fetch current user details if token is stored
  const loadUser = useCallback(async (jwtToken) => {
    if (!jwtToken) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${jwtToken}`,
        },
      });
      const data = await res.json();
      if (data.success && data.user) {
        setUser(data.user);
        if (data.recentLogins) {
          setRecentLogins(data.recentLogins);
        }
      } else {
        // Token expired or invalid
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
      }
    } catch (err) {
      console.warn('Could not verify authentication session:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser(token);
  }, [token, loadUser]);

  const [isGuest, setIsGuest] = useState(() => {
    try {
      return sessionStorage.getItem('attendwise:guest_session') === 'true';
    } catch {
      return false;
    }
  });

  const continueAsGuest = () => {
    try {
      sessionStorage.setItem('attendwise:guest_session', 'true');
    } catch {}
    setIsGuest(true);
  };

  const login = async (email, password) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Login failed. Please check your credentials.');
      }
      localStorage.setItem(TOKEN_KEY, data.token);
      setToken(data.token);
      setUser(data.user);
      try {
        sessionStorage.removeItem('attendwise:guest_session');
      } catch {}
      setIsGuest(false);
      setModalOpen(false);
      return data;
    } catch (err) {
      throw err;
    }
  };

  const register = async ({ name, email, password, rollNo }) => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, rollNo }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Registration failed.');
      }
      localStorage.setItem(TOKEN_KEY, data.token);
      setToken(data.token);
      setUser(data.user);
      try {
        sessionStorage.removeItem('attendwise:guest_session');
      } catch {}
      setIsGuest(false);
      setModalOpen(false);
      return data;
    } catch (err) {
      throw err;
    }
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    try {
      sessionStorage.removeItem('attendwise:guest_session');
    } catch {}
    setToken(null);
    setUser(null);
    setIsGuest(false);
    setRecentLogins([]);
  };

  const openLogin = () => {
    setModalMode('login');
    setModalOpen(true);
  };

  const openSignup = () => {
    setModalMode('signup');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
  };

  const fetchLoginHistory = async () => {
    if (!token) return [];
    try {
      const res = await fetch('/api/auth/logins', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && data.logins) {
        setRecentLogins(data.logins);
        return data.logins;
      }
    } catch (err) {
      console.warn('Failed to fetch login history', err);
    }
    return [];
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthenticated: Boolean(user),
        isGuest,
        continueAsGuest,
        modalOpen,
        modalMode,
        setModalMode,
        openLogin,
        openSignup,
        closeModal,
        login,
        register,
        logout,
        recentLogins,
        fetchLoginHistory,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    // Safe fallback for standalone component rendering or tests
    return {
      user: null,
      token: null,
      loading: false,
      isAuthenticated: false,
      isGuest: true,
      continueAsGuest: () => {},
      modalOpen: false,
      modalMode: 'login',
      setModalMode: () => {},
      openLogin: () => {},
      openSignup: () => {},
      closeModal: () => {},
      login: async () => {},
      register: async () => {},
      logout: () => {},
      recentLogins: [],
      fetchLoginHistory: async () => [],
    };
  }
  return ctx;
}
