import React, { useState } from 'react';
import { login, register, setToken } from '../api';
import { useNavigate } from 'react-router-dom';

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [msg, setMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  async function submit() {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      let token: string;
      if (mode === 'register') {
        // Execute reCAPTCHA v3 for registration
        const recaptchaToken = await (window as any).grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: 'register' });
        token = await register(email, password, displayName || email.split('@')[0], recaptchaToken);
      } else {
        token = await login(email, password);
      }
      setToken(token);
      setMsg('Success');
      navigate('/');
    } catch (e: any) {
      setMsg(e.message || 'Error');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold text-emerald-600">{mode === 'login' ? 'Login' : 'Register'}</h1>
      <div className="space-y-2">
        <input className="w-full border rounded p-2" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)}/>
        {mode==='register' && <input className="w-full border rounded p-2" placeholder="Display name" value={displayName} onChange={e=>setDisplayName(e.target.value)}/>}        
        <input type="password" className="w-full border rounded p-2" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)}/>
        <button onClick={submit} disabled={isSubmitting} className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white rounded py-2">
          {isSubmitting ? 'Processing...' : 'Submit'}
        </button>
  <button onClick={()=>setMode(mode==='login'?'register':'login')} className="w-full text-sm text-emerald-600 hover:text-emerald-700">{mode==='login'?'Create a new account':'Already a member? Log In'}</button>
        {msg && <div className="text-sm">{msg}</div>}
      </div>
    </div>
  );
}
