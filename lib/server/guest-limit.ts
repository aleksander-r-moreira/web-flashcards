import "server-only";
import { createHmac } from "node:crypto";
import net from "node:net";
import { env } from "./env";
import { createAdminClient } from "./supabase";

const WINDOW_SEC = 24 * 60 * 60;
const GLOBAL_KEY = "guest:global";
const GLOBAL_MAX = Number(process.env.GUEST_GLOBAL_PER_DAY) || 50;

export type GuestReservation = { ok: true; keys: string[] } | { ok: false; status: number; message: string; retryAfterSec?: number };

export function clientIp(request: Request): string {
  const real = request.headers.get("x-real-ip")?.trim();
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (real || forwarded || "desconhecido").slice(0, 64);
}

function expandIpv6(ip: string): string[] {
  const [head, tail = ""] = ip.split("::");
  const left = head ? head.split(":") : [];
  const right = ip.includes("::") ? (tail ? tail.split(":") : []) : [];
  const missing = 8 - left.length - right.length;
  return [...left, ...Array(Math.max(0, missing)).fill("0"), ...right];
}

function ipBucket(ip: string): string {
  if (net.isIP(ip) === 6) return expandIpv6(ip.toLowerCase()).slice(0, 4).join(":") + "::/64";
  return ip;
}

function ipKey(ip: string): string {
  const digest = createHmac("sha256", env().SUPABASE_SECRET_KEY).update(`guest-ip:${ipBucket(ip)}`).digest("hex");
  return `guest:${digest.slice(0, 40)}`;
}

async function take(key: string, max: number): Promise<number> {
  const { data, error } = await createAdminClient().rpc("take_rate_token", {
    p_key: key,
    p_window_seconds: WINDOW_SEC,
    p_max: max,
  });
  if (error) {
    console.error("Erro no limite de visitantes:", error.message);
    throw new Error("limite indisponível");
  }
  return Number(data) || 0;
}

export async function releaseGuest(keys: string[]) {
  const supabase = createAdminClient();
  for (const key of keys) {
    const { error } = await supabase.rpc("release_rate_token", { p_key: key });
    if (error) console.error("Erro ao devolver tentativa de visitante:", error.message);
  }
}

export async function reserveGuest(request: Request): Promise<GuestReservation> {
  const key = ipKey(clientIp(request));
  try {
    const waitIp = await take(key, 1);
    if (waitIp > 0) {
      return {
        ok: false,
        status: 429,
        retryAfterSec: waitIp,
        message: `Modo visitante: 1 material por dia. Tente de novo em ${Math.ceil(waitIp / 3600)} h ou entre na sua conta.`,
      };
    }
    const waitGlobal = await take(GLOBAL_KEY, GLOBAL_MAX);
    if (waitGlobal > 0) {
      await releaseGuest([key]);
      return { ok: false, status: 429, retryAfterSec: waitGlobal, message: "O modo visitante atingiu o limite de hoje. Entre na sua conta para continuar." };
    }
    return { ok: true, keys: [key, GLOBAL_KEY] };
  } catch {
    return { ok: false, status: 503, message: "Serviço temporariamente indisponível." };
  }
}
