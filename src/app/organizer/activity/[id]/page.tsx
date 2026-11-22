"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/Providers";
import { Modal, TopBar } from "@/components/TopBar";
import { CertificateView } from "@/components/CertificateView";
import { watch } from "@/lib/supabase";
import { api } from "@/lib/api";
import { regCompleted, regGrade, regIsSchool, regName } from "@/lib/format";
import { downloadAttendanceExcel } from "@/lib/excel";
import { GRADES_AR, OUTSIDE_GRADE } from "@/lib/i18n";
import { DEFAULT_CONTENT_COORDS, DEFAULT_NAME_COORDS } from "@/lib/types";
import type { Activity, Registration } from "@/lib/types";

type Tab = "attendance" | "excel" | "certs";

export default function LiveActivityPage() {
  const { t } = useApp();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [ok, setOk] = useState(false);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [regs, setRegs] = useState<Registration[]>([]);
  const [tab, setTab] = useState<Tab>("attendance");
  const [session, setSession] = useState(1);
  const [manualOpen, setManualOpen] = useState(false);
  const [previewReg, setPreviewReg] = useState<Registration | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await api(`/api/organizer/live?id=${encodeURIComponent(id)}`);
    if (r.status === 401) return router.replace("/login");
    if (r.status === 404) return router.replace("/organizer");
    if (!r.ok) return;
    setOk(true);
    setActivity(r.data.activity as Activity);
    setRegs((r.data.regs ?? []) as Registration[]);
  }, [id, router]);

  useEffect(() => {
    load();
    return watch(load, 10000);
  }, [load]);

  if (!ok) return null;
  if (!activity) return <div className="p-10 text-center">{t("loading")}</div>;

  const sessions = activity.sessions_count;

  const mark = async (r: Registration, value: boolean) => {
    const next = { ...(r.attendance_sessions ?? {}), [String(session)]: value };
    setRegs((list) => list.map((x) => (x.id === r.id ? { ...x, attendance_sessions: next } : x)));
    const res = await api("/api/organizer/attendance", { registrationId: r.id, session, value });
    if (!res.ok) load();
  };

  const addManual = async (name: string, isSchool: boolean, grade: string) => {
    const res = await api("/api/organizer/manual", { activityId: id, name, isSchool, grade });
    if (!res.ok) return alert(t("error"));
    setManualOpen(false);
    load();
  };

  const exportExcel = async () => {
    setBusy(true);
    await downloadAttendanceExcel({
      title: activity.title,
      sessions,
      filename: `سجل حضور - ${activity.title}`,
      rows: regs.map((r) => ({ name: regName(r), isSchool: regIsSchool(r), grade: regGrade(r), attendance: r.attendance_sessions ?? {} })),
    });
    setBusy(false);
  };

  const issue = async (r: Registration) => {
    setBusy(true);
    const res = await api("/api/organizer/issue", { registrationId: r.id });
    setBusy(false);
    if (!res.ok) return alert(t("error"));
    setPreviewReg(null);
    load();
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "attendance", label: t("tabAttendance") },
    { id: "excel", label: t("tabExcel") },
    { id: "certs", label: t("tabCerts") },
  ];

  return (
    <div className="min-h-screen">
      <TopBar
        homeHref="/organizer"
        right={
          <Link href="/organizer" className="btn-ghost btn-sm">
            {t("back")}
          </Link>
        }
      />
      <main className="mx-auto max-w-4xl space-y-4 px-4 py-6">
        <div className="card flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="break-words text-sm opacity-70">{activity.events?.title}</p>
            <h1 className="break-words text-xl font-bold text-head sm:text-2xl">{activity.title}</h1>
          </div>
          <div className="shrink-0 rounded-2xl bg-brand-primary px-5 py-3 text-center text-white dark:bg-brand-secondary">
            <div className="text-4xl font-bold leading-none">{regs.length}</div>
            <div className="text-sm">{t("registeredCount")}</div>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          {tabs.map((x) => (
            <button key={x.id} className={tab === x.id ? "btn-secondary" : "btn-ghost"} onClick={() => setTab(x.id)}>
              {x.label}
            </button>
          ))}
        </div>

        {tab === "attendance" && (
          <section className="space-y-3">
            {sessions > 1 && (
              <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
                {Array.from({ length: sessions }, (_, i) => i + 1).map((n) => (
                  <button key={n} className={session === n ? "btn-primary" : "btn-ghost"} onClick={() => setSession(n)}>
                    {t("session")} {n}
                  </button>
                ))}
              </div>
            )}
            <button className="btn-secondary w-full sm:w-auto" onClick={() => setManualOpen(true)}>
              ＋ {t("addManual")}
            </button>
            {regs.length === 0 && <p className="card text-center">{t("noStudents")}</p>}
            {regs.map((r) => {
              const present = !!r.attendance_sessions?.[String(session)];
              const marked = r.attendance_sessions?.[String(session)] !== undefined;
              return (
                <div key={r.id} className="card flex flex-col gap-3 !p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="break-words font-bold">{regName(r)}</p>
                    <p className="text-xs opacity-70">
                      {regIsSchool(r) ? t("insideSchool") : t("outsideOfSchool")} {regGrade(r) ? `• ${regGrade(r)}` : ""}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
                    <button className={marked && present ? "btn-ok !min-h-[48px] sm:min-w-[110px]" : "btn-ghost !min-h-[48px] sm:min-w-[110px]"} onClick={() => mark(r, true)}>
                      ✓ {t("present")}
                    </button>
                    <button className={marked && !present ? "btn-danger !min-h-[48px] sm:min-w-[110px]" : "btn-ghost !min-h-[48px] sm:min-w-[110px]"} onClick={() => mark(r, false)}>
                      ✕ {t("absent")}
                    </button>
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {tab === "excel" && (
          <section className="card space-y-3 text-center">
            <p>{regs.length} {t("registeredCount")}</p>
            <button className="btn-primary w-full !py-4 !text-lg sm:w-auto sm:!px-10 sm:!text-xl" onClick={exportExcel} disabled={busy}>
              ⬇ {t("downloadExcel")}
            </button>
          </section>
        )}

        {tab === "certs" && (
          <section className="space-y-3">
            {!activity.has_certificate && <p className="card text-center">{t("noCertForActivity")}</p>}
            {activity.has_certificate && <p className="text-sm opacity-70">{t("needAllSessions")}</p>}
            {activity.has_certificate &&
              regs.map((r) => {
                const done = regCompleted(r, sessions);
                return (
                  <div key={r.id} className="card flex flex-col gap-3 !p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="break-words font-bold">{regName(r)}</p>
                      <p className="text-xs opacity-70">{done ? t("allDone") : t("notDone")}</p>
                    </div>
                    {r.certificate_issued ? (
                      <span className="rounded-xl bg-emerald-100 px-4 py-2.5 text-center font-bold text-emerald-700">{t("certIssuedBadge")}</span>
                    ) : (
                      done && (
                        <button className="btn-primary !min-h-[48px] w-full sm:w-auto" onClick={() => setPreviewReg(r)}>
                          🎓 {t("issueCert")}
                        </button>
                      )
                    )}
                  </div>
                );
              })}
          </section>
        )}
      </main>

      {manualOpen && <ManualForm onClose={() => setManualOpen(false)} onAdd={addManual} />}

      <Modal
        open={!!previewReg}
        onClose={() => setPreviewReg(null)}
        title={t("preview")}
        wide
        footer={
          previewReg && (
            <button className="btn-ok w-full !py-3 !text-lg" disabled={busy} onClick={() => issue(previewReg)}>
              {t("confirmSend")}
            </button>
          )
        }
      >
        {previewReg && activity.certificate_template_url && (
          <div className="space-y-4">
            <p className="text-center font-bold text-head">{regName(previewReg)}</p>
            <CertificateView
              templateUrl={activity.certificate_template_url}
              name={regName(previewReg)}
              content={activity.certificate_content ?? ""}
              nameCoords={activity.name_coords ?? DEFAULT_NAME_COORDS}
              contentCoords={activity.content_coords ?? DEFAULT_CONTENT_COORDS}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}

function ManualForm({ onClose, onAdd }: { onClose: () => void; onAdd: (n: string, s: boolean, g: string) => void }) {
  const { t } = useApp();
  const [name, setName] = useState("");
  const [isSchool, setIsSchool] = useState<boolean | null>(null);
  const [grade, setGrade] = useState("");
  const [err, setErr] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSchool === null || !grade) return setErr(t("fillAll"));
    onAdd(name.trim(), isSchool, grade);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={t("addManual")}
      footer={
        <button form="manual-form" type="submit" className="btn-primary w-full">
          {t("add")}
        </button>
      }
    >
      <form id="manual-form" onSubmit={submit} className="space-y-3">
        <div>
          <label className="label">{t("fullName")}</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <p className="label">{t("isSchoolStudent")}</p>
          <div className="flex gap-2">
            <button type="button" className={isSchool === true ? "btn-secondary flex-1" : "btn-ghost flex-1"} onClick={() => { setIsSchool(true); setGrade(""); }}>
              {t("yes")}
            </button>
            <button type="button" className={isSchool === false ? "btn-secondary flex-1" : "btn-ghost flex-1"} onClick={() => { setIsSchool(false); setGrade(OUTSIDE_GRADE); }}>
              {t("no")}
            </button>
          </div>
        </div>
        <div>
          <label className="label">{t("gradeLevel")}</label>
          <select className="input" value={grade} onChange={(e) => setGrade(e.target.value)}>
            <option value="" disabled />
            {GRADES_AR.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
            <option value={OUTSIDE_GRADE}>{t("outsideSchool")}</option>
          </select>
        </div>
        {err && <p className="font-bold text-rose-600">{err}</p>}
      </form>
    </Modal>
  );
}
