// Browser-side API calls with plain error messages (requirements section 10, reliability).

export interface ApiResult<T> {
  ok: boolean;
  data?: T;
  status: number;
  error?: string;
  errors?: Record<string, string>;
}

export async function api<T = unknown>(url: string, init?: { method?: string; body?: unknown }): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: init?.method ?? 'GET',
      headers: init?.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: 'no-store',
      credentials: 'same-origin',
    });
  } catch {
    return { ok: false, status: 0, error: 'Not saved. Check your connection and try again.' };
  }
  let body: Record<string, unknown> = {};
  try {
    body = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) {
    // Hosting platforms (e.g. Vercel) answer timeouts/crashes with their own page; show their error code so it can be traced.
    const platformCode = res.headers.get('x-vercel-error');
    const fallback =
      res.status === 403
        ? 'You can view these books but not change them.'
        : res.status === 507
          ? 'Storage is full. Delete old entries or upgrade the database plan.'
          : res.status === 504 || platformCode === 'FUNCTION_INVOCATION_TIMEOUT'
            ? `The server took too long to answer (${platformCode ?? 'error 504'}). Usually the database cannot be reached: check MongoDB Atlas → Network Access, then open /api/health.`
            : res.status >= 500
              ? `Not saved. The server had a problem (${platformCode ?? `error ${res.status}`}). Open /api/health to see why.`
              : `Something went wrong (error ${res.status}).`;
    return {
      ok: false,
      status: res.status,
      error: typeof body.error === 'string' ? body.error : fallback,
      errors: (body.errors as Record<string, string>) ?? undefined,
    };
  }
  return { ok: true, status: res.status, data: body as T };
}
