import React from 'react';
import { Link } from 'react-router-dom';
import { MealDto, fetchMealImage } from '../api';

// Displays a single meal entry with thumbnail, time, status, and macros.
export function MealCard({ meal }: { meal: MealDto }) {
  return (
    <Link to={`/meal/${meal.id}`} className="block p-3 rounded bg-white shadow border">
      <div className="flex gap-3">
        <MealThumb meal={meal} />
        <div className="flex-1 flex flex-col justify-between min-h-[5rem]">
          <div className="flex justify-between text-xs text-gray-600">
            <span>{new Date(meal.createdAtUtc).toLocaleTimeString()}</span>
            <span>{meal.status}</span>
          </div>
          {meal.description && meal.status !== 'Error' && (
            <div className="text-xs text-gray-700 mt-0.5 line-clamp-1 truncate" title={meal.description}>{meal.description}</div>
          )}
          {meal.status === 'Ready' && (
            <div className="mt-1 text-xs flex items-end justify-between gap-3">
              <span className="font-semibold text-sm">{meal.calories} kcal</span>
              <div className="flex gap-3">
                <span><span className="text-gray-500">P</span> <span className="font-semibold">{meal.protein}</span></span>
                <span><span className="text-gray-500">C</span> <span className="font-semibold">{meal.carbs}</span></span>
                <span><span className="text-gray-500">F</span> <span className="font-semibold">{meal.fat}</span></span>
              </div>
            </div>
          )}
          {meal.status === 'Processing' && (
            <div className="text-xs text-gray-500 italic mt-1">Analyzing...</div>
          )}
          {meal.status === 'Error' && (
            <div className="text-xs text-red-600 mt-1 truncate" title={meal.errorMessage || undefined}>{meal.errorMessage}</div>
          )}
        </div>
      </div>
    </Link>
  );
}

function MealThumb({ meal }: { meal: MealDto }) {
  const [url, setUrl] = React.useState<string | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    let previous: string | null = null;
    async function load() {
      if (!meal.thumbnailPath) return;
      try {
        const blobUrl = await fetchMealImage(meal.id, true);
        if (cancelled) { URL.revokeObjectURL(blobUrl); return; }
        previous = url;
        setUrl(blobUrl);
        if (previous) URL.revokeObjectURL(previous);
      } catch {}
    }
    load();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [meal.id, meal.thumbnailPath]);
  if (!meal.thumbnailPath) return <div className="w-20 h-20 rounded bg-gray-100 flex items-center justify-center text-[10px] text-gray-400">No photo</div>;
  return (
    <div className="w-20 h-20 rounded bg-gray-100 overflow-hidden flex-shrink-0">
      {url ? (
        <img src={url} alt="thumb" className="object-cover w-full h-full" />
      ) : (
        <div className="w-full h-full animate-pulse bg-gray-200" />
      )}
    </div>
  );
}
