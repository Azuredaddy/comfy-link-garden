import { createFileRoute } from "@tanstack/react-router";

// GET /api/admin/xero/callback?code&state — Xero redirects here after consent.
// Verifies state, exchanges the code for tokens, then bounces back to the admin.
export const Route = createFileRoute("/api/admin/xero/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const origin = url.origin;
        const back = (status: string) => new Response(null, { status: 302, headers: { location: `${origin}/admin.html?tab=settings&xero=${status}` } });

        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        if (url.searchParams.get("error")) return back("denied");
        if (!code || !state) return back("error");

        try {
          const { consumeState, exchangeCode } = await import("../../../../lib/xero.server");
          if (!(await consumeState(state))) return back("state");
          await exchangeCode(code);
          return back("connected");
        } catch (error) {
          const { logServerError, requestMeta } = await import("../../../../lib/error-log.server");
          await logServerError({ source: "api:xero:callback", error, status: 500, ...requestMeta(request) });
          return back("error");
        }
      },
    },
  },
});
