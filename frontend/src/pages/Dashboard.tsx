import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDailySummary, getMeals, MealDto, getGoal, Goal } from '../api';
import { DailySummaryCard } from '../components/DailySummaryCard';
import { MealCard } from '../components/MealCard';

export default function Dashboard() {
  const [selectedDate, setSelectedDate] = React.useState<Date>(new Date());
  const today = React.useMemo(() => new Date(), []);
  const isToday = sameDay(selectedDate, today);
  const dateStr = React.useMemo(() => formatDate(selectedDate), [selectedDate]);

  const { data: summary } = useQuery({
    queryKey: ['summary', dateStr],
    queryFn: () => getDailySummary(dateStr)
  });
  const { data: goal } = useQuery({
    queryKey: ['goal'],
    queryFn: () => getGoal(),
  });
  const { data: meals } = useQuery({
    queryKey: ['meals', dateStr],
    queryFn: () => getMeals(dateStr),
    // Poll only for today while processing meals
    refetchInterval: isToday ? 5000 : false
  });

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
      {summary && (
        <DailySummaryCard heading={"Daily Summary"} summary={summary} goal={goal} />
      )}
      <h2 className="font-semibold">Meals and bites of {formatHeading(selectedDate)}</h2>
      <div className="space-y-3">
        {meals?.map((m: MealDto) => (
          <MealCard key={m.id} meal={m} />
        ))}
      </div>
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
