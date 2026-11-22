import type { Align, Coords } from "./types";

// أحرف تحكم + تجاوز اتجاه النص (Bidi override) التي تُستخدم في الخداع النصي
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F‪-‮⁦-⁩]/g;

/** نص متعدد الأسطر: يحذف وسوم HTML والأقواس الزاوية وأحرف التحكم ويقص الطول */
export function cleanText(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return v
    .replace(CONTROL, "")
    .replace(/<[^>]*>/g, "")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, max);
}

/** نص بسطر واحد */
export function cleanLine(v: unknown, max: number): string {
  return cleanText(v, max * 2)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

const num = (v: unknown, min: number, max: number, def: number) => {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};

export function cleanCoords(v: unknown, def: Coords): Coords {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const align: Align = o.align === "right" || o.align === "left" || o.align === "center" ? o.align : def.align;
  const color = typeof o.color === "string" && /^#[0-9a-fA-F]{6}$/.test(o.color) ? o.color : def.color;
  return {
    x: num(o.x, 0, 100, def.x),
    y: num(o.y, 0, 100, def.y),
    size: num(o.size, 0.5, 15, def.size),
    w: num(o.w, 5, 100, def.w),
    color,
    align,
  };
}

export const isUuid = (v: unknown): v is string =>
  typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
