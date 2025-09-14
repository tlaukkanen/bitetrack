import React, { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getDailySummary, getGoal, DailySummary, Goal } from '../api';

type Macro = 'all' | 'calories' | 'protein' | 'carbs' | 'fat' | 'water';

const macroColors: Record<Exclude<Macro, 'all'>, string> = {
  calories: '#1f2937', // gray-800
  protein: '#10b981',  // emerald-500
  carbs: '#facc15',    // yellow-400
  fat: '#fb923c',       // orange-400
  water: '#38bdf8'     // sky-400
};

function toDateStr(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function lastNDates(n: number): string[] {
  const out: string[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    out.push(toDateStr(d));
  }
  return out;
}

function useSummaries(days: number) {
  return useQuery({
    queryKey: ['insights-summaries', days],
    queryFn: async () => {
      const dates = lastNDates(days);
      const results = await Promise.all(dates.map((dt) => getDailySummary(dt).catch(() => ({ date: dt, calories: 0, protein: 0, carbs: 0, fat: 0 } as DailySummary))));
      // Ensure order matches dates
      return results;
    }
  });
}

function formatShortDate(date: string) {
  // date is expected YYYY-MM-DD
  try {
    const [y, m, d] = date.split('-').map((s) => parseInt(s, 10));
    const dt = new Date(y, (m - 1), d);
    return dt.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return date;
  }
}

interface LineDef {
  key: Exclude<Macro, 'all'>;
  label: string;
  color: string;
}

function computeDomain(values: number[], useNice = true): { min: number; max: number } {
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === Infinity || max === -Infinity) return { min: 0, max: 1 };
  if (!useNice) return { min, max: max === min ? min + 1 : max };
  // Nice rounding
  const span = Math.max(1, max - min);
  const pow10 = Math.pow(10, Math.floor(Math.log10(span)));
  const step = pow10 / 2;
  min = Math.floor(min / step) * step;
  max = Math.ceil(max / step) * step;
  if (max === min) max = min + step;
  return { min, max };
}

