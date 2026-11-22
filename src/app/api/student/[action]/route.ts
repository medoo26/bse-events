import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { signToken, STU_COOKIE } from "@/lib/auth";
import { admin, notify } from "@/lib/server/admin";
import { clearCookie, clientIp, csrfOk, fail, json, readJson, setSessionCookie, studentIdFrom } from "@/lib/server/http";
import { clearFails, lockedFor, recordFail } from "@/lib/server/ratelimit";
import { cleanLine, isUuid } from "@/lib/sanitize";
import { GRADES_AR, OUTSIDE_GRADE } from "@/lib/i18n";

export const dynamic = "force-dynamic";

type Ctx = { params: { action: string } };

const SESSION_TTL = 12 * 3600;
const STUDENT_COLS = "id, full_name, is_school_student, grade_level, username";
// هاش وهمي لمعادلة زمن الاستجابة عند عدم وجود المستخدم
const DUMMY_HASH = bcrypt.hashSync("dummy-password", 10);

export async function GET(req: NextRequest, { params }: Ctx) {
  if (params.action !== "me") return fail("not_found", 404);
  const sid = await studentIdFrom(req);
  if (!sid) return fail("unauthorized", 401);
  const db = admin();

  const { data: student } = await db.from("students").select(STUDENT_COLS).eq("id", sid).maybeSingle();
  if (!student) {
    const res = fail("unauthorized", 401);
    clearCookie(res, STU_COOKIE);
    return res;
  }
  const nowIso = new Date().toISOString();
  const { data: events } = await db
    .from("events")
    .select("*")
    .eq("status", "active")
    .gt("end_time", nowIso)
    .order("event_date", { ascending: true });
  const ids = (events ?? []).map((e) => e.id);
  const { data: activities } = ids.length
    ? await db.from("activities").select("*").in("event_id", ids).order("created_at", { ascending: true })
    : { data: [] };
  const { data: regs } = await db
    .from("registrations")
    .select("id, activity_id, student_id, attendance_sessions, certificate_issued, issued_at, created_at, activities(*, events(*))")
    .eq("student_id", sid);

  return json({ student, events: events ?? [], activities: activities ?? [], regs: regs ?? [] });
}

export async function POST(req: NextRequest, { params }: Ctx) {
  if (!csrfOk(req)) return fail("bad_origin", 403);
  const body = await readJson(req);
  if (!body) return fail("invalid");
  const db = admin();
  const ip = clientIp(req);

  switch (params.action) {
    // ------------------------------------------------------------ إنشاء حساب
    case "register": {
      const lock = await lockedFor(`reg:${ip}`);
      if (lock) return json({ error: "rate_limited", retryAfter: lock }, 429);

      const fullName = cleanLine(body.fullName, 120);
      const username = cleanLine(body.username, 40).toLowerCase();
      const password = typeof body.password === "string" ? body.password : "";
      const isSchool = body.isSchool === true;
      let grade = cleanLine(body.grade, 60);

      if (fullName.length < 3 || !/^[\p{L}\p{N}_.\-]{2,40}$/u.test(username)) return fail("invalid");
      if (password.length < 3 || password.length > 40) return fail("invalid");
      if (body.agreed !== true) return fail("must_agree");
      if (!isSchool) grade = OUTSIDE_GRADE;
      else if (!GRADES_AR.includes(grade)) return fail("invalid");

      // حد للتسجيل من نفس العنوان (مرتفع لأن المدرسة قد تشترك في عنوان واحد)
      await recordFail(`reg:${ip}`, 300, 60, 30);

      const password_hash = await bcrypt.hash(password, 10);
      const { error } = await db.from("students").insert({
        full_name: fullName,
        is_school_student: isSchool,
        grade_level: grade,
        username,
        password_hash,
      });
      if (error) return error.code === "23505" ? fail("username_taken", 409) : fail("server", 500);
      return json({ ok: true });
    }

    // ------------------------------------------------------------ تسجيل دخول
    case "login": {
      const username = cleanLine(body.username, 40).toLowerCase();
      const password = typeof body.password === "string" ? body.password : "";
      if (!username || !password || password.length > 100) return fail("invalid");

      const key = `stu:${ip}:${username}`;
      const lock = await lockedFor(key);
      if (lock) return json({ error: "rate_limited", retryAfter: lock }, 429);

      const { data: row } = await db.from("students").select("id, password_hash").eq("username", username).maybeSingle();
      const ok = await bcrypt.compare(password, row?.password_hash ?? DUMMY_HASH);
      if (!row || !ok) {
        await recordFail(key, 8, 15, 15);
        return fail("bad_login", 401);
      }
      await clearFails(key);
      const res = json({ ok: true });
      setSessionCookie(req, res, STU_COOKIE, await signToken({ role: "stu", sid: row.id }, SESSION_TTL), SESSION_TTL);
      return res;
    }

    case "logout": {
      const res = json({ ok: true });
      clearCookie(res, STU_COOKIE);
      return res;
    }

    // ------------------------------------------------------------ تعديل الاسم
    case "rename": {
      const sid = await studentIdFrom(req);
      if (!sid) return fail("unauthorized", 401);
      const fullName = cleanLine(body.fullName, 120);
      if (fullName.length < 3) return fail("invalid");
      const { error } = await db.from("students").update({ full_name: fullName }).eq("id", sid);
      if (error) return fail("server", 500);
      return json({ ok: true });
    }

    // ------------------------------------------------------------ التسجيل في نشاط
    case "enroll": {
      const sid = await studentIdFrom(req);
      if (!sid) return fail("unauthorized", 401);
      if (!isUuid(body.activityId)) return fail("invalid");
      const { data: act } = await db.from("activities").select("id, events(end_time, status)").eq("id", body.activityId).maybeSingle();
      const ev = act?.events as unknown as { end_time: string; status: string } | null;
      if (!act || !ev || ev.status !== "active" || new Date(ev.end_time).getTime() < Date.now()) return fail("closed", 409);
      const { error } = await db.from("registrations").insert({ activity_id: act.id, student_id: sid });
      if (error && error.code !== "23505") return fail("server", 500);
      await notify("registrations");
      return json({ ok: true });
    }
  }
  return fail("not_found", 404);
}
