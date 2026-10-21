import "server-only";
import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";

const TIMEOUT_MS = 10_000;
const MAX_BYTES = 2_000_000;
const MAX_REDIRECTS = 3;

export class FetchError extends Error {
  constructor(message: string, public httpStatus?: number) {
    super(message);
  }
}

const blocked = new net.BlockList();
for (const [addr, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
  ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24],
  ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) blocked.addSubnet(addr, prefix, "ipv4");
for (const [addr, prefix] of [
  ["::", 128], ["::1", 128], ["64:ff9b::", 96], ["64:ff9b:1::", 48], ["100::", 64],
  ["2001::", 23], ["2001:db8::", 32], ["2002::", 16], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8],
] as const) blocked.addSubnet(addr, prefix, "ipv6");

export function isPublicIp(ip: string): boolean {
  const mapped = ip.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) ip = mapped[1];
  const family = net.isIP(ip);
  if (family === 0) return false;
  return !blocked.check(ip, family === 4 ? "ipv4" : "ipv6");
}

const safeLookup: net.LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "", 0);
    const list = addresses as unknown as dns.LookupAddress[];
    if (list.length === 0 || !list.every((a) => isPublicIp(a.address))) {
      return callback(new FetchError("Esse endereço não é permitido."), "", 0);
    }
    if ((options as dns.LookupOptions).all) {
      (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, list);
    } else {
      callback(null, list[0].address, list[0].family);
    }
  });
};

function validateUrl(raw: string | URL): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new FetchError("Link inválido.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new FetchError("Use um link http ou https.");
  if (url.username || url.password) throw new FetchError("Links com usuário e senha não são aceitos.");
  if (url.port && url.port !== "80" && url.port !== "443") throw new FetchError("Porta não permitida.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host) && !isPublicIp(host)) throw new FetchError("Esse endereço não é permitido.");
  return url;
}

type RawResponse = { status: number; headers: http.IncomingHttpHeaders; body: Buffer };

function requestOnce(url: URL, signal: AbortSignal): Promise<RawResponse> {
  const client = url.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const req = client.get(
      url,
      {
        lookup: safeLookup,
        signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; EstudosBot/1.0)",
          Accept: "text/html,text/plain;q=0.9,application/json;q=0.8",
          "Accept-Encoding": "identity",
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400) {
          res.resume();
          return resolve({ status, headers: res.headers, body: Buffer.alloc(0) });
        }
        const type = String(res.headers["content-type"] ?? "").toLowerCase();
        if (!/^(text\/|application\/(json|xhtml))/.test(type)) {
          res.destroy();
          return resolve({ status, headers: res.headers, body: Buffer.alloc(0) });
        }
        const declared = Number(res.headers["content-length"] ?? 0);
        if (declared > MAX_BYTES) {
          res.destroy();
          return reject(new FetchError("A página é grande demais."));
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_BYTES) {
            res.destroy();
            reject(new FetchError("A página é grande demais."));
          } else chunks.push(chunk);
        });
        res.on("end", () => resolve({ status, headers: res.headers, body: Buffer.concat(chunks) }));
        res.on("error", reject);
      },
    );
    req.on("error", reject);
  });
}

export async function safeFetchPage(rawUrl: string): Promise<{ text: string; isHtml: boolean }> {
  const { text, type } = await safeFetch(rawUrl);
  const isHtml = type.includes("text/html") || type.includes("application/xhtml");
  if (type.startsWith("video/") || type.startsWith("audio/")) {
    throw new FetchError("Só conseguimos assistir vídeos do YouTube. Para outros vídeos, cole a transcrição como texto.");
  }
  if (!isHtml && !type.includes("text/plain")) {
    throw new FetchError("O link precisa apontar para uma página de texto (HTML) ou um vídeo do YouTube — não para PDF, imagem etc.");
  }
  return { text, isHtml };
}

export async function safeFetchJson(rawUrl: string): Promise<unknown> {
  const { text, type } = await safeFetch(rawUrl);
  if (!type.includes("application/json")) throw new FetchError("Resposta inesperada do site.");
  try {
    return JSON.parse(text);
  } catch {
    throw new FetchError("Resposta inesperada do site.");
  }
}

async function safeFetch(rawUrl: string): Promise<{ text: string; type: string }> {
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  let url = validateUrl(rawUrl);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let res: RawResponse;
    try {
      res = await requestOnce(url, signal);
    } catch (e) {
      if (e instanceof FetchError) throw e;
      if (signal.aborted) throw new FetchError("O site demorou demais para responder.");
      throw new FetchError("Não foi possível acessar o link.");
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.location;
      if (!location) throw new FetchError("O site redirecionou sem destino.");
      url = validateUrl(new URL(location, url));
      continue;
    }
    if (res.status < 200 || res.status >= 300) throw new FetchError(`O site respondeu com erro ${res.status}.`, res.status);

    const type = String(res.headers["content-type"] ?? "").toLowerCase();
    const charset = type.match(/charset=([\w-]+)/)?.[1] ?? "utf-8";
    let text: string;
    try {
      text = new TextDecoder(charset).decode(res.body);
    } catch {
      text = new TextDecoder("utf-8").decode(res.body);
    }
    return { text, type };
  }
  throw new FetchError("Redirecionamentos demais.");
}
