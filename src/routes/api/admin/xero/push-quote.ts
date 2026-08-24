import { createFileRoute } from "@tanstack/react-router";

// POST /api/admin/xero/push-quote { id } — create the quote in Xero. Stores ids.
export const Route = createFileRoute("/api/admin/xero/push-quote")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { requireAdmin } = await import("../../../../lib/admin-auth.server");
        const admin = await requireAdmin(request);
        if (!admin.ok) return admin.response;

        const body = (await request.json().catch(() => null)) as { id?: string } | null;
        if (!body || typeof body.id !== "string") return Response.json({ ok: false, message: "Missing quote id." }, { status: 400 });

        const { supabaseAdmin } = await import("../../../../integrations/supabase/client.server");
        const { pushQuote } = await import("../../../../lib/xero.server");
        const { logServerError, requestMeta } = await import("../../../../lib/error-log.server");

        const { data: doc } = await supabaseAdmin.from("quotes").select("*").eq("id", body.id).maybeSingle();
        if (!doc) return Response.json({ ok: false, message: "Quote not found." }, { status: 404 });
        const { data: items } = await supabaseAdmin.from("quote_items").select("*").eq("quote_id", body.id).order("position");
        const { data: settings } = await supabaseAdmin.from("business_settings").select("gst_registered").eq("id", 1).maybeSingle();

        try {
          const xero = await pushQuote(doc as never, (items ?? []) as never, !!settings?.gst_registered);
          await supabaseAdmin.from("quotes")
            .update({ xero_quote_id: xero.id, xero_contact_id: xero.contactId })
            .eq("id", body.id);
          return Response.json({ ok: true, xero_number: xero.number });
        } catch (error) {
          await logServerError({ source: "api:xero:push-quote", error, status: 400, context: { id: body.id }, ...requestMeta(request) });
          return Response.json({ ok: false, message: error instanceof Error ? error.message : "Xero error" }, { status: 400 });
        }
      },
    },
  },
});
