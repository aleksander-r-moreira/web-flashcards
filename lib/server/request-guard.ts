import "server-only";

export class GuardError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export function assertSameOrigin(request: Request) {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") throw new GuardError("Origem não permitida.", 403);

  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) throw new GuardError("Origem não permitida.", 403);
  try {
    if (new URL(origin).host !== host) throw new Error();
  } catch {
    throw new GuardError("Origem não permitida.", 403);
  }
}

export async function readJson(request: Request, maxBytes: number): Promise<unknown> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new GuardError("Formato de requisição inválido.", 415);
  }
  if (Number(request.headers.get("content-length") ?? 0) > maxBytes) {
    throw new GuardError("Requisição grande demais.", 413);
  }
  const reader = request.body?.getReader();
  if (!reader) throw new GuardError("Requisição vazia.", 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maxBytes) {
      await reader.cancel();
      throw new GuardError("Requisição grande demais.", 413);
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new GuardError("Requisição inválida.", 400);
  }
}
