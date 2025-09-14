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
import Insights from './pages/Insights';
import Profile from './pages/Profile';
import Promo from './pages/Promo';
import Pricing from './pages/Pricing';
import { MdAdd, MdOutlineFoodBank, MdInsights, MdWaterDrop } from 'react-icons/md';
import { PiSparkle } from 'react-icons/pi';
import { initToken, AUTH_EXPIRED_EVENT } from './api';
import { Header } from './components/Header';
import { useAuthToken } from './hooks/useAuthToken';
import { Toaster } from 'react-hot-toast';
import Coach from './pages/Coach';
import AddWater from './pages/AddWater';
import WaterDetail from './pages/WaterDetail';

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
      {/* Top gradient shadow to lift navbar from content */}
      <div aria-hidden="true" className="pointer-events-none absolute -top-3 left-0 right-0 h-3 bg-gradient-to-t from-black/10 to-transparent" />
      <div className="max-w-md mx-auto grid grid-cols-5 items-end py-1 px-3">
        {/* Meals */}
        <button
          onClick={handleToday}
          className={`flex flex-col items-center justify-center gap-0.5 py-1 text-xs ${isRoot || location.pathname.startsWith('/meals') ? 'text-emerald-600' : 'text-gray-600'}`}
          aria-label="Meals"
        >
          <MdOutlineFoodBank size={22} />
          <span className="text-[11px] leading-none">Meals</span>
        </button>

        {/* Coach */}
        <Link
          to="/coach"
          className={`flex flex-col items-center justify-center gap-0.5 py-1 text-xs ${location.pathname.startsWith('/coach') ? 'text-emerald-600' : 'text-gray-600'}`}
          aria-label="Coach"
        >
          <PiSparkle size={22} />
          <span className="text-[11px] leading-none">Coach</span>
        </Link>

        {/* Insights */}
        <Link
          to="/insights"
          className={`flex flex-col items-center justify-center gap-0.5 py-1 text-xs ${location.pathname.startsWith('/insights') ? 'text-emerald-600' : 'text-gray-600'}`}
          aria-label="Insights"
        >
          <MdInsights size={22} />
          <span className="text-[11px] leading-none">Insights</span>
        </Link>

        {/* Add Water */}
        <Link
          to="/water"
          className={`flex flex-col items-center justify-center gap-0.5 py-1 text-xs ${location.pathname.startsWith('/water') ? 'text-emerald-600' : 'text-gray-600'}`}
          aria-label="Add Water"
        >
          <span className="w-9 h-9 rounded-full bg-sky-500 text-white border border-sky-600 flex items-center justify-center shadow-sm hover:brightness-95 active:scale-95 transition">
            <MdWaterDrop size={18} />
          </span>
          <span className="text-[11px] leading-none">Add Water</span>
        </Link>

        {/* Add Meal */}
        <Link
          to="/add"
          className={`flex flex-col items-center justify-center gap-0.5 py-1 text-xs ${location.pathname === '/add' ? 'text-emerald-600' : 'text-gray-600'}`}
          aria-label="Add meal"
        >
          <span className="w-9 h-9 rounded-full bg-emerald-500 text-white border border-emerald-600 flex items-center justify-center shadow-sm hover:brightness-95 active:scale-95 transition">
            <MdAdd size={18} />
          </span>
          <span className="text-[11px] leading-none">Add Meal</span>
        </Link>
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
        <div className="bg-gray-50 min-h-[calc(100vh-3.5rem)]">
          <Routes>
            <Route path="/" element={<RequireAuth><AuthenticatedFrame><Dashboard /></AuthenticatedFrame></RequireAuth>} />
            <Route path="/meals/:date" element={<RequireAuth><AuthenticatedFrame><Dashboard /></AuthenticatedFrame></RequireAuth>} />
            <Route path="/add" element={<RequireAuth><AuthenticatedFrame><AddMeal /></AuthenticatedFrame></RequireAuth>} />
            <Route path="/goal" element={<RequireAuth><AuthenticatedFrame><Goal /></AuthenticatedFrame></RequireAuth>} />
            <Route path="/water" element={<RequireAuth><AuthenticatedFrame><AddWater /></AuthenticatedFrame></RequireAuth>} />
            <Route path="/water/:id" element={<RequireAuth><AuthenticatedFrame><WaterDetail /></AuthenticatedFrame></RequireAuth>} />
            <Route path="/insights" element={<RequireAuth><AuthenticatedFrame><Insights /></AuthenticatedFrame></RequireAuth>} />
            <Route path="/coach" element={<RequireAuth><AuthenticatedFrame><Coach /></AuthenticatedFrame></RequireAuth>} />
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
