import { getFunctionsUrl, fetchJSON, showToast } from './app.js';

export async function createCheckoutSession({ amount, successUrl, cancelUrl }) {
  if (!amount || amount <= 0) {
    throw new Error('金額が正しく入力されていません');
  }
  const url = getFunctionsUrl('create-checkout');
  return fetchJSON(url, {
    method: 'POST',
    body: {
      amount,
      successUrl,
      cancelUrl
    }
  });
}

export async function handleTopupForm(form) {
  const amountField = form.querySelector('[name="amount"]');
  const amountText = amountField?.value ?? '';
  const amount = Math.round(Number(amountText) * 100);

  if (!Number.isFinite(amount) || amount <= 0) {
    showToast('金額を正しく入力してください', 'error');
    return;
  }

  const successPath = form.dataset.successUrl ?? '/client/topup-success.html';
  const cancelPath = form.dataset.cancelUrl ?? '/client/topup-cancel.html';
  const successUrl = new URL(successPath, window.location.origin).toString();
  const cancelUrl = new URL(cancelPath, window.location.origin).toString();

  try {
    form.querySelector('[data-submit-text]')?.classList.add('hidden');
    form.querySelector('[data-loading-text]')?.classList.remove('hidden');
    const { url } = await createCheckoutSession({ amount, successUrl, cancelUrl });
    if (!url) throw new Error('チェックアウトURLを取得できませんでした');
    window.location.href = url;
  } catch (error) {
    console.error(error);
    showToast(error.message ?? 'チェックアウトの作成に失敗しました', 'error');
  } finally {
    form.querySelector('[data-submit-text]')?.classList.remove('hidden');
    form.querySelector('[data-loading-text]')?.classList.add('hidden');
  }
}
