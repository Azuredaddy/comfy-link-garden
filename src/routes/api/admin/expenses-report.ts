import { createFileRoute } from "@tanstack/react-router";

// GET /api/admin/expenses-report?fy=<startYear>
// Admin-only: yearly expenses PDF for the Australian financial year that
// STARTS in <fy> (1 Jul <fy> – 30 Jun <fy>+1). Defaults to the current FY.
function currentFyStart(): number {
  const now = new Date();
  return now.getMonth() + 1 >= 7 ? now.getFullYear() : now.getFullYear() - 1;
}

export const Route = createFileRoute("/api/admin/expenses-report")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { requireAdmin } = await import("../../../lib/admin-auth.server");
        const admin = await requireAdmin(request);
        if (!admin.ok) return admin.response;

        const url = new URL(request.url);
        const parsed = parseInt(url.searchParams.get("fy") ?? "", 10);
        const fy = Number.isFinite(parsed) && parsed > 2000 && parsed < 2100 ? parsed : currentFyStart();
        const from = `${fy}-07-01`;
        const to = `${fy + 1}-06-30`;

        const { supabaseAdmin } = await import("../../../integrations/supabase/client.server");
        const { renderExpensesReportPdf } = await import("../../../lib/pdf.server");
        const { loadSettings } = await import("../../../lib/document-send.server");

        const { data: expenses } = await supabaseAdmin
          .from("expenses")
          .select("*")
          .gte("expense_date", from)
          .lte("expense_date", to)
          .order("category", { ascending: true })
          .order("expense_date", { ascending: true });

        const settings = await loadSettings();
        const bytes = await renderExpensesReportPdf(fy, (expenses ?? []) as never, settings);

        return new Response(new Blob([bytes as unknown as BlobPart], { type: "application/pdf" }), {
          headers: {
            "content-type": "application/pdf",
            "content-disposition": `inline; filename="lanky-expenses-FY${fy}-${fy + 1}.pdf"`,
            "cache-control": "no-store",
          },
        });
      },
    },
  },
});
