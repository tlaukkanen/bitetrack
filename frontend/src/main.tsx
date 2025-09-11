import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './styles.css';
import Dashboard from './pages/Dashboard';
import AddMeal from './pages/AddMeal';
import Login from './pages/Login';
import MealDetail from './pages/MealDetail';
import Goal from './pages/Goal';
import Profile from './pages/Profile';
import Promo from './pages/Promo';
import Pricing from './pages/Pricing';
import { MdAdd } from 'react-icons/md';
import { initToken, AUTH_EXPIRED_EVENT } from './api';
import { Header } from './components/Header';
import { useAuthToken } from './hooks/useAuthToken';
import { Toaster } from 'react-hot-toast';

initToken();

const qc = new QueryClient();

function AuthenticatedFrame({ children }: { children: React.ReactElement }) {
  return (
    <div className="pt-2 pb-24 max-w-md mx-auto min-h-screen">
      {children}
    </div>
  );
}

function NavBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const isRoot = location.pathname === '/';
  const { hasToken } = useAuthToken();
  if (!hasToken) return null;
  const handleToday = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!isRoot) navigate('/');
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('gotoToday'));
    }, 0);
  };
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t z-20 pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-md mx-auto flex items-center py text-base px-4">
        <div className="flex-1 flex justify-start">
          <a
            href="#today"
            onClick={handleToday}
            className="inline-flex items-center justify-center h-11 px-4 rounded-md font-semibold text-emerald-600"
          >
            Today
          </a>
        </div>
        <div className="flex-1 flex justify-center">
          <Link
            to="/add"
            aria-label="Add meal"
            className="w-12 h-12 -mt-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg border border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-400 active:scale-95 transition"
          >
            <MdAdd size={28} />
          </Link>
        </div>
        <div className="flex-1 flex justify-end">
          {hasToken ? (
            <Link to="/goal" className="inline-flex items-center justify-center h-11 px-4 rounded-md font-semibold text-gray-700">My Goal</Link>
          ) : (
            <Link to="/login" className="inline-flex items-center justify-center h-11 px-4 rounded-md font-semibold text-gray-700">Login</Link>
          )}
        </div>
      </div>
    </nav>
  );
}

// Wrapper that enforces auth for protected routes
function RequireAuth({ children }: { children: React.ReactElement }) {
  const navigate = useNavigate();
  const location = useLocation();
  const hasToken = !!localStorage.getItem('token');
  React.useEffect(() => {
    // No redirect; when not logged in, we show Promo instead.
  }, [hasToken, location.pathname, navigate]);
  if (!hasToken && location.pathname !== '/login') {
    return <Promo />;
  }
  return children;
}

function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <AuthExpiryListener />
        <Header />
        <NavBar />
        <Toaster position="top-center" toastOptions={{ duration: 2500 }} />
        <div className="bg-gray-50 min-h-screen">
          <Routes>
            <Route path="/" element={<RequireAuth><AuthenticatedFrame><Dashboard /></AuthenticatedFrame></RequireAuth>} />
            <Route path="/meals/:date" element={<RequireAuth><AuthenticatedFrame><Dashboard /></AuthenticatedFrame></RequireAuth>} />
            <Route path="/add" element={<RequireAuth><AuthenticatedFrame><AddMeal /></AuthenticatedFrame></RequireAuth>} />
            <Route path="/goal" element={<RequireAuth><AuthenticatedFrame><Goal /></AuthenticatedFrame></RequireAuth>} />
            <Route path="/profile" element={<RequireAuth><AuthenticatedFrame><Profile /></AuthenticatedFrame></RequireAuth>} />
            <Route path="/meal/:id" element={<RequireAuth><AuthenticatedFrame><MealDetail /></AuthenticatedFrame></RequireAuth>} />
            <Route path="/promo" element={<Promo />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/login" element={<Login />} />
          </Routes>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

// Listen for global auth expiration and navigate to login with returnUrl
function AuthExpiryListener() {
  const navigate = useNavigate();
  React.useEffect(() => {
    const handler = (e: Event) => {
      try {
        const detail = (e as CustomEvent).detail as { path?: string } | undefined;
        const path = detail?.path || window.location.pathname + window.location.search + window.location.hash;
        const params = new URLSearchParams();
        if (path && !path.startsWith('/login')) params.set('returnUrl', path);
        navigate(`/login${params.toString() ? `?${params.toString()}` : ''}`);
      } catch {
        navigate('/login');
      }
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, handler as EventListener);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handler as EventListener);
  }, [navigate]);
  return null;
}

createRoot(document.getElementById('root')!).render(<App />);
