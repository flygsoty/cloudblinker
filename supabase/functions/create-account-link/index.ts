import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

serve(() =>
  new Response(
    JSON.stringify({ error: "Not Implemented", message: "このEdge Functionは今後のマイルストーンで実装予定です。" }),
    {
      status: 501,
      headers: { "Content-Type": "application/json" }
    }
  )
);
