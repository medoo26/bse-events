import { NextRequest } from "next/server";
import { ORG_COOKIE, safeEqual, signToken } from "@/lib/auth";
import { admin, notify, TEMPLATE_BUCKET, TEMPLATE_URL_PREFIX } from "@/lib/server/admin";
import { clearCookie, clientIp, csrfOk, fail, isOrganizer, json, readJson, setSessionCookie } from "@/lib/server/http";
import { clearFails, lockedFor, recordFail } from "@/lib/server/ratelimit";
import { cleanCoords, cleanLine, cleanText, isUuid } from "@/lib/sanitize";
import { GRADES_AR, OUTSIDE_GRADE } from "@/lib/i18n";
import { DEFAULT_CONTENT_COORDS, DEFAULT_NAME_COORDS } from "@/lib/types";

export const dynamic = "force-dynamic";

type Ctx = { params: { action: string } };

const SESSION_TTL = 8 * 3600;
const ORGANIZER_CODE = () => process.env.ORGANIZER_CODE || "20301";
const MAX_IMAGE = 5 * 1024 * 1024;
const IMAGE_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png" };

const dateOk = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v));

export async function GET(req: NextRequest, { params }: Ctx) {
  if (!(await isOrganizer(req))) return fail("unauthorized", 401);
  const db = admin();

  if (params.action === "overview") {
    const [e, a, r] = await Promise.all([
      db.from("events").select("*").order("event_date", { ascending: false }),
      db.from("activities").select("*").order("created_at", { ascending: true }),
      db.from("activity_archives").select("*").order("activity_date", { ascending: false }),
    ]);
    return json({ events: e.data ?? [], activities: a.data ?? [], archives: r.data ?? [] });
  }

  if (params.action === "live") {
    const id = req.nextUrl.searchParams.get("id");
    if (!isUuid(id)) return fail("invalid");
    const [a, r] = await Promise.all([
      db.from("activities").select("*, events(*)").eq("id", id).maybeSingle(),
      db
        .from("registrations")
        .select("*, students(id, full_name, is_school_student, grade_level)")
        .eq("activity_id", id)
        .order("created_at", { ascending: true }),
    ]);
    if (!a.data) return fail("not_found", 404);
    return json({ activity: a.data, regs: r.data ?? [] });
  }
  return fail("not_found", 404);
}

