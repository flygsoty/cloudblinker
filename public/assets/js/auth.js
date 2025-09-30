// /public/assets/js/auth.js
// 認証処理（サインアップ・サインイン・OAuth）

import { supabase, redirectByRole } from "./app.js";

// --- サインアップ処理 ---
const signUpForm = document.getElementById("sign-up-form");
if (signUpForm) {
  signUpForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = signUpForm.email.value;
    const password = signUpForm.password.value;
    const displayName = signUpForm.display_name.value;
    const role = signUpForm.role.value;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName, role }
      }
    });

    if (error) {
      alert("登録失敗: " + error.message);
      return;
    }

    alert("確認メールを送信しました。メールをご確認ください。");
    window.location.href = "/auth/sign-in.html";
  });
}

// --- サインイン処理 ---
const signInForm = document.getElementById("sign-in-form");
if (signInForm) {
  signInForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = signInForm.email.value;
    const password = signInForm.password.value;

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      alert("ログイン失敗: " + error.message);
      return;
    }

    // ロールに応じてダッシュボードへ遷移
    redirectByRole(data.user);
  });
}

// --- Google認証処理 ---
const googleBtn = document.querySelector("[data-google-auth]");
if (googleBtn) {
  googleBtn.addEventListener("click", async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin + "/auth/callback"
      }
    });

    if (error) {
      alert("Google認証失敗: " + error.message);
    }
  });
}
