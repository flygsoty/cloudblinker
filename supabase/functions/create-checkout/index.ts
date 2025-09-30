import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@15.12.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0?target=deno";

const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!stripeSecretKey || !supabaseUrl || !serviceRoleKey) {
  console.error("必要な環境変数が設定されていません");
}

const stripe = new Stripe(stripeSecretKey ?? "", { apiVersion: "2023-10-16" });

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  const supabase = createClient(supabaseUrl ?? "", serviceRoleKey ?? "", {
    global: {
      headers: {
        Authorization: authHeader
      }
    }
  });

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error(userError);
    return new Response(JSON.stringify({ error: "認証情報を取得できませんでした" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, stripe_customer_id, email, display_name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    console.error(profileError);
    return new Response(JSON.stringify({ error: "プロフィール情報が見つかりません" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  if (profile.role !== "client" && profile.role !== "admin") {
    return new Response(JSON.stringify({ error: "クライアントのみが入金できます" }), {
      status: 403,
      headers: { "Content-Type": "application/json" }
    });
  }

  let payload: { amount?: number; successUrl?: string; cancelUrl?: string } = {};
  try {
    payload = await req.json();
  } catch (_error) {
    return new Response(JSON.stringify({ error: "リクエスト形式が不正です" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const amount = Number(payload.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return new Response(JSON.stringify({ error: "入金額を正しく指定してください" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const successUrl = payload.successUrl ?? "https://cloudblinker.site/client/topup-success.html";
  const cancelUrl = payload.cancelUrl ?? "https://cloudblinker.site/client/topup-cancel.html";

  let customerId = profile.stripe_customer_id ?? undefined;

  try {
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: profile.email ?? user.email ?? undefined,
        name: profile.display_name ?? undefined,
        metadata: {
          supabase_user_id: user.id
        }
      });
      customerId = customer.id;
      await supabase
        .from("profiles")
        .update({ stripe_customer_id: customer.id })
        .eq("user_id", user.id);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      success_url: successUrl,
      cancel_url: cancelUrl,
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "jpy",
            product_data: {
              name: "CloudBlinker ウォレット入金"
            },
            unit_amount: Math.round(amount)
          },
          quantity: 1
        }
      ]
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: "チェックアウトの作成に失敗しました" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});
