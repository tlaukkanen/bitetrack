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
  return (
    <div className="p-4 pb-24 space-y-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setSelectedDate(d => addDays(d, -1))}
          className="px-2 py-1 text-lg font-semibold disabled:opacity-40"
          aria-label="Previous day"
        >&larr;</button>
  <h1 className="text-xl font-bold text-center flex-1 text-emerald-600">
          {isToday ? "Today's Macros" : formatHeading(selectedDate)}
        </h1>
        {!isToday ? (
          <button
            type="button"
            onClick={() => setSelectedDate(d => addDays(d, 1))}
            className="px-2 py-1 text-lg font-semibold"
            aria-label="Next day"
          >&rarr;</button>
        ) : (
          <span aria-hidden className="px-2 py-1 text-lg font-semibold invisible">&rarr;</span>
        )}
      </div>
      <DailySummaryCard
        heading={"Daily Summary"}
        summary={summary || {}}
        goal={goal}
        loading={isSummaryLoading || isGoalLoading}
      />
      <h2 className="font-semibold">Meals and bites of {formatHeading(selectedDate)}</h2>
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
