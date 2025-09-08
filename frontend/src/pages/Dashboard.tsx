import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDailySummary, getMeals, MealDto, getGoal, Goal } from '../api';
import { DailySummaryCard } from '../components/DailySummaryCard';
import { MealCard } from '../components/MealCard';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { date: routeDate } = useParams<{ date?: string }>();
  // Initialize from route date when present
  const [selectedDate, setSelectedDate] = React.useState<Date>(() => routeDate ? parseDate(routeDate) ?? new Date() : new Date());
  const containerRef = React.useRef<HTMLDivElement>(null);
  const touchStartRef = React.useRef<{ x: number; y: number; id: number | undefined } | null>(null);
  const today = React.useMemo(() => new Date(), []);
  const isToday = sameDay(selectedDate, today);
  const dateStr = React.useMemo(() => formatDate(selectedDate), [selectedDate]);

  const { data: summary, isLoading: isSummaryLoading } = useQuery({
    queryKey: ['summary', dateStr],
    queryFn: () => getDailySummary(dateStr)
  });
  const { data: goal, isLoading: isGoalLoading } = useQuery({
    queryKey: ['goal'],
    queryFn: () => getGoal(),
  });
  const { data: meals, isLoading: isMealsLoading } = useQuery({
    queryKey: ['meals', dateStr],
    queryFn: () => getMeals(dateStr),
    // Poll only for today while processing meals
    refetchInterval: isToday ? 15000 : false
  });
  const isAnyLoading = isSummaryLoading || isGoalLoading || isMealsLoading;

  // Keep URL in sync when selectedDate changes
  React.useEffect(() => {
    const pathForDate = (d: Date) => `/meals/${formatDate(d)}`;
    if (sameDay(selectedDate, today)) {
      if (location.pathname !== '/') navigate('/', { replace: false });
    } else {
      const target = pathForDate(selectedDate);
      if (location.pathname !== target) navigate(target, { replace: false });
    }
  }, [selectedDate]);

  // Update selected date if user navigates via address bar/back/forward
  React.useEffect(() => {
    if (!routeDate) {
      if (!sameDay(selectedDate, today)) setSelectedDate(new Date());
    } else {
      const d = parseDate(routeDate);
      if (d && !sameDay(d, selectedDate)) setSelectedDate(d);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeDate]);

  // Listen for global 'gotoToday' events triggered by nav
  React.useEffect(() => {
    function handler() {
      setSelectedDate(new Date());
    }
    window.addEventListener('gotoToday', handler as EventListener);
    return () => window.removeEventListener('gotoToday', handler as EventListener);
  }, []);

  // Keyboard navigation (Left/Right Arrows)
  React.useEffect(() => {
    function isFormField(el: EventTarget | null) {
      const t = el as HTMLElement | null;
      if (!t) return false;
      const tag = t.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t as HTMLElement).isContentEditable;
    }
    function onKey(e: KeyboardEvent) {
      if (isFormField(e.target)) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setSelectedDate(d => addDays(d, -1));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setSelectedDate(d => addDays(d, 1));
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Touch swipe navigation (Left = next day, Right = previous day)
  const handleTouchStart = React.useCallback((e: React.TouchEvent) => {
    const t = e.changedTouches[0];
    if (!t) return;
    touchStartRef.current = { x: t.clientX, y: t.clientY, id: t.identifier };
  }, []);
  const handleTouchEnd = React.useCallback((e: React.TouchEvent) => {
    const start = touchStartRef.current;
    if (!start) return;
    const tList = Array.from(e.changedTouches);
    const t = tList.find(tt => tt.identifier === start.id) ?? tList[0];
    if (!t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const THRESHOLD = 50; // px
    const MAX_ANGLE = 30; // px vertical tolerance
    if (absX > THRESHOLD && absY < MAX_ANGLE) {
      if (dx < 0) {
        // swipe left -> next day
        setSelectedDate(d => addDays(d, 1));
      } else {
        // swipe right -> previous day
        setSelectedDate(d => addDays(d, -1));
      }
    }
    touchStartRef.current = null;
  }, []);
  return (
    <div ref={containerRef} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} className="p-4 pb-24 space-y-4">
      {/* Month & year + 7-day navigation */}
      <div className="space-y-2">
        <div className="text-center">
          <h1 className="text-lg font-semibold text-gray-700">{formatMonthYear(selectedDate)}</h1>
        </div>
        <div className="flex items-center justify-between gap-2">
          {getVisibleDates(selectedDate, today).map((d) => {
            const isSelected = sameDay(d, selectedDate);
            const base = "w-10 h-10 rounded-full flex items-center justify-center border text-sm font-medium transition";
            const selectedCls = "bg-emerald-500 border-emerald-500 text-white";
            const unselectedCls = "border-gray-300 text-gray-700 hover:bg-gray-50";
            return (
              <button
                key={formatDate(d)}
                type="button"
                onClick={() => setSelectedDate(new Date(d.getFullYear(), d.getMonth(), d.getDate()))}
                className={`${base} ${isSelected ? selectedCls : unselectedCls}`}
                aria-current={isSelected ? 'date' : undefined}
                aria-label={formatHeading(d)}
              >
                {d.getDate()}
              </button>
            );
          })}
        </div>
        <div className="text-center">
          <div className="text-base font-medium text-gray-700">{formatWeekday(selectedDate)}</div>
        </div>
      </div>
      <DailySummaryCard
        heading={"Daily Summary"}
        summary={summary || {}}
        goal={goal}
        loading={isSummaryLoading || isGoalLoading}
      />
  <div className="h-px bg-gray-200" />
      {isMealsLoading ? (
        <div className="space-y-3" aria-live="polite" aria-busy>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="block p-3 rounded-lg bg-white shadow-sm border">
              <div className="flex gap-3">
                <div className="w-20 h-20 rounded-md overflow-hidden flex-shrink-0">
                  <Skeleton height="100%" />
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-between min-h-[5rem]">
                  <div className="flex justify-between text-xs text-gray-600">
                    <Skeleton width={80} height={12} />
                    <Skeleton width={60} height={12} />
                  </div>
                  <div className="mt-1">
                    <Skeleton width="60%" height={12} />
                  </div>
                  <div className="mt-2 flex items-end justify-between gap-3">
                    <Skeleton width={80} height={16} />
                    <div className="flex gap-3">
                      <Skeleton width={40} height={14} />
                      <Skeleton width={40} height={14} />
                      <Skeleton width={40} height={14} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : meals && meals.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-gray-500">No recorded meals yet.</p>
          <Link
            to="/add"
            className="inline-block mt-3 px-4 py-2 rounded-md bg-emerald-500 text-white font-medium shadow-sm border border-emerald-600 hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-400 active:scale-[0.99] transition"
          >
            Add your first meal
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {meals?.map((m: MealDto) => (
            <MealCard key={m.id} meal={m} />
          ))}
        </div>
      )}
    </div>
  );
}

// DailySummaryCard extracted to components/DailySummaryCard.tsx

// MealThumb moved into MealCard component

// Helpers
function addDays(date: Date, delta: number) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + delta);
  return d;
}
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function formatDate(d: Date) {
  // YYYY-MM-DD without timezone shift
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${d.getFullYear()}-${m.toString().padStart(2,'0')}-${day.toString().padStart(2,'0')}`;
}
function formatHeading(d: Date) {
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function parseDate(s?: string): Date | null {
  if (!s) return null;
  const m = /^\d{4}-\d{2}-\d{2}$/.exec(s);
  if (!m) return null;
  const [y, mo, d] = s.split('-').map(n => parseInt(n, 10));
  if (!y || !mo || !d) return null;
  const dt = new Date(y, mo - 1, d);
  // Ensure date components match (avoid invalid like 2025-02-31)
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return dt;
}

// New helpers for the date navigation
function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function daysBetween(a: Date, b: Date) {
  const MS = 24 * 60 * 60 * 1000;
  const ad = startOfDay(a).getTime();
  const bd = startOfDay(b).getTime();
  return Math.round((ad - bd) / MS);
}
function rangeDays(start: Date, count: number) {
  const res: Date[] = [];
  for (let i = 0; i < count; i++) {
    const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    s.setDate(s.getDate() + i);
    res.push(s);
  }
  return res;
}
function getVisibleDates(selected: Date, today: Date) {
  const s = startOfDay(selected);
  const t = startOfDay(today);
  const daysBack = daysBetween(t, s); // >=0 means selected is today or in the past
  if (daysBack >= 0 && daysBack <= 3) {
    const end = t;
    const start = addDays(end, -6);
    return rangeDays(start, 7);
  }
  // Center the window on the selected day
  const start = addDays(s, -3);
  return rangeDays(start, 7);
}
function formatMonthYear(d: Date) {
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}
function formatWeekday(d: Date) {
  return d.toLocaleDateString(undefined, { weekday: 'long' });
}
