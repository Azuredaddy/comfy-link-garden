import { createFileRoute } from "@tanstack/react-router";

// POST /api/admin/job-confirm { job_id }
// Texts the customer a booking confirmation via Twilio and logs it.
// If Twilio isn't configured, returns { ok:true, configured:false } so the
// browser can fall back to opening the phone's Messages app.
export const Route = createFileRoute("/api/admin/job-confirm")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { requireAdmin } = await import("../../../lib/admin-auth.server");
        const admin = await requireAdmin(request);
        if (!admin.ok) return admin.response;

        const body = (await request.json().catch(() => null)) as { job_id?: string; message?: string } | null;
        if (!body || typeof body.job_id !== "string") {
          return Response.json({ ok: false, message: "Missing job id." }, { status: 400 });
        }

        const { isConfigured, sendSms } = await import("../../../lib/sms.server");
        if (!isConfigured()) return Response.json({ ok: true, configured: false, sent: false });

        const { supabaseAdmin } = await import("../../../integrations/supabase/client.server");
        const { loadSettings } = await import("../../../lib/document-send.server");

        const { data: job } = await supabaseAdmin
          .from("jobs")
          .select("id, title, customer_phone, job_date, job_time, suburb")
          .eq("id", body.job_id)
          .maybeSingle();
        if (!job) return Response.json({ ok: false, message: "Job not found." }, { status: 404 });
        if (!job.customer_phone) return Response.json({ ok: false, configured: true, message: "This job has no phone number." }, { status: 400 });

        const settings = await loadSettings();
        const first = String(job.title || "").split(/[—-]/)[0].trim() || "there";
        const dstr = job.job_date
          ? new Date(job.job_date + "T00:00:00").toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" })
          : "";
        const time = job.job_time ? job.job_time.slice(0, 5) : "";
        const phoneLine = settings.phone ? ` Any questions call ${settings.phone}.` : "";
        const message = body.message?.trim() ||
          `Hi ${first}, confirming your booking with ${settings.business_name}${dstr ? " on " + dstr : ""}${time ? " at " + time : ""}${job.suburb ? " (" + job.suburb + ")" : ""}.${phoneLine} Thanks!`;

        const sms = await sendSms(job.customer_phone, message);

        await supabaseAdmin.from("messages").insert({
          job_id: job.id,
          channel: "sms",
          direction: "outbound",
          to_phone: job.customer_phone,
          subject: "Booking confirmation",
          body: message,
          email_status: sms.ok ? "sent" : "failed",
          error: sms.ok ? null : sms.error ?? null,
        } as never);

        if (!sms.ok) {
          const { logServerError, requestMeta } = await import("../../../lib/error-log.server");
          await logServerError({ source: "api:job-confirm:sms", error: sms.error, status: 502, context: { job_id: job.id }, ...requestMeta(request) });
          return Response.json({ ok: false, configured: true, message: `Text failed: ${sms.error}` }, { status: 502 });
        }
        return Response.json({ ok: true, configured: true, sent: true });
      },
    },
  },
});
