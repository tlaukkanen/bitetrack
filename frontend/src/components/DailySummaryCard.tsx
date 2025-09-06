import React from 'react';
import { Goal } from '../api';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

export interface DailySummaryCardProps {
  heading: string;
  summary: { calories?: number; protein?: number; carbs?: number; fat?: number };
  goal: Goal | undefined;
  loading?: boolean;
  className?: string;
}

export function DailySummaryCard({ heading, summary, goal, loading = false, className = '' }: DailySummaryCardProps) {
  const items: Array<{ label: string; value: number; goal?: number; unit?: string; barClass: string }>= [
    { label: 'Calories', value: Math.round(summary.calories || 0), goal: goal?.calories || undefined, unit: '', barClass: 'bg-gray-800' },
    { label: 'Protein', value: Math.round(summary.protein || 0), goal: goal?.protein || undefined, unit: 'g', barClass: 'bg-emerald-500' },
    { label: 'Carbs', value: Math.round(summary.carbs || 0), goal: goal?.carbs || undefined, unit: 'g', barClass: 'bg-yellow-400' },
    { label: 'Fat', value: Math.round(summary.fat || 0), goal: goal?.fat || undefined, unit: 'g', barClass: 'bg-orange-400' }
  ];
  return (
    <div className={`w-full max-w-md mb-2 shadow-md rounded-lg bg-white border mx-auto ${className}`}>
      <div className="p-4">
        <h2 className="text-lg font-semibold mb-2">{heading}</h2>
        <div className="space-y-4">
          {items.map(it => {
            const pct = it.goal && it.goal > 0 ? Math.min(100, Math.round((it.value / it.goal) * 100)) : 0;
            return (
              <div key={it.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{it.label}</span>
                  <span>
                    {loading ? (
                      <Skeleton width={90} height={14} />
                    ) : (
                      <>
                        {it.value}{it.unit} {it.goal ? `/ ${it.goal}${it.unit}` : ''}
                      </>
                    )}
                  </span>
                </div>
                {loading ? (
                  <Skeleton height={8} borderRadius={8} />
                ) : (
                  <div className="h-2 w-full bg-gray-200 rounded overflow-hidden">
                    <div
                      className={`h-full ${it.barClass}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
