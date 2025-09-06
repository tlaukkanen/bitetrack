import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

export function setToken(token: string | null) {
  if (token) {
    try { localStorage.setItem('token', token); } catch {}
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
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

export interface MealItemDto { id: string; name: string; grams?: number; calories?: number; protein?: number; carbs?: number; fat?: number; confidence?: number; }
export interface MealDto { id: string; createdAtUtc: string; status: string; photoPath: string; thumbnailPath?: string | null; description?: string | null; calories?: number; protein?: number; carbs?: number; fat?: number; items: MealItemDto[]; errorMessage?: string; }
export interface DailySummary { date: string; calories: number; protein: number; carbs: number; fat: number; }

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
export interface Goal { calories: number; protein: number; carbs: number; fat: number; }
export async function getGoal() {
  const r = await api.get('/profile/goal');
  return r.data as Goal;
}
export async function saveGoal(goal: Goal) {
  const r = await api.put('/profile/goal', goal);
  return r.data as Goal;
}
export async function getMeals(date?: string) {
  const r = await api.get('/meals', { params: { date } });
  return r.data as MealDto[];
}
export async function getMeal(id: string) {
  const r = await api.get(`/meals/${id}`);
  return r.data as MealDto;
}
export async function uploadMeal(photo: File, createdAt?: Date) {
  const form = new FormData();
  form.append('photo', photo);
  if (createdAt) {
    // Send ISO string in UTC
    form.append('createdAt', createdAt.toISOString());
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
export function logout() {
  setToken(null);
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
