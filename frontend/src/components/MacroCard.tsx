import React from 'react';

interface MacroCardProps {
  label: string;
  value: number | undefined | null;
  goal?: number | undefined | null;
  className?: string;
  unit?: string; // e.g., 'g' or ''
  onClick?: () => void;
  active?: boolean;
}

export function MacroCard({ label, value, goal, className = '', unit = '', onClick, active = false }: MacroCardProps) {
  const hasGoal = !!goal && goal > 0;
  const pct = hasGoal && value != null ? Math.min(100, Math.round((value / (goal as number)) * 100)) : null;
  const over = hasGoal && value != null && value > (goal as number);
  // Ring metrics
  const r = 16; // radius
  const circumference = 2 * Math.PI * r;
  const ringProgress = pct != null ? (pct / 100) * circumference : 0;
  return (
    <div
      className={`bg-white rounded p-2 shadow-md text-center flex flex-col items-stretch ${onClick ? 'cursor-pointer' : ''} ${active ? 'ring-2 ring-emerald-500' : ''} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      aria-pressed={onClick ? (active ? 'true' : 'false') : undefined}
    > 
      <div className="text-[10px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`font-semibold text-sm ${over ? 'text-red-600' : ''} sm:mb-1`}>{value != null ? Math.round(value) : '-'}{unit}</div>
      {hasGoal && (
        <>
          {/* Ring on small screens */}
          <div className="mx-auto my-1 block sm:hidden" aria-hidden="false">
            <svg width={48} height={48} className="mx-auto">
              <circle
                cx={24}
                cy={24}
                r={r}
                stroke="#e5e7eb"
                strokeWidth={4}
                fill="none"
              />
              <circle
                cx={24}
                cy={24}
                r={r}
                stroke={over ? '#dc2626' : (label === 'Protein' ? '#10b981' : label === 'Carbs' ? '#facc15' : label === 'Fat' ? '#fb923c' : '#10b981')}
                strokeWidth={4}
                fill="none"
                strokeDasharray={`${ringProgress} ${circumference - ringProgress}`}
                strokeDashoffset={circumference * 0.25}
                strokeLinecap="round"
                className="transition-all duration-300"
              />
              <text
                x="50%"
                y="50%"
                dominantBaseline="middle"
                textAnchor="middle"
                fontSize="9"
                className="fill-gray-600"
              >{pct}%</text>
            </svg>
          </div>
          {/* Bar on >= small screens */}
          <div className="mt-1 space-y-0.5 hidden sm:block">
            <div className="h-2 w-full bg-gray-200 rounded overflow-hidden">
              <div
                className={`h-full ${over ? 'bg-red-500' : label === 'Protein' ? 'bg-emerald-500' : label === 'Carbs' ? 'bg-yellow-400' : label === 'Fat' ? 'bg-orange-400' : 'bg-emerald-500'} transition-all`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="text-[10px] text-gray-500">{Math.round(value || 0)} / {Math.round(goal || 0)}{unit}{over && ' +'}</div>
          </div>
        </>
      )}
      {!hasGoal && <div className="text-[10px] text-gray-400 mt-1">no goal</div>}
    </div>
  );
}

interface MacroCardGroupProps {
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
  caloriesGoal?: number | null;
  proteinGoal?: number | null;
  carbsGoal?: number | null;
  fatGoal?: number | null;
  selected?: 'calories' | 'protein' | 'carbs' | 'fat';
  onSelect?: (metric: 'calories' | 'protein' | 'carbs' | 'fat') => void;
}

export function MacroCardGroup({ calories, protein, carbs, fat, caloriesGoal, proteinGoal, carbsGoal, fatGoal, selected, onSelect }: MacroCardGroupProps) {
  return (
    <div className="grid grid-cols-4 gap-2">
      <MacroCard label="kcal" value={calories} goal={caloriesGoal} active={selected === 'calories'} onClick={onSelect ? () => onSelect('calories') : undefined} />
      <MacroCard label="Protein" value={protein} goal={proteinGoal} unit="g" active={selected === 'protein'} onClick={onSelect ? () => onSelect('protein') : undefined} />
      <MacroCard label="Carbs" value={carbs} goal={carbsGoal} unit="g" active={selected === 'carbs'} onClick={onSelect ? () => onSelect('carbs') : undefined} />
      <MacroCard label="Fat" value={fat} goal={fatGoal} unit="g" active={selected === 'fat'} onClick={onSelect ? () => onSelect('fat') : undefined} />
    </div>
  );
}
