# CloudBlinker MVP (M1-M2)

CloudBlinkerはAWS課題に特化した成果報酬型マッチングサービスのMVPです。本リポジトリではCloudflare Pagesを利用したフロントエンド、Cloudflare WorkersによるStripe Webhook、Supabase Edge Functions・データベーススキーマを管理します。

## ディレクトリ構成

```
/public              静的サイト (Cloudflare Pages)
  ├─ index.html      LP
  ├─ auth/           サインアップ・ログイン
  ├─ client/         依頼者向け画面 (M2: 入金フローまで実装)
  ├─ blinker/        Blinker向け画面 (骨格のみ)
  ├─ assets/         共通JS/CSS
/workers             Cloudflare Worker (Stripe Webhook)
/supabase            SupabaseスキーマとEdge Functions
```

## 必要な環境変数

| Key | 用途 | 配置 |
| --- | --- | --- |
| `PUBLIC_SUPABASE_URL` | Supabase Project URL | Cloudflare Pages 環境変数 | 
| `PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | Cloudflare Pages |
| `PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe公開キー | Cloudflare Pages |
| `STRIPE_CONNECT_CLIENT_ID` | Stripe Connect Client ID | Cloudflare Pages |
| `STRIPE_SECRET_KEY` | Stripeシークレットキー | Supabase Edge Functions / Workers |
| `SUPABASE_URL` | Supabase URL | Supabase Edge Functions / Workers |
| `SUPABASE_SERVICE_ROLE_KEY` | Service Role Key | Supabase Edge Functions / Workers |
| `STRIPE_WEBHOOK_SECRET` | Stripe Webhook署名秘密 | Cloudflare Worker |

Cloudflare Pagesでは `/public/assets/js/env.js` をビルド時に書き換えるか、 `_headers` や専用Worker経由で `window.ENV` を注入してください。ローカル開発時はサンプル値を直接記述しても構いません。

## セットアップ手順

1. Supabaseプロジェクトを作成し、`supabase/schema.sql` を `supabase db push` で適用します。
2. StripeでCheckoutとWebhook用のAPIキー・Signing Secretを取得します。
3. Supabase Edge Functionsをデプロイします。
   ```bash
   supabase functions deploy create-checkout
   supabase functions deploy create-transfer
   supabase functions deploy create-account-link
   supabase functions deploy create-refund
   ```
   `create-transfer` / `create-account-link` / `create-refund` は現時点では 501 を返すスタブです。
4. Cloudflare Pagesに本リポジトリを接続し、ビルド出力を `public` に設定します。環境変数を登録したうえでデプロイします。
5. Cloudflare Workersで `workers/webhook.js` をデプロイし、StripeのWebhookエンドポイントとして `https://<your-domain>/api/stripe/webhook` を設定します。
6. Stripeダッシュボードから `checkout.session.completed` / `payment_intent.*` / `payout.*` イベントを送信するよう設定します。

## 実装状況 (M1-M2)

- ✅ 認証フロー (メール/パスワード + Google OAuthエントリポイント)
- ✅ プロフィール・ウォレット自動生成トリガ
- ✅ クライアントダッシュボードで残高表示
- ✅ Stripe Checkoutによるウォレット入金 (Supabase Edge Function)
- ✅ Webhookによるウォレット更新・レジャー記帳
- ⏳ タスク投稿/HOLD、出金、返金などは次フェーズで実装予定

## ローカルテスト

静的サイトの確認には任意のHTTPサーバーを利用できます。

```bash
npx http-server public
```

Edge Functionは `supabase functions serve create-checkout` でローカル実行し、`PUBLIC_*` 系の環境変数は `.env.local` などで読み込んでください。

## ライセンス

社内検証用のため未定義です。必要に応じて追記してください。
