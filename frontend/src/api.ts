import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({ baseURL: '/api' });

export const AUTH_EXPIRED_EVENT = 'authExpired';
let isRefreshing = false;
let refreshWaiters: Array<(token: string | null) => void> = [];
let authExpiryNotified = false;

function notifyAuthExpiredOnce() {
  if (authExpiryNotified) return;
  authExpiryNotified = true;
  try { toast.error('Session expired. Please sign in again.', { id: 'session-expired' }); } catch {}
  try {
    const path = window.location.pathname + window.location.search + window.location.hash;
    window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT, { detail: { path } }));
  } catch {}
}

async function requestNewAccessToken(): Promise<string | null> {
  try {
    const r = await axios.post('/api/auth/refresh', null, { withCredentials: true });
    const token = r.data?.token as string | undefined;
    return token ?? null;
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  if (token) {
    try { localStorage.setItem('token', token); } catch {}
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    // Reset auth-expired notifier on successful auth
    authExpiryNotified = false;
    try { toast.dismiss('session-expired'); } catch {}
  } else {
    try { localStorage.removeItem('token'); } catch {}
    delete api.defaults.headers.common['Authorization'];
  }
  try {
    window.dispatchEvent(new CustomEvent('authTokenChanged', { detail: { token } }));
  } catch {}
}

export function initToken() {
  try {
    const t = localStorage.getItem('token');
    if (t) setToken(t);
  } catch {}
}

// Attach Authorization header from localStorage (for manual axios, not just api instance)
api.interceptors.request.use((config) => {
  const token = (() => { try { return localStorage.getItem('token'); } catch { return null; } })();
  if (token && !config.headers?.Authorization) {
    config.headers = config.headers || {};
    (config.headers as any)['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// Global response interceptor to handle auth expiry with silent refresh
api.interceptors.response.use(
  (resp) => resp,
  (error) => {
    const status = error?.response?.status;
    const original = error.config;
    if ((status === 401 || status === 403) && !original?._retry) {
      original._retry = true;
      if (!isRefreshing) {
        isRefreshing = true;
        return requestNewAccessToken().then((newToken) => {
          isRefreshing = false;
          refreshWaiters.forEach((w) => w(newToken));
          refreshWaiters = [];
          if (newToken) {
            setToken(newToken);
            original.headers = original.headers || {};
            original.headers['Authorization'] = `Bearer ${newToken}`;
            return api.request(original);
          }
          // Hard expire: notify once and redirect
          notifyAuthExpiredOnce();
          return Promise.reject(error);
        });
      } else {
        return new Promise((resolve, reject) => {
          refreshWaiters.push((token) => {
            if (token) {
              original.headers = original.headers || {};
              original.headers['Authorization'] = `Bearer ${token}`;
              resolve(api.request(original));
            } else {
              // Hard expire (from waiter): notify once and redirect
              notifyAuthExpiredOnce();
              reject(error);
            }
          });
        });
      }
    }
    return Promise.reject(error);
  }
);

export interface MealItemDto { id: string; name: string; grams?: number; calories?: number; protein?: number; carbs?: number; fat?: number; confidence?: number; }
export interface MealDto { id: string; createdAtUtc: string; status: string; photoPath: string; thumbnailPath?: string | null; description?: string | null; calories?: number; protein?: number; carbs?: number; fat?: number; items: MealItemDto[]; errorMessage?: string; }
export interface DailySummary { date: string; calories: number; protein: number; carbs: number; fat: number; waterMl: number; }

export async function login(email: string, password: string) {
  const r = await api.post('/auth/login', { email, password });
  return r.data.token as string;
}
export async function register(email: string, password: string, displayName: string, invitationCode?: string) {
  const r = await api.post('/auth/register', { email, password, displayName, invitationCode });
  return r.data.token as string;
}
export async function getDailySummary(date?: string) {
  const r = await api.get('/profile/daily-summary', { params: { date } });
  return r.data as DailySummary;
}
export interface Goal { calories: number; protein: number; carbs: number; fat: number; waterMl: number; }
export async function getGoal() {
  const r = await api.get('/profile/goal');
  return r.data as Goal;
}
export async function saveGoal(goal: Goal) {
  const r = await api.put('/profile/goal', goal);
  return r.data as Goal;
}
export interface UserSettings { defaultGlassMl?: number; preferredUnit?: 'ml' | 'oz'; }
export async function getSettings(): Promise<UserSettings> {
  const r = await api.get('/profile/settings');
  return r.data as UserSettings;
}
export async function saveSettings(s: UserSettings): Promise<UserSettings> {
  const r = await api.put('/profile/settings', s);
  return r.data as UserSettings;
}
export interface WaterEntry { id: string; createdAtUtc: string; amountMl: number; unit?: string; }
export async function getWater(date?: string): Promise<WaterEntry[]> {
  const r = await api.get('/water', { params: { date } });
  return r.data as WaterEntry[];
}
export async function addWater(amountMl: number, createdAt?: Date, unit: 'ml' | 'oz' = 'ml'): Promise<WaterEntry> {
  const r = await api.post('/water', { amountMl, createdAtUtc: createdAt?.toISOString(), unit });
  return r.data as WaterEntry;
}
export async function deleteWater(id: string): Promise<void> {
  await api.delete(`/water/${id}`);
}
export async function getWaterEntry(id: string): Promise<WaterEntry> {
  const r = await api.get(`/water/${id}`);
  return r.data as WaterEntry;
}
export async function updateWater(id: string, req: { amountMl?: number; createdAtUtc?: string; unit?: 'ml' | 'oz' | null }): Promise<WaterEntry> {
  const r = await api.put(`/water/${id}`, req);
  return r.data as WaterEntry;
}
export async function getMeals(date?: string) {
  const r = await api.get('/meals', { params: { date } });
  return r.data as MealDto[];
}
export async function getMeal(id: string) {
  const r = await api.get(`/meals/${id}`);
  return r.data as MealDto;
}
export async function uploadMeal(photo: File, createdAt?: Date, description?: string) {
  const form = new FormData();
  form.append('photo', photo);
  if (createdAt) {
    // Send ISO string in UTC
    form.append('createdAt', createdAt.toISOString());
  }
  if (description && description.trim()) {
    form.append('description', description.trim());
  }
  const r = await api.post('/meals', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  return r.data as MealDto;
}

export interface UpdateMealRequest { description?: string | null; calories?: number | null; protein?: number | null; carbs?: number | null; fat?: number | null; createdAtUtc?: string | null; }
export async function updateMeal(id: string, req: UpdateMealRequest) {
  const r = await api.put(`/meals/${id}`, req);
  return r.data as MealDto;
}

export async function retryMealAnalysis(id: string) {
  const r = await api.post(`/meals/${id}/retry`);
  return r.data as MealDto;
}

export async function deleteMeal(id: string): Promise<void> {
  await api.delete(`/meals/${id}`);
}

export default api;

export function mealImageUrl(id: string, thumb?: boolean) {
  return `/api/meals/${id}/image${thumb ? '?thumb=true' : ''}`;
}

// Basic logout helper (extend here if you later add server-side revocation)
export async function logout() {
  try {
    await axios.post('/api/auth/logout', null, { withCredentials: true });
  } catch {
    // ignore
  } finally {
    setToken(null);
    try { toast.dismiss('session-expired'); } catch {}
  }
}

// Fetch meal image with auth header and return a blob URL for <img src>
export async function fetchMealImage(id: string, thumb?: boolean, bust?: boolean): Promise<string> {
  const params: Record<string, any> = {};
  if (thumb) params.thumb = true;
  if (bust) params._ = Date.now();
  const r = await api.get(`/meals/${id}/image`, {
    params: Object.keys(params).length ? params : undefined,
    responseType: 'blob'
  });
  const blobUrl = URL.createObjectURL(r.data);
  return blobUrl;
}

export async function rotateMealImage(id: string, direction: 'left' | 'right' = 'right', degrees: number = 90): Promise<MealDto> {
  const r = await api.post(`/meals/${id}/image/rotate`, null, { params: { direction, degrees } });
  return r.data as MealDto;
}

export async function duplicateMeal(id: string, createdAtUtc?: string): Promise<MealDto> {
  const params: Record<string, any> = {};
  if (createdAtUtc) params.createdAtUtc = createdAtUtc;
  const r = await api.post(`/meals/${id}/duplicate`, null, { params: Object.keys(params).length ? params : undefined });
  return r.data as MealDto;
}

export type SuggestionGoalKey =
  | 'mild_weight_loss'
  | 'weight_loss'
  | 'maintain'
  | 'eat_healthier'
  | 'energy'
  | 'nutrient_balance'
  | 'heart_health'
  | 'blood_sugar'
  | 'anti_inflammation'
  | 'reduce_processed'
  | 'more_plant_based'
  | 'gain_muscle';

export type SuggestionTimeframeKey = 'last_7_days' | 'last_3_days' | 'yesterday' | 'today';

export interface SuggestionResponse { content: string; }
export async function getSuggestions(goalKey: SuggestionGoalKey, timeframeKey?: SuggestionTimeframeKey): Promise<SuggestionResponse> {
  const r = await api.post('/suggestions', { goalKey, timeframeKey });
  return r.data as SuggestionResponse;
}
