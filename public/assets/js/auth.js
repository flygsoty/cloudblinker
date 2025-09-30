import { supabase, redirectToRoleHome, showToast, fetchProfile } from './app.js';

export function initAuthPages() {
  const signUpForm = document.querySelector('#sign-up-form');
  const signInForm = document.querySelector('#sign-in-form');
  const googleButtons = document.querySelectorAll('[data-google-auth]');

  if (signUpForm) {
    signUpForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const formData = new FormData(signUpForm);
      const email = formData.get('email')?.toString().trim();
      const password = formData.get('password')?.toString();
      const displayName = formData.get('display_name')?.toString().trim();
      const role = formData.get('role')?.toString() || 'client';

      if (!email || !password) {
        showToast('メールアドレスとパスワードを入力してください', 'error');
        return;
      }

      try {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              role,
              display_name: displayName
            }
          }
        });

        if (error) throw error;

        const profile = await fetchProfile();
        const next = redirectToRoleHome(profile?.role ?? role);
        window.location.href = next;
      } catch (error) {
        console.error(error);
        showToast(error.message ?? 'サインアップに失敗しました', 'error');
      }
    });
  }

  if (signInForm) {
    signInForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const formData = new FormData(signInForm);
      const email = formData.get('email')?.toString().trim();
      const password = formData.get('password')?.toString();

      if (!email || !password) {
        showToast('メールアドレスとパスワードを入力してください', 'error');
        return;
      }

      try {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        const profile = await fetchProfile();
        const redirectParam = new URLSearchParams(window.location.search).get('redirect');
        if (redirectParam) {
          window.location.href = redirectParam;
          return;
        }
        const role = profile?.role;
        const next = role ? redirectToRoleHome(role) : '/';
        window.location.href = next;
      } catch (error) {
        console.error(error);
        showToast(error.message ?? 'ログインに失敗しました', 'error');
      }
    });
  }

  googleButtons.forEach((button) => {
    button.addEventListener('click', async (event) => {
      event.preventDefault();
      const role = button.dataset.role ?? 'client';
      const redirectPath = button.dataset.redirect ?? redirectToRoleHome(role);
      const redirectUrl = new URL(redirectPath, window.location.origin).toString();
      try {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            queryParams: {
              access_type: 'offline',
              prompt: 'consent'
            },
            redirectTo: redirectUrl
          }
        });
        if (error) throw error;
      } catch (error) {
        console.error(error);
        showToast('Googleログインに失敗しました', 'error');
      }
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAuthPages);
} else {
  initAuthPages();
}
