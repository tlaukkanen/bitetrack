import React from 'react';
import { MdWaterDrop } from 'react-icons/md';
import { Link } from 'react-router-dom';
import { WaterEntry } from '../api';

export function WaterCard({ entry }: { entry: WaterEntry }) {
  const t = new Date(entry.createdAtUtc);
  const time = t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return (
    <Link to={`/water/${entry.id}`} className="block p-3 rounded-lg bg-white shadow-sm border">
      <div className="flex gap-3">
        <div className="w-20 h-6 rounded-md bg-sky-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
          <MdWaterDrop className="text-sky-500" size={20} />
        </div>
        <div className="flex-1 min-w-0 flex flex-col justify-between min-h">
          <div className="flex justify-between items-baseline text-xs text-gray-600">
            <span>{time}</span>
            <span className="font-semibold text-sm text-gray-900">{entry.amountMl} ml</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
