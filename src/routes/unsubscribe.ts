import { createFileRoute } from "@tanstack/react-router";

// GET /unsubscribe?token=... — public one-click unsubscribe (required by law).
function page(title: string, body: string, status = 200) {
  const html = `<!doctype html><html lang="en-AU"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>${title} — Lanky Services</title>
<style>body{margin:0;background:#0a0e0a;color:#f1f5ec;font:16px/1.6 system-ui,Segoe UI,Arial,sans-serif;
display:grid;place-items:center;min-height:100vh}.c{max-width:460px;padding:32px;text-align:center}
h1{font-size:22px;margin:0 0 8px}.m{color:#93a288}a{color:#a3e635}</style></head>
<body><div class="c"><h1>${title}</h1><p class="m">${body}</p></div></body></html>`;
  return new Response(html, { status, headers: { "content-type": "text/html; charset=utf-8" } });
}

export const Route = createFileRoute("/unsubscribe")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const token = new URL(request.url).searchParams.get("token");
        if (!token) return page("Invalid link", "This unsubscribe link is missing its code.", 400);

        const { supabaseAdmin } = await import("../integrations/supabase/client.server");
        const { data } = await supabaseAdmin
          .from("marketing_subscribers")
          .update({ unsubscribed_at: new Date().toISOString() })
          .eq("unsubscribe_token", token)
          .is("unsubscribed_at", null)
          .select("email")
          .maybeSingle();

        // Idempotent: also treat an already-unsubscribed/known token as success.
        return page("You're unsubscribed", "You won't receive any more marketing emails from Lanky Services. Sorry to see you go — you can always request another quote any time.");
      },
    },
  },
});
