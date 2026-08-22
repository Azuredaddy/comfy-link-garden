// Persists server-side errors so they can be reviewed in the admin dashboard.
// Never throws — logging must not break the request it is reporting on.
type LogInput = {
  source: string;
  error?: unknown;
  message?: string;
  route?: string | null;
  method?: string | null;
  status?: number | null;
  userAgent?: string | null;
  context?: Record<string, unknown> | null;
};

function describe(error: unknown): { message: string; stack: string | null } {
  if (error instanceof Error) {
    return { message: error.message || error.name, stack: error.stack ?? null };
  }
  if (typeof error === "string") return { message: error, stack: null };
  try {
    return { message: JSON.stringify(error) ?? "Unknown error", stack: null };
  } catch {
    return { message: "Unknown error", stack: null };
  }
}

export async function logServerError(input: LogInput): Promise<void> {
  const described = describe(input.error);
  const message = (input.message ?? described.message ?? "Unknown error").slice(0, 2000);

  // Always keep the raw error in the platform logs too.
  console.error(`[${input.source}]`, input.error ?? message);

  try {
    const { supabaseAdmin } = await import("../integrations/supabase/client.server");
    await supabaseAdmin.from("server_errors").insert({
      source: input.source.slice(0, 120),
      message,
      stack: described.stack ? described.stack.slice(0, 8000) : null,
      route: input.route ? input.route.slice(0, 500) : null,
      method: input.method ? input.method.slice(0, 10) : null,
      status: input.status ?? null,
      user_agent: input.userAgent ? input.userAgent.slice(0, 500) : null,
      context: (input.context ?? null) as never,
    });
  } catch (loggingError) {
    console.error("[error-log] failed to persist server error", loggingError);
  }
}

export function requestMeta(request: Request) {
  let route: string | null = null;
  try {
    route = new URL(request.url).pathname;
  } catch {
    route = null;
  }
  return {
    route,
    method: request.method,
    userAgent: request.headers.get("user-agent"),
  };
}
