import { createFileRoute } from "@tanstack/react-router";

// GET /api/admin/document-pdf?type=quote|invoice&id=<uuid>
// Admin-only: regenerates the PDF on the fly (reflects the latest edits) and
// streams it back. The browser fetches this with the admin bearer token and
// turns the response into a download/preview.
export const Route = createFileRoute("/api/admin/document-pdf")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { requireAdmin } = await import("../../../lib/admin-auth.server");
        const admin = await requireAdmin(request);
        if (!admin.ok) return admin.response;

        const url = new URL(request.url);
        const type = url.searchParams.get("type");
        const id = url.searchParams.get("id");
        if ((type !== "quote" && type !== "invoice") || !id) {
          return Response.json({ ok: false, message: "Missing type or id." }, { status: 400 });
        }

        const { supabaseAdmin } = await import("../../../integrations/supabase/client.server");
        const { renderDocumentPdf } = await import("../../../lib/pdf.server");
        const { loadSettings } = await import("../../../lib/document-send.server");

        const table = type === "quote" ? "quotes" : "invoices";
        const itemsTable = type === "quote" ? "quote_items" : "invoice_items";
        const fk = type === "quote" ? "quote_id" : "invoice_id";

        const { data: doc } = await supabaseAdmin.from(table).select("*").eq("id", id).maybeSingle();
        if (!doc) return Response.json({ ok: false, message: "Not found." }, { status: 404 });
        const { data: items } = await supabaseAdmin
          .from(itemsTable)
          .select("*")
          .eq(fk, id)
          .order("position", { ascending: true });

        const settings = await loadSettings();
        const bytes = await renderDocumentPdf(type, doc as never, (items ?? []) as never, settings);

        return new Response(new Blob([bytes], { type: "application/pdf" }), {
          headers: {
            "content-type": "application/pdf",
            "content-disposition": `inline; filename="${type}-${doc.number || id}.pdf"`,
            "cache-control": "no-store",
          },
        });
      },
    },
  },
});
