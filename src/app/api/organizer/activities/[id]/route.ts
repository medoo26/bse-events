import { NextRequest } from "next/server";
import { admin, deleteTemplates, notify } from "@/lib/server/admin";
import { csrfOk, fail, isOrganizer, json } from "@/lib/server/http";
import { isUuid } from "@/lib/sanitize";

export const dynamic = "force-dynamic";

/** حذف نشاط + تسجيلاته + قالب شهادته. الأرشيف الدائم يبقى كاملا. */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!csrfOk(req)) return fail("bad_origin", 403);
  if (!(await isOrganizer(req))) return fail("unauthorized", 401);
  const id = params.id;
  if (!isUuid(id)) return fail("invalid");
  const db = admin();

  const { data: act } = await db.from("activities").select("id, is_started, certificate_template_url").eq("id", id).maybeSingle();
  if (!act) return fail("not_found", 404);

  const { data: archived } = await db.from("activity_archives").select("id").eq("activity_id", id).maybeSingle();
  if (act.is_started || archived) await db.rpc("refresh_activity_archive", { p_activity: id });

  const { error } = await db.from("activities").delete().eq("id", id);
  if (error) return fail("server", 500);

  await deleteTemplates([act.certificate_template_url]);
  await notify("catalog");
  return json({ ok: true });
}
