import { NextRequest, NextResponse } from "next/server";
import { ORG_COOKIE, STU_COOKIE, verifyToken } from "../auth";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}
export const fail = (code: string, status = 400) => json({ error: code }, status);

export function clientIp(req: NextRequest): string {
  return (req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("x-real-ip") || "unknown").trim();
}

/** حماية CSRF: الطلبات المعدِّلة يجب أن تكون من نفس الموقع وبصيغة JSON */
export function csrfOk(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (origin) {
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
    try {
      if (new URL(origin).host !== host) return false;
    } catch {
      return false;
    }
  }
  return (req.headers.get("content-type") || "").toLowerCase().startsWith("application/json");
}

export async function readJson(req: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const b = await req.json();
    return b && typeof b === "object" && !Array.isArray(b) ? (b as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function isOrganizer(req: NextRequest): Promise<boolean> {
  const s = await verifyToken(req.cookies.get(ORG_COOKIE)?.value);
  return s?.role === "org";
}
export async function studentIdFrom(req: NextRequest): Promise<string | null> {
  const s = await verifyToken(req.cookies.get(STU_COOKIE)?.value);
  return s?.role === "stu" && s.sid ? s.sid : null;
}

export function setSessionCookie(req: NextRequest, res: NextResponse, name: string, value: string, maxAge: number) {
  const https = (req.headers.get("x-forwarded-proto") || req.nextUrl.protocol.replace(":", "")) === "https";
  res.cookies.set(name, value, { httpOnly: true, sameSite: "lax", secure: https, path: "/", maxAge });
}
export function clearCookie(res: NextResponse, name: string) {
  res.cookies.set(name, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
}
