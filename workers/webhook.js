import Stripe from 'stripe';

function getSupabaseRestUrl(env, path) {
  const base = env.SUPABASE_URL?.replace(/\/?$/, '');
  return `${base}/rest/v1${path}`;
}

async function supabaseRequest(env, path, init = {}) {
  const headers = new Headers(init.headers ?? {});
  headers.set('Content-Type', 'application/json');
  headers.set('apikey', env.SUPABASE_SERVICE_ROLE_KEY);
  headers.set('Authorization', `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`);
  return fetch(getSupabaseRestUrl(env, path), { ...init, headers });
}

async function fetchJson(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    console.error('JSON parse error', error, text);
    return null;
  }
}

async function handleCheckoutSession(eventObject, env) {
  const paymentIntentId = typeof eventObject.payment_intent === 'string'
    ? eventObject.payment_intent
    : eventObject.payment_intent?.id;
  const customerId = typeof eventObject.customer === 'string' ? eventObject.customer : undefined;
  const amount = eventObject.amount_total ?? 0;

  if (!paymentIntentId || !customerId || !amount) {
    console.warn('Missing data for checkout.session.completed', {
      paymentIntentId,
      customerId,
      amount
    });
    return;
  }

  const profileRes = await supabaseRequest(env, `/profiles?select=user_id,stripe_customer_id&stripe_customer_id=eq.${customerId}`, {
    method: 'GET'
  });
  const profiles = await fetchJson(profileRes);
  if (!profiles?.length) {
    console.warn('No profile found for customer', customerId);
    return;
  }
  const userId = profiles[0].user_id;

  const existingPaymentRes = await supabaseRequest(env, `/payments?select=id&payment_intent_id=eq.${paymentIntentId}`, {
    method: 'GET'
  });
  const existingPayment = await fetchJson(existingPaymentRes);

  if (!existingPayment?.length) {
    await supabaseRequest(env, '/payments', {
      method: 'POST',
      headers: {
        Prefer: 'resolution=merge-duplicates'
      },
      body: JSON.stringify([
        {
          user_id: userId,
          amount,
          currency: 'JPY',
          payment_intent_id: paymentIntentId
        }
      ])
    });
  }

  const walletRes = await supabaseRequest(env, `/wallets?select=available,on_hold&user_id=eq.${userId}`, { method: 'GET' });
  const walletData = await fetchJson(walletRes);
  const currentAvailable = walletData?.[0]?.available ?? 0;
  await supabaseRequest(env, `/wallets?user_id=eq.${userId}`, {
    method: 'PATCH',
    body: JSON.stringify({ available: currentAvailable + amount })
  });

  await supabaseRequest(env, '/ledger_entries', {
    method: 'POST',
    headers: {
      Prefer: 'resolution=ignore-duplicates'
    },
    body: JSON.stringify([
      {
        user_id: userId,
        type: 'credit',
        bucket: 'available',
        amount,
        currency: 'JPY',
        source_type: 'checkout',
        source_id: paymentIntentId,
        note: 'Stripe Checkout top-up'
      }
    ])
  });
}

async function handlePayoutEvent(type, payoutObject, env) {
  const payoutId = payoutObject.id;
  const transferId = payoutObject.metadata?.transfer_id ?? payoutObject.source_transaction ?? null;
  const status = type === 'payout.paid' ? 'payout_paid' : 'failed';

  if (!payoutId && !transferId) {
    console.warn('Payout event missing identifiers');
    return;
  }

  const query = transferId
    ? `/payout_requests?select=id&transfer_id=eq.${transferId}`
    : `/payout_requests?select=id&payout_id=eq.${payoutId}`;
  const requestRes = await supabaseRequest(env, query, { method: 'GET' });
  const requests = await fetchJson(requestRes);
  if (!requests?.length) {
    console.warn('No payout request found for event', { payoutId, transferId });
    return;
  }
  const requestId = requests[0].id;

  await supabaseRequest(env, `/payout_requests?id=eq.${requestId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      status,
      payout_id: payoutId ?? undefined
    })
  });
}

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
    const signature = request.headers.get('stripe-signature');
    const body = await request.text();
    let event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, env.STRIPE_WEBHOOK_SECRET);
    } catch (error) {
      console.error('Webhook signature verification failed', error);
      return new Response(`Webhook Error: ${error.message}`, { status: 400 });
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await handleCheckoutSession(event.data.object, env);
          break;
        case 'payout.paid':
        case 'payout.failed':
          await handlePayoutEvent(event.type, event.data.object, env);
          break;
        case 'payment_intent.succeeded':
        case 'payment_intent.payment_failed':
          console.log('Payment intent event received', event.type, event.data.object?.id);
          break;
        default:
          console.log('Unhandled event type', event.type);
      }
    } catch (error) {
      console.error('Error processing event', event.type, error);
      return new Response('Server error', { status: 500 });
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
