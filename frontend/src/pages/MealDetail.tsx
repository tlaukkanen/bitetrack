import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { getMeal, MealDto, fetchMealImage, updateMeal, retryMealAnalysis, deleteMeal, getGoal, rotateMealImage, duplicateMeal } from '../api';
import Spinner from '../components/Spinner';
import toast from 'react-hot-toast';
import { FiTrash2, FiRotateCcw, FiRotateCw } from 'react-icons/fi';
import { MacroCardGroup } from '../components/MacroCard';
import AIDisclaimer from '../components/AIDisclaimer';

export default function MealDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const touchStartRef = useRef<{ x: number; y: number; t: number } | null>(null);

  const mealQuery = useQuery({
    queryKey: ['meal', id],
    queryFn: () => getMeal(id!),
    enabled: !!id
  });

  // Fetch user's macro goals for percentage indicators
  const { data: goal } = useQuery({
    queryKey: ['goal'],
    queryFn: () => getGoal()
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
  const [dtLocalOrig, setDtLocalOrig] = useState('');
  const [rotation, setRotation] = useState(0);
  const [isRotating, setIsRotating] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<'calories' | 'protein' | 'carbs' | 'fat'>(() => {
    try {
      const v = localStorage.getItem('macroSelectedMetric');
      if (v === 'calories' || v === 'protein' || v === 'carbs' || v === 'fat') return v;
    } catch {}
    return 'calories';
  });

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
      setDtLocalOrig(local);
      setRotation(0);
    }
  }, [meal?.id, meal?.status]);

  // Persist selected metric per-session via localStorage
  useEffect(() => {
    try { localStorage.setItem('macroSelectedMetric', selectedMetric); } catch {}
  }, [selectedMetric]);

  useEffect(() => {
    if (!edit) setRotation(0);
  }, [edit]);

  const updateMut = useMutation({
    mutationFn: async () => {
      if (!meal) throw new Error('No meal');
      const payload: any = {
        description: desc.trim() || null,
        calories: cal ? parseInt(cal) : null,
        protein: pro ? parseFloat(pro) : null,
        carbs: carb ? parseFloat(carb) : null,
        fat: fat ? parseFloat(fat) : null
      };
      // Only update createdAtUtc if user changed the datetime
      if (dtLocal && dtLocal !== dtLocalOrig) {
        payload.createdAtUtc = new Date(dtLocal).toISOString();
      }
      return updateMeal(meal.id, payload);
    },
    onSuccess: (updated) => {
      qc.setQueryData(['meal', updated.id], updated);
      qc.invalidateQueries({ queryKey: ['summary'] });
      qc.invalidateQueries({ queryKey: ['meals'] });
      setEdit(false);
      toast.success('Meal updated');
    }
  });

  const retryMut = useMutation({
    mutationFn: async () => {
      if (!meal) throw new Error('No meal');
      return retryMealAnalysis(meal.id);
    },
    onSuccess: (updated) => {
      qc.setQueryData(['meal', updated.id], updated);
      qc.invalidateQueries({ queryKey: ['summary'] });
      qc.invalidateQueries({ queryKey: ['meals'] });
      toast.success('Retry started');
    }
  });

  const deleteMut = useMutation({
    mutationFn: async () => {
      if (!meal) throw new Error('No meal');
      return deleteMeal(meal.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['summary'] });
      qc.invalidateQueries({ queryKey: ['meals'] });
      toast.success('Meal deleted');
      navigate(meal ? toBackPath(meal.createdAtUtc) : '/');
    }
  });

  const duplicateMut = useMutation({
    mutationFn: async () => {
      if (!meal) throw new Error('No meal');
      // Ask backend to duplicate including analysis, set created time to now
      const nowIso = new Date().toISOString();
      const newMeal = await duplicateMeal(meal.id, nowIso);
      return newMeal;
    },
    onSuccess: (newMeal) => {
      qc.setQueryData(['meal', newMeal.id], newMeal);
      qc.invalidateQueries({ queryKey: ['summary'] });
      qc.invalidateQueries({ queryKey: ['meals'] });
      toast.success('Meal duplicated to today');
      navigate(`/meal/${newMeal.id}`);
    },
    onError: () => {
      toast.error('Failed to duplicate meal');
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
      fetchMealImage(meal.id, false, true).then(url => {
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
  const toLocalDatePath = (isoUtc: string) => {
    const d = new Date(isoUtc);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `/meals/${y}-${m}-${day}`;
  };
  const toBackPath = (isoUtc: string) => {
    const d = new Date(isoUtc);
    const now = new Date();
    const sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    return sameDay ? '/' : toLocalDatePath(isoUtc);
  };

  return (
    <div
      className="p-4 space-y-4"
      onTouchStart={(e) => {
        const t = e.touches[0];
        touchStartRef.current = { x: t.clientX, y: t.clientY, t: Date.now() };
      }}
      onTouchEnd={(e) => {
        const start = touchStartRef.current;
        touchStartRef.current = null;
        if (!start) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - start.x;
        const dy = Math.abs(t.clientY - start.y);
        const dt = Date.now() - start.t;
        const isFromLeftEdge = start.x <= 24; // left-edge gesture
        const horizontalEnough = dx > 64; // swipe right threshold
        const verticalSmall = dy < 40;
        const fastEnough = dt < 800; // quick gesture
        if (isFromLeftEdge && horizontalEnough && verticalSmall && fastEnough) {
          const target = meal ? toBackPath(meal.createdAtUtc) : '/';
          navigate(target);
        }
      }}
    >
      {(() => {
        const created = new Date(meal.createdAtUtc);
        const now = new Date();
        const sameDay = created.getFullYear() === now.getFullYear() && created.getMonth() === now.getMonth() && created.getDate() === now.getDate();
        const timeStr = created.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const friendly = sameDay ? `Today, ${timeStr}` : created.toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        return (
          <div className="flex items-baseline justify-between gap-4">
            <h1 className="text-xl font-bold">Meal</h1>
            <div className="flex items-center gap-3">
              <div className="text-xs text-gray-500 whitespace-nowrap">{friendly}</div>
              {meal.status !== 'Processing' && (
                <button
                  type="button"
                  onClick={() => {
                    if (deleteMut.isPending) return;
                    const c = window.confirm('Delete this meal? This cannot be undone.');
                    if (c) deleteMut.mutate();
                  }}
                  className="text-gray-500 hover:text-red-600 focus:outline-none"
                  aria-label="Delete meal"
                  title="Delete meal"
                >
                  <FiTrash2 size={18} />
                </button>
              )}
            </div>
          </div>
        );
      })()}
  {imgSrc && (
        <div className="w-full">
          {edit && (
            <div className="flex justify-end gap-2 mb-2">
              <button
                type="button"
                onClick={async () => {
                  if (isRotating) return;
                  const before = rotation;
                  setRotation(r => (r + 270) % 360);
                  setIsRotating(true);
                  try {
                    if (meal) {
                      const updated = await rotateMealImage(meal.id, 'left', 90);
                      qc.setQueryData(['meal', updated.id], updated);
                      setImageUrl(null);
                      // refetch fresh image
                      const url = await fetchMealImage(updated.id, false, true);
                      setImageUrl(url);
                      setRotation(0); // prevent double-rotation: server image already rotated
                      toast.success('Rotated left');
                    }
                  } catch (e) {
                    setRotation(before);
                    toast.error('Failed to rotate');
                  } finally { setIsRotating(false); }
                }}
                className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-50 flex items-center gap-1"
                disabled={isRotating}
                title="Rotate left 90°"
                aria-label="Rotate left 90 degrees"
              >
                {isRotating ? (<><Spinner size={14} title="Rotating" /><span>Rotating…</span></>) : (<><FiRotateCcw /><span>Left</span></>)}
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (isRotating) return;
                  const before = rotation;
                  setRotation(r => (r + 90) % 360);
                  setIsRotating(true);
                  try {
                    if (meal) {
                      const updated = await rotateMealImage(meal.id, 'right', 90);
                      qc.setQueryData(['meal', updated.id], updated);
                      setImageUrl(null);
                      const url = await fetchMealImage(updated.id, false, true);
                      setImageUrl(url);
                      setRotation(0);
                      toast.success('Rotated right');
                    }
                  } catch (e) {
                    setRotation(before);
                    toast.error('Failed to rotate');
                  } finally { setIsRotating(false); }
                }}
                className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-50 flex items-center gap-1"
                disabled={isRotating}
                title="Rotate right 90°"
                aria-label="Rotate right 90 degrees"
              >
                {isRotating ? (<><Spinner size={14} title="Rotating" /><span>Rotating…</span></>) : (<><FiRotateCw /><span>Right</span></>)}
              </button>
            </div>
          )}
          <img
            src={imgSrc}
            alt="Meal"
            className="block w-full max-h-[60vh] object-contain rounded"
            style={{ transform: `rotate(${rotation}deg)`, transformOrigin: 'center' }}
          />
        </div>
      )}
      
      <div className="text-sm text-gray-600 flex justify-between items-center">{meal.status !== 'Ready' && (<>Status: {meal.status}</>)}
        {meal.status !== 'Processing' && (
          <button onClick={()=>setEdit(e=>!e)} className="text-xs text-emerald-600 underline ml-2">{edit ? 'Cancel' : 'Edit'}</button>
        )}
      </div>
      
      {meal.status === 'Processing' && (
        <div className="text-xs text-gray-500 flex items-center gap-2">
          <Spinner size={14} title="Analyzing" />
          <span>Analyzing...</span>
        </div>
      )}
      {deleteMut.isError && (
        <div className="text-xs text-red-600">Error deleting meal</div>
      )}
      {meal.errorMessage && (
        <div className="text-sm text-red-600 flex items-center gap-2">
          <span>Error: {meal.errorMessage}</span>
          <button
            onClick={() => retryMut.mutate()}
            disabled={retryMut.isPending}
            className="text-xs bg-red-600 text-white px-2 py-0.5 rounded disabled:opacity-50 inline-flex items-center gap-1">
            {retryMut.isPending && <Spinner size={12} title="Retrying" />}
            <span>{retryMut.isPending ? 'Retrying…' : 'Retry analysis'}</span>
          </button>
        </div>
      )}
  {!edit && meal.description && <div className="text-sm">{meal.description}</div>}
  {/* Subtle AI disclaimer below description/status */}
  <AIDisclaimer className="mt-2" />
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
            <button
              disabled={updateMut.isPending}
              onClick={()=>updateMut.mutate()}
              className="inline-flex items-center gap-2 bg-emerald-600 text-white rounded px-3 py-1 text-sm disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1"
            >
              {updateMut.isPending && <Spinner size={14} title="Saving" />}
              <span>{updateMut.isPending ? 'Saving…' : 'Save Changes'}</span>
            </button>
          {updateMut.isError && <div className="text-xs text-red-600">Error updating meal</div>}
        </div>
      )}
      <div>
        <MacroCardGroup
          calories={meal.calories}
          protein={meal.protein}
          carbs={meal.carbs}
          fat={meal.fat}
          caloriesGoal={goal?.calories ?? null}
          proteinGoal={goal?.protein ?? null}
          carbsGoal={goal?.carbs ?? null}
          fatGoal={goal?.fat ?? null}
          selected={selectedMetric}
          onSelect={(m) => setSelectedMetric(m)}
        />
      </div>
      {meal.items.length > 0 && (
        <div className="space-y-1">
          {meal.items.map(i => {
            const formatValue = () => {
              switch (selectedMetric) {
                case 'calories':
                  return i.calories != null ? `${Math.round(i.calories)} kcal` : '';
                case 'protein':
                  return i.protein != null ? `${Math.round(i.protein)} g` : '';
                case 'carbs':
                  return i.carbs != null ? `${Math.round(i.carbs)} g` : '';
                case 'fat':
                  return i.fat != null ? `${Math.round(i.fat)} g` : '';
                default:
                  return '';
              }
            };
            return (
              <div key={i.id} className="flex justify-between text-sm">
                <span>{i.name}</span>
                <span>{formatValue()}</span>
              </div>
            );
          })}
        </div>
      )}
      <div className="text-sm font-medium">
        {selectedMetric === 'calories' && (
          <>Total: {meal.calories != null ? Math.round(meal.calories) + ' kcal' : '?'}</>
        )}
        {selectedMetric === 'protein' && (
          <>Protein: {meal.protein != null ? Math.round(meal.protein) + ' g' : '?'}</>
        )}
        {selectedMetric === 'carbs' && (
          <>Carbs: {meal.carbs != null ? Math.round(meal.carbs) + ' g' : '?'}</>
        )}
        {selectedMetric === 'fat' && (
          <>Fat: {meal.fat != null ? Math.round(meal.fat) + ' g' : '?'}</>
        )}
      </div>
      <div className="mt-3 flex flex-col sm:flex-row gap-3">
        <button
          type="button"
          onClick={() => navigate(meal ? toBackPath(meal.createdAtUtc) : '/')}
          className="inline-flex items-center justify-center px-5 py-2.5 rounded-md bg-emerald-600 text-white font-semibold shadow-sm border border-emerald-700 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 active:scale-[0.99] transition"
          aria-label="Back"
        >
          Back
        </button>
        <button
          type="button"
          onClick={() => duplicateMut.mutate()}
          disabled={duplicateMut.isPending}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-md bg-white text-emerald-700 font-semibold shadow-sm border border-emerald-200 hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-200 active:scale-[0.99] transition disabled:opacity-60"
          aria-label="Duplicate meal to today"
          title="Duplicate meal to today"
        >
          {duplicateMut.isPending && <Spinner size={16} title="Duplicating" />}
          <span>{duplicateMut.isPending ? 'Duplicating…' : 'Duplicate to Today'}</span>
        </button>
      </div>
    </div>
  );
}
