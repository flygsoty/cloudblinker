import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const env = window.ENV ?? {};

if (!env.PUBLIC_SUPABASE_URL || !env.PUBLIC_SUPABASE_ANON_KEY) {
  console.warn('Supabase環境変数が設定されていません。ページ上部のenv.jsを確認してください。');
}

export const supabase = createClient(env.PUBLIC_SUPABASE_URL, env.PUBLIC_SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

export function redirectToRoleHome(role) {
  switch (role) {
    case 'client':
      return '/client/index.html';
    case 'blinker':
      return '/blinker/index.html';
    case 'admin':
      return '/settings/index.html';
    default:
      return '/';
  }
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session ?? null;
}

export async function fetchProfile() {
  const session = await getSession();
  if (!session) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (error) {
    console.error('プロフィール取得に失敗しました', error);
    throw error;
  }

  return data;
}

export async function requireAuth(expectedRole) {
  const session = await getSession();
  if (!session) {
    window.location.href = `/auth/sign-in.html?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    return null;
  }

  const profile = await fetchProfile();
  if (!profile) {
    throw new Error('プロフィール情報が存在しません。');
  }

  if (expectedRole && profile.role !== expectedRole && profile.role !== 'admin') {
    window.location.href = redirectToRoleHome(profile.role);
    return null;
  }

  return { session, profile };
}

export async function signOut() {
  await supabase.auth.signOut();
  window.location.href = '/';
}

export async function fetchJSON(path, { method = 'POST', body, headers, ...rest } = {}) {
  const session = await getSession();
  const requestHeaders = new Headers(headers ?? {});
  requestHeaders.set('Content-Type', 'application/json');
  if (session?.access_token) {
    requestHeaders.set('Authorization', `Bearer ${session.access_token}`);
  }

  const response = await fetch(path, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: requestHeaders,
    ...rest
  });

  if (!response.ok) {
    let message = response.statusText;
    try {
      const payload = await response.json();
      message = payload.error ?? payload.message ?? message;
    } catch (_err) {
      // ignore JSON parse errors
    }
    throw new Error(message || 'APIリクエストに失敗しました');
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export function formatCurrency(amount) {
  if (typeof amount !== 'number' || Number.isNaN(amount)) return '¥0';
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(amount / 100);
}

export function getFunctionsBaseUrl() {
  const supabaseUrl = env.PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error('PUBLIC_SUPABASE_URLが設定されていません');
  }
  const url = new URL(supabaseUrl);
  const host = url.host.replace('.supabase.co', '.functions.supabase.co');
  return `${url.protocol}//${host}`;
}

export function getFunctionsUrl(path) {
  return `${getFunctionsBaseUrl()}/${path.replace(/^\//, '')}`;
}

export function showToast(message, type = 'info') {
  const existing = document.querySelector('[data-toast]');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.dataset.toast = 'true';
  toast.className = `fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white ${type === 'error' ? 'bg-red-600' : type === 'success' ? 'bg-emerald-600' : 'bg-slate-700'}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

export function bindSignOut(selector = '[data-sign-out]') {
  document.querySelectorAll(selector).forEach((el) => {
    el.addEventListener('click', async (event) => {
      event.preventDefault();
      try {
        await signOut();
      } catch (error) {
        console.error(error);
        showToast('サインアウトに失敗しました', 'error');
      }
    });
  });
}

export async function loadWallet() {
  const session = await getSession();
  if (!session) return null;
  const { data, error } = await supabase
    .from('wallets')
    .select('*')
    .eq('user_id', session.user.id)
    .maybeSingle();
  if (error) {
    console.error('ウォレット取得失敗', error);
    throw error;
  }
  return data;
}

export async function listTasks(filter = {}) {
  let query = supabase.from('tasks').select('*').order('updated_at', { ascending: false });
  if (filter.client_id) {
    query = query.eq('client_id', filter.client_id);
  }
  if (filter.blinker_id) {
    query = query.eq('blinker_id', filter.blinker_id);
  }
  if (filter.status) {
    query = query.eq('status', filter.status);
  }
  const { data, error } = await query;
  if (error) {
    console.error('タスク取得に失敗しました', error);
    throw error;
  }
  return data ?? [];
}

export function renderLoading(target, message = '読み込み中...') {
  if (!target) return;
  target.innerHTML = `<div class="text-sm text-slate-500">${message}</div>`;
}

export function renderEmpty(target, message = 'データがありません。') {
  if (!target) return;
  target.innerHTML = `<div class="text-sm text-slate-400">${message}</div>`;
}

window.CloudBlinker = {
  supabase,
  getSession,
  fetchProfile,
  requireAuth,
  redirectToRoleHome,
  signOut,
  fetchJSON,
  formatCurrency,
  getFunctionsUrl,
  showToast,
  bindSignOut,
  loadWallet,
  listTasks
};