export async function POST(req: NextRequest, { params }: Ctx) {
  if (!csrfOk(req)) return fail("bad_origin", 403);
  const body = await readJson(req);
  if (!body) return fail("invalid");
  const action = params.action;

  // ------------------------------------------------------------ دخول المنظم (مع حد المحاولات)
  if (action === "login") {
    const ip = clientIp(req);
    const keys = [`org:${ip}`, "org:all"];
    for (const k of keys) {
      const lock = await lockedFor(k);
      if (lock) return json({ error: "rate_limited", retryAfter: lock }, 429);
    }
    const code = typeof body.code === "string" ? body.code.slice(0, 64) : "";
    if (!code || !(await safeEqual(code, ORGANIZER_CODE()))) {
      await recordFail(`org:${ip}`, 5, 15, 15); // 5 محاولات خاطئة لكل عنوان => قفل 15 دقيقة
      await recordFail("org:all", 40, 15, 10); // سقف عام ضد التخمين الموزع
      return fail("bad_code", 401);
    }
    await clearFails(`org:${ip}`);
    const res = json({ ok: true });
    setSessionCookie(req, res, ORG_COOKIE, await signToken({ role: "org" }, SESSION_TTL), SESSION_TTL);
    return res;
  }
  if (action === "logout") {
    const res = json({ ok: true });
    clearCookie(res, ORG_COOKIE);
    return res;
  }

  // كل ما بعده يتطلب جلسة منظم صالحة
  if (!(await isOrganizer(req))) return fail("unauthorized", 401);
  const db = admin();

  switch (action) {
    // ------------------------------------------------------------ فعالية
    case "saveEvent": {
      const title = cleanLine(body.title, 150);
      const end = typeof body.end_time === "string" ? new Date(body.end_time) : null;
      if (!title || !dateOk(body.event_date) || !end || isNaN(end.getTime())) return fail("invalid");
      const payload = {
        title,
        description: cleanText(body.description, 1000) || null,
        duration: cleanLine(body.duration, 60) || null,
        event_date: body.event_date,
        end_time: end.toISOString(),
        status: end.getTime() < Date.now() ? "ended" : "active",
      };
      const q = isUuid(body.id)
        ? db.from("events").update(payload).eq("id", body.id)
        : db.from("events").insert(payload);
      const { error } = await q;
      if (error) return fail("server", 500);
      await notify("catalog");
      return json({ ok: true });
    }

    // ------------------------------------------------------------ نشاط
    case "saveActivity": {
      if (!isUuid(body.event_id)) return fail("invalid");
      const title = cleanLine(body.title, 150);
      const sessions = Math.floor(Number(body.sessions_count));
      if (!title || !(sessions >= 1 && sessions <= 20)) return fail("invalid");
      const hasCert = body.has_certificate === true;

      let templateUrl: string | null = null;
      if (hasCert) {
        const u = typeof body.certificate_template_url === "string" ? body.certificate_template_url : "";
        // يُقبل فقط رابط من حاوية القوالب في مشروعنا (يمنع روابط خارجية أو javascript:)
        if (!u.startsWith(TEMPLATE_URL_PREFIX()) || u.length > 400 || /[\s"'<>]/.test(u)) return fail("invalid_template");
        templateUrl = u;
      }
      const payload = {
        event_id: body.event_id,
        title,
        description: cleanText(body.description, 1500) || null,
        duration: cleanLine(body.duration, 60) || null,
        sessions_count: sessions,
        location: cleanLine(body.location, 100) || null,
        room_number: cleanLine(body.room_number, 30) || null,
        has_certificate: hasCert,
        certificate_content: hasCert ? cleanText(body.certificate_content, 1000) : null,
        certificate_template_url: templateUrl,
        name_coords: hasCert ? cleanCoords(body.name_coords, DEFAULT_NAME_COORDS) : null,
        content_coords: hasCert ? cleanCoords(body.content_coords, DEFAULT_CONTENT_COORDS) : null,
      };
      const q = isUuid(body.id)
        ? db.from("activities").update(payload).eq("id", body.id)
        : db.from("activities").insert(payload);
      const { error } = await q;
      if (error) return fail("server", 500);
      await notify("catalog");
      return json({ ok: true });
    }

    case "start": {
      if (!isUuid(body.id)) return fail("invalid");
      await db.from("activities").update({ is_started: true }).eq("id", body.id);
      await db.rpc("refresh_activity_archive", { p_activity: body.id });
      await notify("catalog");
      return json({ ok: true });
    }

    // ------------------------------------------------------------ التحضير
    case "attendance": {
      if (!isUuid(body.registrationId) || typeof body.value !== "boolean") return fail("invalid");
      const session = Math.floor(Number(body.session));
      const { data: reg } = await db
        .from("registrations")
        .select("id, activity_id, activities(sessions_count)")
        .eq("id", body.registrationId)
        .maybeSingle();
      const max = (reg?.activities as unknown as { sessions_count: number } | null)?.sessions_count ?? 0;
      if (!reg || !(session >= 1 && session <= max)) return fail("invalid");
      const { error } = await db.rpc("set_attendance", { p_reg: reg.id, p_session: String(session), p_value: body.value });
      if (error) return fail("server", 500);
      await db.rpc("refresh_activity_archive", { p_activity: reg.activity_id });
      await notify("registrations");
      return json({ ok: true });
    }

    case "manual": {
      if (!isUuid(body.activityId)) return fail("invalid");
      const name = cleanLine(body.name, 120);
      const isSchool = body.isSchool === true;
      let grade = cleanLine(body.grade, 60);
      if (name.length < 3) return fail("invalid");
      if (!isSchool) grade = OUTSIDE_GRADE;
      else if (!GRADES_AR.includes(grade)) return fail("invalid");
      const { error } = await db.from("registrations").insert({
        activity_id: body.activityId,
        manual_student_name: name,
        manual_is_school_student: isSchool,
        manual_grade_level: grade,
      });
      if (error) return fail("server", 500);
      await db.rpc("refresh_activity_archive", { p_activity: body.activityId });
      await notify("registrations");
      return json({ ok: true });
    }

    // ------------------------------------------------------------ إصدار شهادة (يتحقق الخادم من اكتمال الحضور)
    case "issue": {
      if (!isUuid(body.registrationId)) return fail("invalid");
      const { data: reg } = await db
        .from("registrations")
        .select("id, activity_id, attendance_sessions, certificate_issued, activities(sessions_count, has_certificate)")
        .eq("id", body.registrationId)
        .maybeSingle();
      const act = reg?.activities as unknown as { sessions_count: number; has_certificate: boolean } | null;
      if (!reg || !act?.has_certificate) return fail("invalid");
      const att = (reg.attendance_sessions ?? {}) as Record<string, boolean>;
      for (let i = 1; i <= act.sessions_count; i++) if (att[String(i)] !== true) return fail("not_completed", 409);
      const { error } = await db
        .from("registrations")
        .update({ certificate_issued: true, issued_at: new Date().toISOString() })
        .eq("id", reg.id);
      if (error) return fail("server", 500);
      await db.rpc("refresh_activity_archive", { p_activity: reg.activity_id });
      await notify("registrations");
      return json({ ok: true });
    }

    // ------------------------------------------------------------ رابط رفع موقّع لقالب الشهادة (صور فقط، ≤5MB)
    case "uploadUrl": {
      const type = typeof body.type === "string" ? body.type.toLowerCase() : "";
      const size = Number(body.size);
      const ext = IMAGE_TYPES[type];
      if (!ext) return fail("bad_type");
      if (!Number.isFinite(size) || size <= 0 || size > MAX_IMAGE) return fail("too_big");
      const path = `${crypto.randomUUID()}.${ext}`;
      const { data, error } = await db.storage.from(TEMPLATE_BUCKET).createSignedUploadUrl(path);
      if (error || !data) return fail("server", 500);
      const publicUrl = db.storage.from(TEMPLATE_BUCKET).getPublicUrl(path).data.publicUrl;
      return json({ path, token: data.token, publicUrl });
    }
  }
  return fail("not_found", 404);
}
