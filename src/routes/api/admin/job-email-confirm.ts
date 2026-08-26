import { createFileRoute } from "@tanstack/react-router";

// POST /api/admin/job/confirm  { id }
// Admin-only: emails the customer a booking confirmation for a job.
export const Route = createFileRoute("/api/admin/job/confirm")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { requireAdmin } = await import("../../../../lib/admin-auth.server");
        const admin = await requireAdmin(request);
        if (!admin.ok) return admin.response;

        const body = (await request.json().catch(() => null)) as { id?: string } | null;
        if (!body || typeof body.id !== "string") {
          return Response.json({ ok: false, message: "Missing job id." }, { status: 400 });
        }

        const { supabaseAdmin } = await import("../../../../integrations/supabase/client.server");
        const { sendEmail, brandedEmail } = await import("../../../../lib/email.server");
        const { loadSettings } = await import("../../../../lib/document-send.server");

        const { data: job } = await supabaseAdmin
          .from("jobs")
          .select("*")
          .eq("id", body.id)
          .maybeSingle();
        if (!job) return Response.json({ ok: false, message: "Job not found." }, { status: 404 });
        if (!job.customer_email) {
          return Response.json(
            { ok: false, message: "Add a customer email address to this job first." },
            { status: 400 },
          );
        }

        const settings = await loadSettings();
        const niceDate = new Date(job.job_date + "T00:00:00").toLocaleDateString("en-AU", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        });
        const niceTime = job.job_time
          ? new Date("2000-01-01T" + job.job_time).toLocaleTimeString("en-AU", {
              hour: "numeric",
              minute: "2-digit",
            })
          : "We'll confirm a time window with you";

        const rows: Array<[string, string]> = [
          ["Date", niceDate],
          ["Time", niceTime],
        ];
        if (job.suburb) rows.push(["Suburb", job.suburb]);
        if (job.description) rows.push(["Job", job.description]);
        if (job.amount != null) rows.push(["Quoted price", `$${Number(job.amount).toFixed(2)}`]);

        const { html, text } = brandedEmail({
          businessName: settings.business_name,
          heading: "Your booking is confirmed",
          intro: `Thanks for booking with ${settings.business_name}. Here are your job details:`,
          bodyParagraphs: [
            "Please have everything accessible on the day — we'll do all the lifting and loading.",
            "Need to change or cancel? Just reply to this email or give us a call and we'll sort it out.",
          ],
          rows,
          contact: { phone: settings.phone, email: settings.email },
        });

        const res = await sendEmail({
          to: job.customer_email,
          subject: `Booking confirmed — ${niceDate}`,
          html,
          text,
          reply_to: settings.email ?? undefined,
          idempotency_key: `job-confirm-${job.id}-${job.job_date}-${job.job_time ?? "any"}`,
        });

        if (!res.ok) {
          return Response.json({ ok: false, message: res.error || "Email failed to send." }, { status: 502 });
        }

        await supabaseAdmin
          .from("jobs")
          .update({ confirmation_sent_at: new Date().toISOString() })
          .eq("id", job.id);

        await supabaseAdmin.from("messages").insert({
          direction: "outbound",
          to_email: job.customer_email,
          subject: `Booking confirmed — ${niceDate}`,
          body: text,
          email_status: "sent",
        });

        return Response.json({ ok: true, emailed: true, to: job.customer_email });
      },
    },
  },
});
