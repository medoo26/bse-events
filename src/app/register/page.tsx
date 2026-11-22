"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useApp } from "@/components/Providers";
import { TopBar } from "@/components/TopBar";
import { api } from "@/lib/api";
import { GRADES_AR, GRADES_EN, OUTSIDE_GRADE } from "@/lib/i18n";

export default function RegisterPage() {
  const { t, lang } = useApp();
  const [fullName, setFullName] = useState("");
  const [isSchool, setIsSchool] = useState<boolean | null>(null);
  const [grade, setGrade] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [a1, setA1] = useState(false);
  const [a2, setA2] = useState(false);
  const [a3, setA3] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  const grades = lang === "ar" ? GRADES_AR : GRADES_EN;

  const pickSchool = (v: boolean) => {
    setIsSchool(v);
    setGrade(v ? "" : OUTSIDE_GRADE);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr("");
    if (!fullName.trim() || isSchool === null || !grade || !username.trim() || !password) return setErr(t("fillAll"));
    if (!a1 || !a2 || !a3) return setErr(t("mustAgree"));
    setBusy(true);
    const gradeValue = grade === OUTSIDE_GRADE ? OUTSIDE_GRADE : GRADES_AR[GRADES_EN.indexOf(grade)] ?? grade;
    const r = await api("/api/student/register", {
      fullName: fullName.trim(),
      isSchool,
      grade: gradeValue,
      username: username.trim(),
      password,
      agreed: true,
    });
    setBusy(false);
    if (!r.ok) {
      if (r.data?.error === "username_taken") return setErr(t("usernameTaken"));
      if (r.status === 429) return setErr(t("tooMany"));
      return setErr(r.data?.error === "invalid" ? t("fillAll") : t("error"));
    }
    setDone(true);
  };

  if (done)
    return (
      <div className="min-h-screen">
        <TopBar />
        <main className="mx-auto flex max-w-md flex-col items-center gap-6 px-4 py-16 text-center">
          <div className="text-7xl">✅</div>
          <h1 className="text-3xl font-bold text-head">{t("accountCreated")}</h1>
          <Link href="/student-login" className="btn-primary !px-10 !py-4 !text-xl">
            {t("goLogin")}
          </Link>
        </main>
      </div>
    );

  return (
    <div className="min-h-screen">
      <TopBar />
      <main className="mx-auto max-w-xl px-4 py-8">
        <h1 className="mb-6 text-center text-3xl font-bold text-head">{t("registerTitle")}</h1>
        <form onSubmit={submit} className="card space-y-4">
          <div>
            <label className="label">{t("fullName")}</label>
            <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div>
            <p className="label">{t("isSchoolStudent")}</p>
            <div className="flex gap-3">
              <button type="button" className={isSchool === true ? "btn-secondary flex-1" : "btn-ghost flex-1"} onClick={() => pickSchool(true)}>
                {t("yes")}
              </button>
              <button type="button" className={isSchool === false ? "btn-secondary flex-1" : "btn-ghost flex-1"} onClick={() => pickSchool(false)}>
                {t("no")}
              </button>
            </div>
          </div>
          <div>
            <label className="label">{t("gradeLevel")}</label>
            <select className="input" value={grade} onChange={(e) => setGrade(e.target.value)} disabled={isSchool === false}>
              <option value="" disabled />
              {grades.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
              <option value={OUTSIDE_GRADE}>{t("outsideSchool")}</option>
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">{t("username")}</label>
              <input className="input" dir="ltr" autoCapitalize="none" value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div>
              <label className="label">{t("password")}</label>
              <input type="password" autoComplete="new-password" maxLength={40} className="input" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          </div>

          <div className="space-y-3 rounded-xl bg-soft p-4 text-sm leading-7">
            {[
              [a1, setA1, t("agreePrivacy")],
              [a2, setA2, t("agreeCert")],
              [a3, setA3, t("agreeTrue")],
            ].map(([v, set, label], i) => (
              <label key={i} className="flex min-h-[44px] cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1.5 h-6 w-6 shrink-0 accent-brand-secondary"
                  checked={v as boolean}
                  onChange={(e) => (set as (b: boolean) => void)(e.target.checked)}
                />
                <span>{label as string}</span>
              </label>
            ))}
          </div>

          {err && <p className="font-bold text-rose-600">{err}</p>}
          <button className="btn-primary w-full !py-3 !text-lg sm:!py-4 sm:!text-xl" disabled={busy}>
            {busy ? t("saving") : t("createAccount")}
          </button>
        </form>
      </main>
    </div>
  );
}
