import { requireAuth, loadWallet, formatCurrency, listTasks, bindSignOut, showToast } from './app.js';
import { handleTopupForm } from './stripe.js';

async function initDashboard() {
  const auth = await requireAuth('client');
  if (!auth) return;
  bindSignOut();

  const balanceEl = document.querySelector('[data-available-balance]');
  const holdEl = document.querySelector('[data-hold-balance]');
  const tasksContainer = document.querySelector('[data-client-tasks]');

  try {
    const wallet = await loadWallet();
    if (wallet) {
      if (balanceEl) balanceEl.textContent = formatCurrency(wallet.available);
      if (holdEl) holdEl.textContent = formatCurrency(wallet.on_hold);
    }
  } catch (error) {
    console.error(error);
    showToast('ウォレット情報の取得に失敗しました', 'error');
  }

  if (tasksContainer) {
    tasksContainer.innerHTML = '<p class="text-sm text-slate-500">読み込み中...</p>';
    try {
      const tasks = await listTasks({ client_id: auth.session.user.id });
      if (!tasks.length) {
        tasksContainer.innerHTML = '<p class="text-sm text-slate-400">まだタスクがありません。</p>';
        return;
      }

      tasksContainer.innerHTML = tasks
        .map((task) => `
          <article class="border border-slate-200 rounded-lg p-4 bg-white">
            <div class="flex justify-between items-center">
              <h3 class="text-lg font-semibold text-slate-800">${task.title ?? 'タイトル未設定'}</h3>
              <span class="text-sm font-medium text-emerald-600">${formatCurrency(task.reward)}</span>
            </div>
            <p class="mt-2 text-sm text-slate-600">ステータス: <span class="font-semibold">${task.status}</span></p>
            <p class="mt-1 text-xs text-slate-400">更新日: ${task.updated_at ? new Date(task.updated_at).toLocaleString('ja-JP') : '-'}</p>
          </article>
        `)
        .join('');
    } catch (error) {
      console.error(error);
      tasksContainer.innerHTML = '<p class="text-sm text-red-500">タスクを読み込めませんでした。</p>';
    }
  }
}

async function initTopupPage() {
  const auth = await requireAuth('client');
  if (!auth) return;
  bindSignOut();

  const form = document.querySelector('#topup-form');
  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    await handleTopupForm(form);
  });
}

async function initTopupStatusPage() {
  const auth = await requireAuth('client');
  if (!auth) return;
  bindSignOut();
}

function detectPageAndInit() {
  const page = document.body.dataset.page;
  switch (page) {
    case 'client-dashboard':
      initDashboard();
      break;
    case 'client-topup':
      initTopupPage();
      break;
    case 'client-topup-status':
      initTopupStatusPage();
      break;
    default:
      break;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', detectPageAndInit);
} else {
  detectPageAndInit();
}
