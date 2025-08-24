import React, { useState } from 'react';
import { login, register, setToken } from '../api';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [msg, setMsg] = useState<string | null>(null);
  const navigate = useNavigate();

  async function submit() {
    try {
      const token = mode === 'login' ? await login(email, password) : await register(email, password, displayName || email.split('@')[0]);
      setToken(token);
      setMsg('Success');
      navigate('/');
    } catch (e: any) {
      setMsg(e.message || 'Error');
    }
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold">{mode === 'login' ? 'Login' : 'Register'}</h1>
      <div className="space-y-2">
        <input className="w-full border rounded p-2" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)}/>
        {mode==='register' && <input className="w-full border rounded p-2" placeholder="Display name" value={displayName} onChange={e=>setDisplayName(e.target.value)}/>}        
        <input type="password" className="w-full border rounded p-2" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)}/>
        <button onClick={submit} className="w-full bg-brand2 text-white rounded py-2">Submit</button>
        <button onClick={()=>setMode(mode==='login'?'register':'login')} className="w-full text-sm text-brand2">Switch to {mode==='login'?'register':'login'}</button>
        {msg && <div className="text-sm">{msg}</div>}
      </div>
    </div>
  );
}
