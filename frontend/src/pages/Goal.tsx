import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getGoal, saveGoal, Goal as GoalType } from '../api';

export default function Goal() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['goal'], queryFn: getGoal });
  const [calories, setCalories] = useState<string>('');
  const [protein, setProtein] = useState<string>('');
  const [carbs, setCarbs] = useState<string>('');
  const [fat, setFat] = useState<string>('');
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (data) {
      setCalories((data.calories || 0).toString());
      setProtein((data.protein || 0).toString());
      setCarbs((data.carbs || 0).toString());
      setFat((data.fat || 0).toString());
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: (g: GoalType) => saveGoal(g),
    onSuccess: (saved) => {
      qc.setQueryData(['goal'], saved);
      setMsg('Saved');
      setTimeout(() => setMsg(null), 2000);
    },
    onError: (e: any) => {
      setMsg(e.message || 'Error saving');
    }
  });

  function submit() {
    const goal: GoalType = {
      calories: parseInt(calories) || 0,
      protein: parseFloat(protein) || 0,
      carbs: parseFloat(carbs) || 0,
      fat: parseFloat(fat) || 0
    };
    mutation.mutate(goal);
  }

  useEffect(() => { setMsg(null); }, [calories, protein, carbs, fat]);

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold">My Goal</h1>
      <p className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded p-2">
        Tip: You can leave any value at 0 if you just want to track what you eat without setting a target for that macro.
      </p>
      <div className="space-y-3">
        <label className="block">
          <span className="text-sm font-medium">Daily Calories</span>
          <input type="number" className="w-full border rounded p-2" value={calories} onChange={e=>setCalories(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Protein (g)</span>
          <input type="number" className="w-full border rounded p-2" value={protein} onChange={e=>setProtein(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Carbs (g)</span>
          <input type="number" className="w-full border rounded p-2" value={carbs} onChange={e=>setCarbs(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Fat (g)</span>
          <input type="number" className="w-full border rounded p-2" value={fat} onChange={e=>setFat(e.target.value)} />
        </label>
  <button disabled={mutation.isPending} onClick={submit} className="w-full bg-brand2 text-white rounded py-2 disabled:opacity-50">{mutation.isPending ? 'Saving...' : 'Save Goal'}</button>
        {isLoading && <div className="text-sm">Loading...</div>}
        {msg && <div className="text-sm text-green-600">{msg}</div>}
      </div>
    </div>
  );
}
