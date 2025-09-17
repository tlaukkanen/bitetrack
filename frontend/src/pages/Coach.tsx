import React, { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import { getSuggestions, SuggestionGoalKey, SuggestionTimeframeKey } from '../api';
import Spinner from '../components/Spinner';
import AIDisclaimer from '../components/AIDisclaimer';

export default function Coach() {
  const [selectedGoal, setSelectedGoal] = useState<SuggestionGoalKey | null>(() => {
    const v = (() => { try { return localStorage.getItem('coachGoal'); } catch { return null; } })();
    const allowed: SuggestionGoalKey[] = ['mild_weight_loss','weight_loss','maintain','eat_healthier','energy','nutrient_balance','heart_health','blood_sugar','anti_inflammation','reduce_processed','more_plant_based'];
    return (v && (allowed as string[]).includes(v)) ? (v as SuggestionGoalKey) : null;
  });
  const [storedSuggestion, setStoredSuggestion] = useState<string | null>(() => {
    try {
      const g = localStorage.getItem('coachGoal');
      if (g) {
        return localStorage.getItem(`coachSuggestion:${g}`) || null;
      }
    } catch {}
    return null;
  });
  const [timeframe, setTimeframe] = useState<SuggestionTimeframeKey>(() => {
    try {
      const v = localStorage.getItem('coachTimeframe') as SuggestionTimeframeKey | null;
      const allowed: SuggestionTimeframeKey[] = ['last_7_days','last_3_days','yesterday','today'];
      return (v && (allowed as string[]).includes(v)) ? v : 'last_7_days';
    } catch {
      return 'last_7_days';
    }
  });

  useEffect(() => { try { if (selectedGoal) localStorage.setItem('coachGoal', selectedGoal); } catch {} }, [selectedGoal]);
  useEffect(() => { try { if (timeframe) localStorage.setItem('coachTimeframe', timeframe); } catch {} }, [timeframe]);
  useEffect(() => {
    try {
      if (selectedGoal) {
        const v = localStorage.getItem(`coachSuggestion:${selectedGoal}`);
        setStoredSuggestion(v || null);
      } else {
        setStoredSuggestion(null);
      }
    } catch {}
  }, [selectedGoal]);

  const suggestMutation = useMutation({
    mutationKey: ['suggestions'],
    mutationFn: async (vars: { goal: SuggestionGoalKey; timeframe: SuggestionTimeframeKey }) => getSuggestions(vars.goal, vars.timeframe),
    onSuccess: (res, vars) => {
      try {
        const goal = vars.goal;
        if (goal && res && (res as any).content) {
          localStorage.setItem(`coachSuggestion:${goal}`,(res as any).content);
          setStoredSuggestion((res as any).content);
        }
      } catch {}
    }
  });

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold text-emerald-600">Coach</h1>

      <div className="w-full max-w-md mx-auto rounded border bg-white shadow-sm">
        <div className="p-3 space-y-3">
          <div>
            <div className="text-sm font-medium text-gray-800">Personalized suggestions</div>
            <p className="text-xs text-gray-500">Get ideas tailored to your meal history. First, choose timeframe:</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { k: 'last_7_days', t: 'Last 7 days' },
              { k: 'last_3_days', t: 'Last 3 days' },
              { k: 'yesterday', t: 'Yesterday' },
              { k: 'today', t: 'Today only' },
            ].map((opt) => (
              <button
                key={opt.k}
                onClick={() => setTimeframe(opt.k as SuggestionTimeframeKey)}
                className={`text-left px-3 py-2 rounded border text-sm ${timeframe===opt.k ? 'bg-emerald-50 border-emerald-400 text-emerald-700' : 'bg-white border-gray-300 text-gray-700'}`}
              >
                {opt.t}
              </button>
            ))}
          </div>

          <div>
            <div className="text-sm font-medium text-gray-800">Then pick your focus</div>
            <p className="text-xs text-gray-500">We’ll generate suggestions based on your meals in the selected timeframe.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              { k: 'mild_weight_loss', t: 'Gentle weight loss (~0.25 kg/wk)' },
              { k: 'weight_loss', t: 'Weight loss (~0.5 kg/wk)' },
              { k: 'maintain', t: 'Maintain current weight' },
              { k: 'eat_healthier', t: 'Eat healthier overall' },
              { k: 'energy', t: 'Boost daily energy' },
              { k: 'nutrient_balance', t: 'Improve nutrient balance' },
              { k: 'heart_health', t: 'Support heart health' },
              { k: 'blood_sugar', t: 'Manage blood sugar' },
              { k: 'anti_inflammation', t: 'Reduce inflammation' },
              { k: 'reduce_processed', t: 'Reduce processed foods' },
              { k: 'more_plant_based', t: 'More plant-based meals' },
              { k: 'gain_muscle', t: 'Gain muscle mass' },
            ].map((opt) => (
              <button
                key={opt.k}
                onClick={() => { setSelectedGoal(opt.k as SuggestionGoalKey); suggestMutation.mutate({ goal: opt.k as SuggestionGoalKey, timeframe }); }}
                className={`text-left px-3 py-2 rounded border text-sm ${selectedGoal===opt.k ? 'bg-emerald-50 border-emerald-400 text-emerald-700' : 'bg-white border-gray-300 text-gray-700'}`}
              >
                {opt.t}
              </button>
            ))}
          </div>

          <div className="border-t pt-3">
            {suggestMutation.isPending && (
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <Spinner size={16} />
                <span>Generating suggestions…</span>
              </div>
            )}
            {suggestMutation.isError && (
              <div className="text-sm text-red-600">Could not generate suggestions. Please try again.</div>
            )}
            {(suggestMutation.data || storedSuggestion) && !suggestMutation.isPending && !suggestMutation.isError && (
              <div className="md-content">
                <ReactMarkdown>{suggestMutation.data?.content ?? storedSuggestion ?? ''}</ReactMarkdown>
              </div>
            )}
            {!suggestMutation.isPending && !suggestMutation.data && !storedSuggestion && (
              <div className="text-xs text-gray-500">Pick a focus to generate suggestions.</div>
            )}

            <AIDisclaimer className="mt-3" />
          </div>
        </div>
      </div>
    </div>
  );
}
