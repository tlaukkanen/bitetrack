import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addWater, getSettings } from '../api';

function useQueryParams() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function AddWater() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const params = useQueryParams();
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: getSettings });

  const [createdAtLocal, setCreatedAtLocal] = useState(() => {
    const d = new Date(); d.setSeconds(0,0);
    const pad = (n:number)=>String(n).padStart(2,'0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });

  const quickMl = [200, 250, 300, 330, 400, 500];
  const [customMl, setCustomMl] = useState<number>(250);

  useEffect(() => {
    if (settings?.defaultGlassMl) setCustomMl(settings.defaultGlassMl);
  }, [settings?.defaultGlassMl]);

  const mut = useMutation({
    mutationFn: async (ml: number) => addWater(ml, createdAtLocal ? new Date(createdAtLocal) : undefined, 'ml'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['summary'] });
      qc.invalidateQueries({ queryKey: ['water'] });
      navigate('/');
    }
  });

  // Quick add via PWA shortcut: /water?quick=1
  useEffect(() => {
    const quick = params.get('quick');
    const ml = settings?.defaultGlassMl;
    if (quick === '1' && ml && ml > 0 && !mut.isPending) {
      mut.mutate(ml);
    }
  }, [params, settings?.defaultGlassMl]);

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold text-emerald-600">Add Water</h1>
      <div className="space-y-2">
        <label className="block text-sm font-medium" htmlFor="dt">Date & Time</label>
        <input id="dt" type="datetime-local" value={createdAtLocal} onChange={e => setCreatedAtLocal(e.target.value)} className="w-full border rounded px-2 py-1 text-sm" />
      </div>
      <div className="space-y-2">
        <div className="text-sm font-medium">Quick amounts (ml)</div>
        <div className="grid grid-cols-3 gap-2">
          {quickMl.map(ml => (
            <button
              key={ml}
              onClick={() => mut.mutate(ml)}
              disabled={mut.isPending}
              className="px-3 py-2 rounded bg-emerald-600 text-white border border-emerald-700 hover:bg-emerald-700 disabled:opacity-50"
            >
              {ml} ml
            </button>
          ))}
          {settings?.defaultGlassMl ? (
            <button onClick={() => mut.mutate(settings.defaultGlassMl!)} disabled={mut.isPending}
              className="col-span-3 px-3 py-2 rounded border bg-emerald-600 text-white">
              Default glass ({settings.defaultGlassMl} ml)
            </button>
          ) : null}
        </div>
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-medium">Custom (ml)</label>
        <div className="flex gap-2">
          <input type="number" value={customMl} onChange={e => setCustomMl(parseInt(e.target.value || '0', 10))}
            className="w-full border rounded px-2 py-1 text-sm" />
          <button onClick={() => customMl > 0 && mut.mutate(customMl)} disabled={mut.isPending || customMl <= 0}
            className="px-4 py-2 rounded bg-emerald-600 text-white border border-emerald-700">
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
