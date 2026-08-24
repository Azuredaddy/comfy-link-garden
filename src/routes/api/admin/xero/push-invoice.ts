import { createFileRoute } from "@tanstack/react-router";

// POST /api/admin/xero/push-invoice { id } — create the invoice in Xero and
// (if it has a customer email) have Xero email the PDF. Stores the Xero ids.
export const Route = createFileRoute("/api/admin/xero/push-invoice")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { requireAdmin } = await import("../../../../lib/admin-auth.server");
        const admin = await requireAdmin(request);
        if (!admin.ok) return admin.response;

        const body = (await request.json().catch(() => null)) as { id?: string; email?: boolean } | null;
        if (!body || typeof body.id !== "string") return Response.json({ ok: false, message: "Missing invoice id." }, { status: 400 });

        const { supabaseAdmin } = await import("../../../../integrations/supabase/client.server");
        const { pushInvoice, emailInvoice } = await import("../../../../lib/xero.server");
        const { logServerError, requestMeta } = await import("../../../../lib/error-log.server");

        const { data: doc } = await supabaseAdmin.from("invoices").select("*").eq("id", body.id).maybeSingle();
        if (!doc) return Response.json({ ok: false, message: "Invoice not found." }, { status: 404 });
        const { data: items } = await supabaseAdmin.from("invoice_items").select("*").eq("invoice_id", body.id).order("position");
        const { data: settings } = await supabaseAdmin.from("business_settings").select("gst_registered").eq("id", 1).maybeSingle();

        try {
          const xero = await pushInvoice(doc as never, (items ?? []) as never, !!settings?.gst_registered);
          await supabaseAdmin.from("invoices")
            .update({ xero_invoice_id: xero.id, xero_contact_id: xero.contactId, status: doc.status === "draft" ? "sent" : doc.status, sent_at: new Date().toISOString() })
            .eq("id", body.id);

          let emailed = false;
          if (body.email !== false && doc.customer_email) {
            try { await emailInvoice(xero.id); emailed = true; }
            catch (e) { await logServerError({ source: "api:xero:email", error: e, status: 202, context: { id: body.id }, ...requestMeta(request) }); }
          }
          return Response.json({ ok: true, xero_number: xero.number, emailed });
        } catch (error) {
          await logServerError({ source: "api:xero:push-invoice", error, status: 400, context: { id: body.id }, ...requestMeta(request) });
          return Response.json({ ok: false, message: error instanceof Error ? error.message : "Xero error" }, { status: 400 });
        }
      },
    },
  },
});
