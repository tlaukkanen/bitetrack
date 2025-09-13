import React, { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { uploadMeal, MealDto } from '../api';
import { useNavigate } from 'react-router-dom';
import Spinner from '../components/Spinner';
import AIDisclaimer from '../components/AIDisclaimer';

export default function AddMeal() {
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState<string>('');
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const [createdAtLocal, setCreatedAtLocal] = useState<string>(() => {
    // default to current local datetime truncated to minutes for datetime-local input
    const now = new Date();
    now.setSeconds(0, 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  });
  const qc = useQueryClient();
  const navigate = useNavigate();
  const mutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('No file');
      let created: Date | undefined = undefined;
      if (createdAtLocal) {
        created = new Date(createdAtLocal);
      }
      return await uploadMeal(file, created, description);
    },
    onSuccess: (meal: MealDto) => {
      qc.invalidateQueries({ queryKey: ['meals'] });
      qc.invalidateQueries({ queryKey: ['summary'] });
      setFile(null);
      navigate(`/meal/${meal.id}`);
    }
  });

  const busy = mutation.isPending;

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold text-emerald-600">Add Meal</h1>
      <div className="space-y-2">
        <label className="block text-sm font-medium">Photo</label>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={mutation.isPending}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-md bg-emerald-600 text-white font-semibold shadow-sm border border-emerald-700 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 active:scale-[0.99] transition disabled:opacity-60 w-full sm:w-auto"
            aria-label="Take a photo with camera"
            title="Take Photo"
          >
            Take Photo
          </button>
          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            disabled={mutation.isPending}
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-md bg-white text-emerald-700 font-semibold shadow-sm border border-emerald-200 hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-200 active:scale-[0.99] transition disabled:opacity-60 w-full sm:w-auto"
            aria-label="Choose a photo from library"
            title="Choose from Photos"
          >
            Choose from Photos
          </button>
        </div>
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={e => setFile(e.target.files?.[0] || null)}
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => setFile(e.target.files?.[0] || null)}
        />
        {file && (
          <div className="text-xs text-gray-600">Selected: {file.name}</div>
        )}
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-medium" htmlFor="meal-dt">Meal Date & Time</label>
        <input id="meal-dt" type="datetime-local" value={createdAtLocal} onChange={e => setCreatedAtLocal(e.target.value)} className="w-full border rounded px-2 py-1 text-sm" />
  <p className="text-xs text-gray-500">Adjust if logging a past meal.</p>
      </div>
      <div className="space-y-1">
        <label className="block text-sm font-medium" htmlFor="meal-desc">Description (optional)</label>
        <textarea id="meal-desc" rows={2} value={description} onChange={e=>setDescription(e.target.value)} className="w-full border rounded px-2 py-1 text-sm" placeholder="e.g. Chicken salad with avocado" />
        <p className="text-xs text-gray-500">Tip #1: If you leave this blank, the AI will generate a short description from the photo.</p>
        <p className="text-xs text-gray-500">Tip #2: If you enter a brief description, it can improve AI analysis accuracy.</p>
      </div>
  <button
        disabled={!file || busy}
        onClick={() => mutation.mutate()}
        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-md bg-emerald-600 text-white font-semibold shadow-sm border border-emerald-700 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 active:scale-[0.99] transition disabled:opacity-60 w-full sm:w-auto"
      >
        Upload
      </button>
      {busy && (
        <div className="flex items-center gap-2 text-sm text-emerald-700">
          <Spinner size={16} title="Uploading & processing" />
          <span>Uploading & processing...</span>
        </div>
      )}
      {mutation.isError && <div className="text-sm text-red-600">Error: {(mutation.error as any).message}</div>}
      <AIDisclaimer className="pt-2 border-t mt-4" />
    </div>
  );
}
