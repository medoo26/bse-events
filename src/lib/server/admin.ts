// خادم فقط: عميل Supabase بمفتاح service_role (يتجاوز RLS). لا تستورده من مكونات المتصفح.
import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function supabaseUrl(): string {
  const u = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!u) throw new Error("NEXT_PUBLIC_SUPABASE_URL is missing");
  return u.replace(/\/$/, "");
}

export function admin(): SupabaseClient {
  if (!client) {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing");
    client = createClient(supabaseUrl(), key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return client;
}

export const TEMPLATE_BUCKET = "certificate-templates";
export const TEMPLATE_URL_PREFIX = () => `${supabaseUrl()}/storage/v1/object/public/${TEMPLATE_BUCKET}/`;

/** إشعار لحظي خال من البيانات: العملاء يعيدون الجلب عبر الـ API بعد استلامه */
export async function notify(scope: string) {
  try {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    await fetch(`${supabaseUrl()}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ topic: "bse", event: "changed", payload: { scope }, private: false }] }),
    });
  } catch {
    /* الإشعار اختياري؛ العملاء يحدّثون دوريا أيضا */
  }
}

/** يحذف ملفات قوالب الشهادات من الحاوية (يتجاهل أي رابط لا يتبع حاويتنا). الفشل هنا غير حرج. */
export async function deleteTemplates(urls: (string | null | undefined)[]) {
  const prefix = TEMPLATE_URL_PREFIX();
  const paths = urls
    .filter((u): u is string => typeof u === "string" && u.startsWith(prefix))
    .map((u) => decodeURIComponent(u.slice(prefix.length)))
    .filter((p) => p && !p.includes("..") && !p.includes("/"));
  if (!paths.length) return;
  try {
    await admin().storage.from(TEMPLATE_BUCKET).remove(Array.from(new Set(paths)));
  } catch {
    /* ملف يتيم في التخزين لا يؤثر على النظام */
  }
}
