import { createFileRoute } from "@tanstack/react-router";

// GET /api/calendar/feed?token=<ical_token>
// Private iCal feed of jobs. Subscribe to this URL in Google Calendar
// (Other calendars → From URL) and bookings sync to your phone. Returns
// text/calendar, so the .ics extension isn't required.
function icsEscape(v: unknown): string {
  return String(v ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}
const pad = (n: number) => String(n).padStart(2, "0");

export const Route = createFileRoute("/api/calendar/feed")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const token = new URL(request.url).searchParams.get("token");
        if (!token) return new Response("Missing token", { status: 400 });

        const { supabaseAdmin } = await import("../../../integrations/supabase/client.server");
        const { data: settings } = await supabaseAdmin
          .from("business_settings")
          .select("ical_token, business_name")
          .eq("id", 1)
          .maybeSingle();
        const expected = (settings as { ical_token?: string } | null)?.ical_token;
        if (!expected || token !== expected) return new Response("Invalid token", { status: 403 });

        const from = new Date(); from.setDate(from.getDate() - 60);
        const to = new Date(); to.setDate(to.getDate() + 400);
        const { data: jobs } = await supabaseAdmin
          .from("jobs")
          .select("id, title, job_date, job_time, suburb, customer_phone, description, status, updated_at")
          .neq("status", "cancelled")
          .gte("job_date", from.toISOString().slice(0, 10))
          .lte("job_date", to.toISOString().slice(0, 10));

        const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
        const name = (settings as { business_name?: string } | null)?.business_name || "Lanky Services";
        const lines: string[] = [
          "BEGIN:VCALENDAR",
          "VERSION:2.0",
          "PRODID:-//Lanky Services//Jobs//EN",
          "CALSCALE:GREGORIAN",
          "METHOD:PUBLISH",
          `X-WR-CALNAME:${icsEscape(name)} — Jobs`,
        ];

        for (const j of (jobs ?? [])) {
          const d = j.job_date.replace(/-/g, "");
          let dtStart: string, dtEnd: string;
          if (j.job_time) {
            const [h, m] = j.job_time.split(":").map(Number);
            dtStart = `DTSTART:${d}T${pad(h)}${pad(m)}00`;
            dtEnd = `DTEND:${d}T${pad((h + 1) % 24)}${pad(m)}00`;
          } else {
            const next = new Date(j.job_date + "T00:00:00");
            next.setDate(next.getDate() + 1);
            dtStart = `DTSTART;VALUE=DATE:${d}`;
            dtEnd = `DTEND;VALUE=DATE:${next.toISOString().slice(0, 10).replace(/-/g, "")}`;
          }
          const desc = [
            j.customer_phone ? `Phone: ${j.customer_phone}` : "",
            j.status ? `Status: ${j.status}` : "",
            j.description || "",
          ].filter(Boolean).join("\\n");
          lines.push(
            "BEGIN:VEVENT",
            `UID:job-${j.id}@lankyservices.com.au`,
            `DTSTAMP:${stamp}`,
            `LAST-MODIFIED:${(j.updated_at || new Date().toISOString()).replace(/[-:]/g, "").replace(/\.\d+/, "")}`,
            dtStart,
            dtEnd,
            `SUMMARY:${icsEscape(j.title)}${j.suburb ? " — " + icsEscape(j.suburb) : ""}`,
            j.suburb ? `LOCATION:${icsEscape(j.suburb)}` : "",
            desc ? `DESCRIPTION:${desc}` : "",
            "END:VEVENT",
          );
        }
        lines.push("END:VCALENDAR");

        return new Response(lines.filter(Boolean).join("\r\n"), {
          headers: {
            "content-type": "text/calendar; charset=utf-8",
            "content-disposition": 'inline; filename="lanky-jobs.ics"',
            "cache-control": "no-cache",
          },
        });
      },
    },
  },
});
