import type { Lang } from "./i18n";
import type { Registration } from "./types";

export function fmtDate(d: string | null | undefined, lang: Lang) {
  if (!d) return "";
  const date = new Date(d);
  if (isNaN(date.getTime())) return d;
  return date.toLocaleDateString(lang === "ar" ? "ar-EG-u-ca-gregory" : "en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function fmtDateTime(d: string | null | undefined, lang: Lang) {
  if (!d) return "";
  const date = new Date(d);
  if (isNaN(date.getTime())) return d;
  return date.toLocaleString(lang === "ar" ? "ar-EG-u-ca-gregory" : "en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function regName(r: Registration) {
  return r.students?.full_name ?? r.manual_student_name ?? "";
}
export function regIsSchool(r: Registration) {
  return r.students ? r.students.is_school_student : !!r.manual_is_school_student;
}
export function regGrade(r: Registration) {
  return r.students?.grade_level ?? r.manual_grade_level ?? "";
}
export function regCompleted(r: Registration, sessions: number) {
  for (let i = 1; i <= sessions; i++) {
    if (!r.attendance_sessions?.[String(i)]) return false;
  }
  return true;
}
export function isEventEnded(end_time: string) {
  return new Date(end_time).getTime() < Date.now();
}

/** يحوّل قيمة datetime-local إلى ISO */
export function localToIso(v: string) {
  return new Date(v).toISOString();
}
/** يحوّل ISO إلى قيمة datetime-local */
export function isoToLocal(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
export function todayStr() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
