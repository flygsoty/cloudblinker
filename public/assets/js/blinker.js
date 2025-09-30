import { requireAuth, loadWallet, formatCurrency, bindSignOut, listTasks, showToast } from './app.js';

async function initBlinkerDashboard() {
  const auth = await requireAuth('blinker');
  if (!auth) return;
  bindSignOut();

  try {
    const wallet = await loadWallet();
    const available = wallet ? formatCurrency(wallet.available) : '¥0';
    const availableEl = document.querySelector('[data-blinker-available]');
    if (availableEl) availableEl.textContent = available;
  } catch (error) {
    console.error(error);
    showToast('ウォレット情報の取得に失敗しました', 'error');
  }

  const assignedList = document.querySelector('[data-blinker-assigned]');
  if (assignedList) {
    assignedList.innerHTML = '<p class="text-sm text-slate-500">読み込み中...</p>';
    try {
      const tasks = await listTasks({ blinker_id: auth.session.user.id });
      if (!tasks.length) {
        assignedList.innerHTML = '<p class="text-sm text-slate-400">現在アサインされたタスクはありません。</p>';
        return;
      }
      assignedList.innerHTML = tasks
        .map((task) => `
          <article class="border border-slate-200 rounded-lg p-4 bg-white">
            <h3 class="text-base font-semibold text-slate-800">${task.title}</h3>
            <p class="mt-1 text-sm text-slate-600">ステータス: ${task.status}</p>
            <p class="mt-1 text-xs text-slate-500">更新日: ${task.updated_at ? new Date(task.updated_at).toLocaleString('ja-JP') : '-'}</p>
          </article>
        `)
        .join('');
    } catch (error) {
      console.error(error);
      assignedList.innerHTML = '<p class="text-sm text-red-500">タスクを読み込めませんでした。</p>';
    }
  }
}

function detectPage() {
  const page = document.body.dataset.page;
  switch (page) {
    case 'blinker-dashboard':
      initBlinkerDashboard();
      break;
    default:
      requireAuth('blinker').then((auth) => auth && bindSignOut()).catch((error) => console.error(error));
      break;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', detectPage);
} else {
  detectPage();
}
