export const onRequestGet: PagesFunction = async ({ env }) => {
  const payload = {
    PUBLIC_SUPABASE_URL: env.PUBLIC_SUPABASE_URL,
    PUBLIC_SUPABASE_ANON_KEY: env.PUBLIC_SUPABASE_ANON_KEY,
    PUBLIC_STRIPE_PUBLISHABLE_KEY: env.PUBLIC_STRIPE_PUBLISHABLE_KEY || "",
    STRIPE_CONNECT_CLIENT_ID: env.STRIPE_CONNECT_CLIENT_ID || "",
    APP_URL: env.APP_URL || "https://cloudblinker.site",
  };

  const body = `window.ENV = ${JSON.stringify(payload)};`;

  return new Response(body, {
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "no-store, no-cache, must-revalidate",
    },
  });
};
