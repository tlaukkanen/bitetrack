import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
// Removed direct logout import; using hook instead
import { useAuthToken } from '../hooks/useAuthToken';
import toast from 'react-hot-toast';

export function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasToken, logout } = useAuthToken();
  const [open, setOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    function handle(e: MouseEvent) {
      if (open && menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    window.addEventListener('mousedown', handle);
    return () => window.removeEventListener('mousedown', handle);
  }, [open]);


  async function handleLogout() {
    await logout();
    setOpen(false);
    toast.success('Logged out');
    navigate('/');
  }

  const wideRoutes = ['/promo', '/pricing'];
  const isWide = wideRoutes.some(p => location.pathname.startsWith(p));
  return (
    <header className="sticky top-0 z-10 bg-white border-b shadow-sm">
      <div className={`${isWide ? 'max-w-4xl' : 'max-w-md'} mx-auto flex items-center justify-between px-4 py-2 relative`}>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex items-center gap-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded"
          aria-label="Go to dashboard"
        >
          <img src="/icons/logo-128.png" alt="BiteTrack logo" className="h-8 w-8 rounded" />
          <span className="text-lg font-bold text-emerald-600 tracking-tight">BiteTrack</span>
        </button>
        <div className="flex items-center">
          {hasToken ? (
            <div className="relative" ref={menuRef}>
              <button
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={() => setOpen(o => !o)}
                className="h-9 w-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {/* Simple user circle icon / fallback initial */}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
                </svg>
              </button>
              {open && (
                <div className="absolute right-0 mt-2 w-44 bg-white border rounded shadow-lg py-1 text-sm animate-fade-in" role="menu">
                  <button onClick={() => { setOpen(false); navigate('/goal'); }} className="w-full text-left px-3 py-2 hover:bg-emerald-50" role="menuitem">My goal</button>
                  <button onClick={() => { setOpen(false); navigate('/profile'); }} className="w-full text-left px-3 py-2 hover:bg-emerald-50" role="menuitem">Profile</button>
                  <div className="h-px bg-gray-200 my-1" />
                  <button onClick={handleLogout} className="w-full text-left px-3 py-2 hover:bg-emerald-50 text-rose-600" role="menuitem">Logout</button>
                </div>
              )}
            </div>
          ) : (
            <button onClick={() => navigate('/login')} className="text-emerald-600 text-sm font-medium">Login</button>
          )}
        </div>
      </div>
    </header>
  );
}