import { createFileRoute } from "@tanstack/react-router";

// GET /api/cron/job-reminders?key=<CRON_SECRET>
// Emails a summary of TOMORROW's booked jobs. Authorised either by the cron
// secret (for the daily schedule) OR by a signed-in admin/editor (manual "send
// now" button). Set CRON_SECRET in Lovable for the scheduled call.
function sydTomorrowISO(): string {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date()); // YYYY-MM-DD in Sydney
  const [y, m, d] = today.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString().slice(0, 10);
}

const esc = (v: unknown) =>
  String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const Route = createFileRoute("/api/cron/job-reminders")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const key = new URL(request.url).searchParams.get("key");
        const secret = process.env["CRON_SECRET"];
        let authorized = !!(secret && key && key === secret);
        if (!authorized) {
          const { requireAdmin } = await import("../../../lib/admin-auth.server");
          const admin = await requireAdmin(request);
          if (!admin.ok) return admin.response;
          authorized = true;
        }

        const { supabaseAdmin } = await import("../../../integrations/supabase/client.server");
        const { sendEmail, brandedEmail } = await import("../../../lib/email.server");
        const { loadSettings } = await import("../../../lib/document-send.server");

        const target = sydTomorrowISO();
        const { data: jobs } = await supabaseAdmin
          .from("jobs")
          .select("title, job_time, suburb, customer_phone, description")
          .eq("job_date", target)
          .eq("status", "booked")
          .order("job_time", { ascending: true });

        if (!jobs || !jobs.length) return Response.json({ ok: true, date: target, jobs: 0, emailed: false });

        const settings = await loadSettings();
        const to = settings.email || "matt@lankyservices.com.au";
        const nice = new Date(target + "T00:00:00").toLocaleDateString("en-AU", { weekday: "long", day: "2-digit", month: "long" });

        const rows = jobs.map((j) => {
          const bits = [
            j.job_time ? `<strong>${esc(j.job_time.slice(0, 5))}</strong>` : "<strong>Anytime</strong>",
            esc(j.title),
            j.suburb ? `· ${esc(j.suburb)}` : "",
            j.customer_phone ? `· ${esc(j.customer_phone)}` : "",
          ].filter(Boolean).join(" ");
          return `<li style="margin:0 0 8px">${bits}${j.description ? `<br><span style="color:#5c6357;font-size:13px">${esc(j.description)}</span>` : ""}</li>`;
        }).join("");

        const { html, text } = brandedEmail({
          businessName: settings.business_name,
          heading: `You have ${jobs.length} job${jobs.length === 1 ? "" : "s"} tomorrow`,
          intro: `Here's what's booked for ${nice}:`,
          bodyParagraphs: [],
          contact: { phone: settings.phone, email: settings.email },
        });
        const htmlWithList = html.replace("</h1>", `</h1><ul style="padding-left:18px;margin:8px 0 4px">${rows}</ul>`);
        const textList = jobs.map((j) => `- ${j.job_time ? j.job_time.slice(0, 5) + " " : ""}${j.title}${j.suburb ? " · " + j.suburb : ""}${j.customer_phone ? " · " + j.customer_phone : ""}`).join("\n");

        const res = await sendEmail({
          to,
          subject: `Tomorrow: ${jobs.length} job${jobs.length === 1 ? "" : "s"} — ${nice}`,
          html: htmlWithList,
          text: `${jobs.length} job(s) tomorrow (${nice}):\n\n${textList}\n\n${text}`,
        });
        return Response.json({ ok: true, date: target, jobs: jobs.length, emailed: res.ok, error: res.ok ? undefined : res.error });
      },
    },
  },
});
