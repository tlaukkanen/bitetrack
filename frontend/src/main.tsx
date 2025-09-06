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
import { MdAdd } from 'react-icons/md';
import { initToken } from './api';
import { Header } from './components/Header';
import { useAuthToken } from './hooks/useAuthToken';
import { Toaster } from 'react-hot-toast';

initToken();

const qc = new QueryClient();

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
      <div className="max-w-md mx-auto flex justify-around items-center py text-base px-4">
        <a
          href="#today"
          onClick={handleToday}
          className="inline-flex items-center justify-center h-11 px-4 rounded-md font-semibold text-emerald-600"
        >
          Today
        </a>
        <Link
          to="/add"
          aria-label="Add meal"
          className="w-12 h-12 -mt-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg border border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-400 active:scale-95 transition"
        >
          <MdAdd size={28} />
        </Link>
        {hasToken ? (
          <Link to="/goal" className="inline-flex items-center justify-center h-11 px-4 rounded-md font-semibold text-gray-700">My Goal</Link>
        ) : (
          <Link to="/login" className="inline-flex items-center justify-center h-11 px-4 rounded-md font-semibold text-gray-700">Login</Link>
        )}
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
    if (!hasToken) {
      // Avoid infinite redirect loop if already on login
      if (location.pathname !== '/login') navigate('/login');
    }
  }, [hasToken, location.pathname, navigate]);
  if (!hasToken && location.pathname !== '/login') {
    return null; // Render nothing while redirecting
  }
  return children;
}

function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Header />
        <NavBar />
        <Toaster position="top-center" toastOptions={{ duration: 2500 }} />
        <div className="pt-2 pb-24 max-w-md mx-auto bg-gray-50 min-h-screen">
          <Routes>
            <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
            <Route path="/add" element={<RequireAuth><AddMeal /></RequireAuth>} />
            <Route path="/goal" element={<RequireAuth><Goal /></RequireAuth>} />
            <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
            <Route path="/meal/:id" element={<RequireAuth><MealDetail /></RequireAuth>} />
            <Route path="/login" element={<Login />} />
          </Routes>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
