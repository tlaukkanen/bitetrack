import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMeal, MealDto, fetchMealImage, updateMeal } from '../api';
import { MacroCardGroup } from '../components/MacroCard';

export default function MealDetail() {
  const { id } = useParams<{ id: string }>();

  const mealQuery = useQuery({
    queryKey: ['meal', id],
    queryFn: () => getMeal(id!),
    enabled: !!id
  });

  const meal = mealQuery.data as MealDto | undefined;
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const qc = useQueryClient();
  const [edit, setEdit] = useState(false);
  const [desc, setDesc] = useState('');
  const [cal, setCal] = useState('');
  const [pro, setPro] = useState('');
  const [carb, setCarb] = useState('');
  const [fat, setFat] = useState('');
  const [dtLocal, setDtLocal] = useState('');

  useEffect(() => {
    if (meal) {
      setDesc(meal.description || '');
      setCal(meal.calories != null ? meal.calories.toString() : '');
      setPro(meal.protein != null ? meal.protein.toString() : '');
      setCarb(meal.carbs != null ? meal.carbs.toString() : '');
      setFat(meal.fat != null ? meal.fat.toString() : '');
      // Convert meal.createdAtUtc (UTC) to local datetime-local string
      const d = new Date(meal.createdAtUtc);
      const pad = (n: number) => String(n).padStart(2,'0');
      const local = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      setDtLocal(local);
    }
  }, [meal?.id, meal?.status]);

  const updateMut = useMutation({
    mutationFn: async () => {
      if (!meal) throw new Error('No meal');
      return updateMeal(meal.id, {
        description: desc.trim() || null,
        calories: cal ? parseInt(cal) : null,
        protein: pro ? parseFloat(pro) : null,
        carbs: carb ? parseFloat(carb) : null,
        fat: fat ? parseFloat(fat) : null
        , createdAtUtc: dtLocal ? new Date(dtLocal).toISOString() : null
      });
    },
    onSuccess: (updated) => {
      qc.setQueryData(['meal', updated.id], updated);
      qc.invalidateQueries({ queryKey: ['summary'] });
      qc.invalidateQueries({ queryKey: ['meals'] });
      setEdit(false);
    }
  });

  useEffect(() => {
    if (!id) return;
    if (meal && meal.status !== 'Processing') return; // stop polling when terminal
    const handle = setInterval(() => {
      mealQuery.refetch();
    }, 2000);
    return () => clearInterval(handle);
  }, [id, meal?.status]);

  useEffect(() => {
    let revoked: string | null = null;
    if (meal && meal.status !== 'Processing') {
      fetchMealImage(meal.id).then(url => {
        setImageUrl(prev => {
          if (prev) URL.revokeObjectURL(prev);
          revoked = url;
          return url;
        });
      }).catch(() => {});
    }
    return () => {
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [meal?.id, meal?.status]);

  if (mealQuery.isPending) return <div className="p-4">Loading meal...</div>;
  if (mealQuery.isError) return <div className="p-4 text-red-600">Error: {(mealQuery.error as Error).message}</div>;
  if (!meal) return <div className="p-4">Meal not found.</div>;

  const imgSrc = imageUrl || '';

  return (
    <div className="p-4 space-y-4">
      {(() => {
        const created = new Date(meal.createdAtUtc);
        const now = new Date();
        const sameDay = created.getFullYear() === now.getFullYear() && created.getMonth() === now.getMonth() && created.getDate() === now.getDate();
        const timeStr = created.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const friendly = sameDay ? `Today, ${timeStr}` : created.toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        return (
          <div className="flex items-baseline justify-between gap-4">
            <h1 className="text-xl font-bold">Meal</h1>
            <div className="text-xs text-gray-500 whitespace-nowrap">{friendly}</div>
          </div>
        );
      })()}
  {imgSrc && <img src={imgSrc} alt="Meal" className="w-full rounded" />}
      <div className="text-sm text-gray-600 flex justify-between items-center">Status: {meal.status}
        {meal.status !== 'Processing' && (
          <button onClick={()=>setEdit(e=>!e)} className="text-xs text-brand2 underline ml-2">{edit ? 'Cancel' : 'Edit'}</button>
        )}
      </div>
      {meal.status === 'Processing' && <div className="text-xs text-gray-500 animate-pulse">Analyzing...</div>}
      {meal.errorMessage && <div className="text-sm text-red-600">Error: {meal.errorMessage}</div>}
      {!edit && meal.description && <div className="text-sm">{meal.description}</div>}
      {edit && (
        <div className="space-y-2 border rounded p-3 bg-gray-50">
          <div>
            <label className="block text-xs font-medium">Description</label>
            <textarea className="w-full border rounded px-2 py-1 text-sm" rows={2} value={desc} onChange={e=>setDesc(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium" htmlFor="meal-edit-dt">Meal Date & Time</label>
            <input id="meal-edit-dt" type="datetime-local" value={dtLocal} onChange={e=>setDtLocal(e.target.value)} className="border rounded px-2 py-1 w-full text-xs" />
            <p className="text-[10px] text-gray-500">Adjust if this meal occurred earlier or later.</p>
          </div>
          <div className="grid grid-cols-4 gap-2 text-xs">
            <div><label className="block">kcal</label><input type="number" className="w-full border rounded px-1 py-0.5" value={cal} onChange={e=>setCal(e.target.value)} /></div>
            <div><label className="block">P</label><input type="number" className="w-full border rounded px-1 py-0.5" value={pro} onChange={e=>setPro(e.target.value)} /></div>
            <div><label className="block">C</label><input type="number" className="w-full border rounded px-1 py-0.5" value={carb} onChange={e=>setCarb(e.target.value)} /></div>
            <div><label className="block">F</label><input type="number" className="w-full border rounded px-1 py-0.5" value={fat} onChange={e=>setFat(e.target.value)} /></div>
          </div>
          <button disabled={updateMut.isPending} onClick={()=>updateMut.mutate()} className="bg-brand2 text-white rounded px-3 py-1 text-sm disabled:opacity-50">{updateMut.isPending ? 'Saving...' : 'Save Changes'}</button>
          {updateMut.isError && <div className="text-xs text-red-600">Error updating meal</div>}
        </div>
      )}
      <div>
        <MacroCardGroup calories={meal.calories} protein={meal.protein} carbs={meal.carbs} fat={meal.fat} />
      </div>
      {meal.items.length > 0 && (
        <div className="space-y-1">
          {meal.items.map(i => (
            <div key={i.id} className="flex justify-between text-sm">
              <span>{i.name}</span>
              <span>{i.calories ? Math.round(i.calories) + ' kcal' : ''}</span>
            </div>
          ))}
        </div>
      )}
      <div className="text-sm font-medium">Total: {meal.calories ? Math.round(meal.calories) + ' kcal' : '?'}</div>
      <Link to="/" className="text-brand2 text-sm underline">Back</Link>
    </div>
  );
}
