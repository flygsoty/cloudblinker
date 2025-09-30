// /public/assets/js/app.js
// 共通処理：Supabase初期化 & ユーティリティ関数

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// env.js で定義された環境変数を利用
const SUPABASE_URL = window._env_?.SUPABASE_URL;
const SUPABASE_ANON_KEY = window._env_?.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Supabase 環境変数が設定されていません。env.js を確認してください。");
}

// Supabaseクライアントを作成（他モジュールで利用する）
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 共通の認証チェック関数
export async function requireAuth(redirect = "/auth/sign-in.html") {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = redirect;
  }
  return session;
}

// ロールに応じたリダイレクト例
export function redirectByRole(user) {
  const role = user?.user_metadata?.role;
  if (role === "client") {
    window.location.href = "/client/index.html";
  } else if (role === "blinker") {
    window.location.href = "/blinker/index.html";
  } else {
    console.warn("未定義のロール:", role);
    window.location.href = "/";
  }
}
