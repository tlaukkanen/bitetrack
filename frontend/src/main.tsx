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
import { initToken } from './api';
import { Header } from './components/Header';

initToken();

const qc = new QueryClient();

function NavBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const isRoot = location.pathname === '/';
  const hasToken = !!localStorage.getItem('token');
  const handleToday = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!isRoot) navigate('/');
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('gotoToday'));
    }, 0);
  };
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 text-sm">
      <a href="#today" onClick={handleToday} className="font-medium text-emerald-600">Today</a>
      <Link to="/add" className="text-gray-700">Add</Link>
      {hasToken ? <Link to="/goal" className="text-gray-700">My Goal</Link> : <Link to="/login" className="text-gray-700">Login</Link>}
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
        <div className="pt-2 pb-16 max-w-md mx-auto bg-gray-50 min-h-screen">
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