function InsightsChart({
  data,
  lines,
  height = 220,
  yUnit,
  yMaxCap,
  showGoal,
  goalValue
}: {
  data: Array<{ date: string } & Record<'calories' | 'protein' | 'carbs' | 'fat' | 'water', number>>;
  lines: LineDef[];
  height?: number;
  yUnit?: string;
  yMaxCap?: number; // optional cap for percent view
  showGoal?: boolean;
  goalValue?: number | null;
}) {
  const width = 360; // viewBox width, responsive via preserveAspectRatio
  const padding = { left: 36, right: 12, top: 12, bottom: 28 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const xForIndex = (idx: number) => {
    if (data.length <= 1) return padding.left + innerW;
    const t = idx / (data.length - 1);
    return padding.left + t * innerW;
  };

  // Build series
  const series = lines.map((l) => ({
    key: l.key,
    color: l.color,
    points: data.map((d, i) => ({ x: xForIndex(i), yRaw: d[l.key] }))
  }));

  // Compute combined y domain
  const allValues = series.flatMap((s) => s.points.map((p) => p.yRaw));
  let domain = computeDomain(allValues);
  if (typeof yMaxCap === 'number') {
    domain.max = Math.max(domain.max, Math.min(yMaxCap, Math.max(...allValues)));
    domain.min = Math.min(domain.min, 0);
  }

  const yToPx = (v: number) => {
    const { min, max } = domain;
    const t = (v - min) / (max - min || 1);
    return padding.top + (1 - t) * innerH;
  };

  // Grid lines (5)
  const ticks = 5;
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => {
    const t = i / ticks;
    const v = domain.min + t * (domain.max - domain.min);
    return { v, y: padding.top + (1 - t) * innerH };
  });

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
      <rect x={0} y={0} width={width} height={height} fill="#ffffff" />

      {/* Vertical highlights for Mondays (30d view) */}
      {data.length >= 28 && data.map((d, i) => {
        try {
          const [yy, mm, dd] = d.date.split('-').map((s) => parseInt(s, 10));
          const dt = new Date(yy, mm - 1, dd);
          if (dt.getDay() !== 1) return null; // Monday only
          const x = xForIndex(i);
          return (
            <g key={`monday-${d.date}`}>
              <line
                x1={x}
                x2={x}
                y1={padding.top}
                y2={height - padding.bottom}
                stroke="#e5e7eb"
                strokeDasharray="2 4"
                strokeWidth={1}
              />
              <text
                x={x}
                y={padding.top - 2}
                textAnchor="middle"
                fontSize={9}
                fill="#94a3b8"
              >
                Mon
              </text>
            </g>
          );
        } catch {
          return null;
        }
      })}

      {/* Y grid + labels */}
      {yTicks.map((t, idx) => (
        <g key={idx}>
          <line x1={padding.left} x2={width - padding.right} y1={t.y} y2={t.y} stroke="#e5e7eb" strokeWidth={1} />
          <text x={padding.left - 6} y={t.y} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="#6b7280">
            {Math.round(t.v)}{yUnit || ''}
          </text>
        </g>
      ))}

      {/* X labels (density control: 7d=all, 14d=every 2nd, 30d=Mondays) */}
      {data.map((d, i) => {
        const len = data.length;
        let show = true;
        if (len >= 28) {
          // Show only Mondays
          try {
            const [yy, mm, dd] = d.date.split('-').map((s) => parseInt(s, 10));
            const dt = new Date(yy, mm - 1, dd);
            show = dt.getDay() === 1; // Monday
          } catch {
            show = i % 7 === 0; // fallback: weekly
          }
        } else if (len >= 14) {
          // Show every 2nd label
          show = i % 2 === 0;
        }
        if (!show) return null;
        return (
          <text key={d.date} x={xForIndex(i)} y={height - 6} textAnchor="middle" fontSize={10} fill="#6b7280">
            {formatShortDate(d.date)}
          </text>
        );
      })}

      {/* Goal line for single-macro mode */}
      {showGoal && goalValue && goalValue > 0 && (
        <g>
          <line x1={padding.left} x2={width - padding.right} y1={yToPx(goalValue)} y2={yToPx(goalValue)} stroke="#94a3b8" strokeDasharray="4 4" />
        </g>
      )}

      {/* Lines */}
      {series.map((s) => {
        const pts = s.points.map((p, i) => `${xForIndex(i)},${yToPx(p.yRaw)}`).join(' ');
        return (
          <g key={s.key}>
            <polyline fill="none" stroke={s.color} strokeWidth={2} points={pts} />
            {s.points.map((p, i) => (
              <circle key={i} cx={xForIndex(i)} cy={yToPx(p.yRaw)} r={2.5} fill={s.color} />
            ))}
          </g>
        );
      })}
    </svg>
  );
}

