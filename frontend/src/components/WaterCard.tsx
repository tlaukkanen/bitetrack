import React from 'react';
import { MdWaterDrop } from 'react-icons/md';
import { Link } from 'react-router-dom';
import { WaterEntry } from '../api';

export function WaterCard({ entry }: { entry: WaterEntry }) {
  const t = new Date(entry.createdAtUtc);
  const time = t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return (
    <Link to={`/water/${entry.id}`} className="block p-3 rounded-lg bg-white shadow-sm border">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sky-500">
          <MdWaterDrop size={20} />
          <span className="text-xs text-gray-600">{time}</span>
        </div>
        <div className="text-sm font-semibold text-gray-900">{entry.amountMl} ml</div>
      </div>
    </Link>
  );
}
