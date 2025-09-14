import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deleteWater, getWaterEntry, updateWater, WaterEntry } from '../api';
import { MdWaterDrop } from 'react-icons/md';

export default function WaterDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['water', id], queryFn: () => getWaterEntry(id!), enabled: !!id });

  const entry = q.data as WaterEntry | undefined;
  const [amount, setAmount] = useState<string>('');
  const [dtLocal, setDtLocal] = useState<string>('');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!entry) return;
    setAmount(String(entry.amountMl));
    const d = new Date(entry.createdAtUtc);
    const pad = (n: number) => String(n).padStart(2, '0');
    const local = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    setDtLocal(local);
    setDirty(false);
  }, [entry?.id]);

  const updateMut = useMutation({
    mutationFn: async () => {
      if (!entry) throw new Error('No entry');
      const req: any = {};
      const ml = parseInt(amount, 10);
      if (ml > 0 && ml !== entry.amountMl) req.amountMl = ml;
      if (dtLocal) {
        const iso = new Date(dtLocal).toISOString();
        if (iso !== entry.createdAtUtc) req.createdAtUtc = iso;
      }
      if (Object.keys(req).length === 0) return entry; // nothing changed
      const updated = await updateWater(entry.id, req);
      return updated;
    },
    onSuccess: (updated) => {
      qc.setQueryData(['water', updated.id], updated);
      qc.invalidateQueries({ queryKey: ['summary'] });
      qc.invalidateQueries({ queryKey: ['water'] });
      goBack(updated.createdAtUtc);
    }
  });

  const deleteMut = useMutation({
    mutationFn: async () => {
      if (!entry) throw new Error('No entry');
      await deleteWater(entry.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['summary'] });
      qc.invalidateQueries({ queryKey: ['water'] });
      goBack(entry!.createdAtUtc);
    }
  });

  function goBack(iso: string) {
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    navigate(sameDay ? '/' : `/meals/${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }

  if (q.isPending) return <div className="p-4">Loading…</div>;
  if (q.isError) return <div className="p-4 text-red-600">Error</div>;
  if (!entry) return <div className="p-4">Not found</div>;

  const btnLabel = dirty ? 'Save & Back' : 'Back';

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2"><MdWaterDrop className="text-sky-500" /> Water</h1>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (deleteMut.isPending) return;
              const c = window.confirm('Delete this water entry?');
              if (c) deleteMut.mutate();
            }}
            className="text-xs text-red-600 underline disabled:opacity-50"
            disabled={deleteMut.isPending}
          >
            Delete
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <label className="block text-sm font-medium">Amount (ml)</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => { setAmount(e.target.value); setDirty(true); }}
          className="w-full border rounded px-2 py-1"
        />

        <label className="block text-sm font-medium">Date & Time</label>
        <input
          type="datetime-local"
          value={dtLocal}
          onChange={(e) => { setDtLocal(e.target.value); setDirty(true); }}
          className="w-full border rounded px-2 py-1"
        />
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => { dirty ? updateMut.mutate() : goBack(entry.createdAtUtc); }}
          disabled={updateMut.isPending}
          className={`inline-flex items-center justify-center px-5 py-2.5 rounded-md font-semibold shadow-sm border ${dirty ? 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700' : 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50'}`}
        >
          {btnLabel}
        </button>
        {dirty && (
          <button
            type="button"
            onClick={() => { setDirty(false); if (entry) { setAmount(String(entry.amountMl)); const d = new Date(entry.createdAtUtc); const pad=(n:number)=>String(n).padStart(2,'0'); setDtLocal(`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);} }}
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-md bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