export default function Insights() {
  const [days, setDays] = useState<number>(() => {
    const v = (() => { try { return localStorage.getItem('insightsDays'); } catch { return null; } })();
    const n = v ? parseInt(v, 10) : 7;
    return [7, 14, 30].includes(n) ? n : 7;
  });
  const [mode, setMode] = useState<Macro>(() => {
    const v = (() => { try { return localStorage.getItem('insightsMode'); } catch { return null; } })();
    if (v === 'calories' || v === 'protein' || v === 'carbs' || v === 'fat' || v === 'water') return v as Macro;
    return 'all';
  });

  useEffect(() => { try { localStorage.setItem('insightsDays', String(days)); } catch {} }, [days]);
  useEffect(() => { try { localStorage.setItem('insightsMode', mode); } catch {} }, [mode]);

  const goalQ = useQuery({ queryKey: ['goal'], queryFn: getGoal });
  const { data: summaries, isLoading } = useSummaries(days);

  const allLines: LineDef[] = [
    { key: 'calories', label: 'Calories', color: macroColors.calories },
    { key: 'protein', label: 'Protein', color: macroColors.protein },
    { key: 'carbs', label: 'Carbs', color: macroColors.carbs },
    { key: 'fat', label: 'Fat', color: macroColors.fat },
    { key: 'water', label: 'Water (ml)', color: macroColors.water }
  ];

  const chartData = useMemo(() => {
    if (!summaries) return [] as Array<any>;
    const g = goalQ.data;
    const map = summaries.map((s) => ({ ...s }));
    if (mode === 'all') {
      return map.map((s) => ({
        date: s.date,
        calories: g && g.calories > 0 ? Math.round((s.calories / g.calories) * 100) : 0,
        protein: g && g.protein > 0 ? Math.round((s.protein / g.protein) * 100) : 0,
        carbs: g && g.carbs > 0 ? Math.round((s.carbs / g.carbs) * 100) : 0,
        fat: g && g.fat > 0 ? Math.round((s.fat / g.fat) * 100) : 0,
        water: g && (g as any).waterMl > 0 ? Math.round((s.waterMl / (g as any).waterMl) * 100) : 0
      }));
    }
    return map.map((s) => ({ date: s.date, calories: s.calories, protein: s.protein, carbs: s.carbs, fat: s.fat, water: s.waterMl }));
  }, [summaries, goalQ.data, mode]);

  const activeLines: LineDef[] = mode === 'all' ? allLines : allLines.filter((l) => l.key === mode);
  const yUnit = mode === 'all' ? '%' : (mode === 'calories' ? '' : (mode === 'water' ? 'ml' : 'g'));
  const goalValue = mode === 'all' ? null : (goalQ.data ? (mode === 'water' ? (goalQ.data as any).waterMl : (goalQ.data as any)[mode]) : null);
  const goals = goalQ.data as any | undefined;
  const missingAnyGoal = !goals || [goals.calories, goals.protein, goals.carbs, goals.fat, goals.waterMl].some((v: number) => !v || v <= 0);
  const missingSelectedGoal = mode !== 'all' && (!goalValue || (goalValue as number) <= 0);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-emerald-600">Insights</h1>
        <Link to="/goal" className="text-sm font-medium text-emerald-600 hover:text-emerald-700">My Goal</Link>
      </div>

      <p className="text-xs text-gray-500">Visualize your daily trends compared to your goals.</p>

      <div className="flex gap-2 text-sm">
        {[7,14,30].map((d) => (
          <button key={d} onClick={() => setDays(d)} className={`px-3 py-1 rounded border ${days===d ? 'bg-emerald-50 border-emerald-400 text-emerald-700' : 'bg-white border-gray-300 text-gray-700'}`}>{d}d</button>
        ))}
      </div>

      <div className="flex gap-2 text-sm">
        {(['all','calories','protein','carbs','fat'] as Macro[]).map((m) => (
          <button key={m} onClick={() => setMode(m)} className={`px-3 py-1 rounded border ${mode===m ? 'bg-emerald-500 border-emerald-600 text-white' : 'bg-white border-gray-300 text-gray-700'}`}>
            {m === 'all' ? 'All' : m.charAt(0).toUpperCase() + m.slice(1)}
          </button>
        ))}
      </div>

      <div className="w-full max-w-md mx-auto rounded border bg-white shadow-sm">
        <div className="p-3">
          {isLoading && <div className="text-sm">Loading chart...</div>}
          {!isLoading && chartData.length > 0 && (
            <InsightsChart
              data={chartData as any}
              lines={activeLines}
              yUnit={yUnit}
              yMaxCap={mode==='all' ? 150 : undefined}
              showGoal={mode!=='all'}
              goalValue={goalValue ?? null}
            />
          )}
          {!isLoading && chartData.length === 0 && (
            <div className="text-sm text-gray-600">No data available.</div>
          )}
        </div>
        <div className="px-3 pb-3 space-y-1">
          {mode === 'all' ? (
            <div className="text-xs text-gray-600">
              Values shown as % of goal.
            </div>
          ) : (
            <div className="text-xs text-gray-600">
              Values shown in {mode === 'calories' ? 'kcal' : 'grams'}. {goalValue && goalValue > 0 ? 'Dashed line indicates your goal.' : ''}
            </div>
          )}
          {(mode === 'all' && missingAnyGoal) && (
            <div className="text-xs text-amber-600">
              Some goals are missing. <Link to="/goal" className="underline">Edit goal</Link>
            </div>
          )}
          {missingSelectedGoal && (
            <div className="text-xs text-amber-600">
              No goal set for this metric. <Link to="/goal" className="underline">Edit goal</Link>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="px-3 pb-3">
          <div className="flex flex-wrap gap-3 text-xs">
            {activeLines.map((l) => (
              <div key={l.key} className="inline-flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded-sm" style={{ background: l.color }} />
                <span className="text-gray-700">{l.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
