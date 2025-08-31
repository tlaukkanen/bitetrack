import React from 'react';

export default function Profile() {
  // Placeholder profile page. Extend with actual user data when available.
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold text-emerald-600">Profile</h1>
      <p className="text-sm text-gray-600">This is a placeholder profile page. User details can be displayed here once the API provides them.</p>
      <div className="text-xs break-all text-gray-500">Token (truncated): {token ? token.slice(0, 32) + (token.length > 32 ? '…' : '') : 'No token stored'}</div>
    </div>
  );
}
