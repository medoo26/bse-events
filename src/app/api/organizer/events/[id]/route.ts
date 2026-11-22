import { NextRequest } from "next/server";
import { admin, deleteTemplates, notify } from "@/lib/server/admin";
import { csrfOk, fail, isOrganizer, json } from "@/lib/server/http";
import { isUuid } from "@/lib/sanitize";

export const dynamic = "force-dynamic";

/** حذف فعالية + أنشطتها + تسجيلاتها + قوالب شهاداتها. الأرشيف الدائم يبقى كاملا. */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!csrfOk(req)) return fail("bad_origin", 403);
  if (!(await isOrganizer(req))) return fail("unauthorized", 401);
  const id = params.id;
  if (!isUuid(id)) return fail("invalid");
  const db = admin();

  const { data: ev } = await db.from("events").select("id").eq("id", id).maybeSingle();
  if (!ev) return fail("not_found", 404);

  const { data: acts } = await db.from("activities").select("id, is_started, certificate_template_url").eq("event_id", id);
  const ids = (acts ?? []).map((a) => a.id);

  // نحدّث نسخة الأرشيف قبل الحذف (للأنشطة المنفذة أو المؤرشفة سابقا) ليحتفظ بآخر حضور
  if (ids.length) {
    const { data: archived } = await db.from("activity_archives").select("activity_id").in("activity_id", ids);
    const have = new Set((archived ?? []).map((r) => r.activity_id));
    for (const a of acts ?? []) {
      if (a.is_started || have.has(a.id)) await db.rpc("refresh_activity_archive", { p_activity: a.id });
    }
  }

  // الأنشطة والتسجيلات تُحذف بالـ cascade؛ والأرشيف يُفك ارتباطه فقط (on delete set null)
  const { error } = await db.from("events").delete().eq("id", id);
  if (error) return fail("server", 500);

  await deleteTemplates((acts ?? []).map((a) => a.certificate_template_url));
  await notify("catalog");
  return json({ ok: true });
}
