import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSettings, saveSettings } from '../api';

export default function Profile() {
  const qc = useQueryClient();
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: getSettings });
  const [defaultGlassMl, setDefaultGlassMl] = useState<string>('');
  useEffect(() => {
    if (settings) setDefaultGlassMl((settings.defaultGlassMl ?? 0).toString());
  }, [settings]);
  const save = useMutation({
    mutationFn: async () => saveSettings({ defaultGlassMl: parseInt(defaultGlassMl) || undefined }),
    onSuccess: (s) => qc.setQueryData(['settings'], s)
  });
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold text-emerald-600">Profile</h1>
      <div className="space-y-3">
        <label className="block">
          <span className="text-sm font-medium">Default Glass Size (ml)</span>
          <input type="number" className="w-full border rounded p-2" value={defaultGlassMl} onChange={e=>setDefaultGlassMl(e.target.value)} />
        </label>
        <button onClick={() => save.mutate()} disabled={save.isPending} className="w-full bg-emerald-500 text-white rounded py-2 disabled:opacity-50">{save.isPending ? 'Saving...' : 'Save Settings'}</button>
      </div>
      <div className="text-xs break-all text-gray-500">Token (truncated): {token ? token.slice(0, 32) + (token.length > 32 ? '…' : '') : 'No token stored'}</div>
    </div>
  );
}
