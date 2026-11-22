"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/Providers";
import { TopBar } from "@/components/TopBar";
import { CertificateView } from "@/components/CertificateView";
import { watch } from "@/lib/supabase";
import { api } from "@/lib/api";
import { fmtDate, isEventEnded } from "@/lib/format";
import { downloadCertificatePdf } from "@/lib/pdf";
import { DEFAULT_CONTENT_COORDS, DEFAULT_NAME_COORDS } from "@/lib/types";
import type { Activity, EventRow, Registration, Student } from "@/lib/types";

type View = "browse" | "mine" | "certs" | "account";

export default function StudentDashboard() {
  const { t, lang } = useApp();
  const router = useRouter();
  const [student, setStudent] = useState<Student | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [regs, setRegs] = useState<Registration[]>([]);
  const [view, setView] = useState<View>("browse");
  const [openEvent, setOpenEvent] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async () => {
    const r = await api("/api/student/me");
    if (r.status === 401) return router.replace("/student-login");
    if (!r.ok) return;
    setStudent(r.data.student as Student);
    setName((n) => n || (r.data.student as Student).full_name);
    setEvents((r.data.events ?? []) as EventRow[]);
    setActivities((r.data.activities ?? []) as Activity[]);
    setRegs((r.data.regs ?? []) as Registration[]);
  }, [router]);

  useEffect(() => {
    load();
    return watch(load);
  }, [load]);

  const logout = async () => {
    await api("/api/student/logout", {});
    router.push("/");
  };

  const register = async (a: Activity) => {
    if (!student) return;
    setBusyId(a.id);
    const r = await api("/api/student/enroll", { activityId: a.id });
    setBusyId("");
    if (!r.ok) alert(t("error"));
    load();
  };

  const saveName = async () => {
    if (!student || !name.trim()) return;
    const r = await api("/api/student/rename", { fullName: name.trim() });
    setMsg(r.ok ? t("saved") : t("error"));
    load();
  };

  if (!student) return <div className="p-10 text-center">{t("loading")}</div>;

  const regIds = new Set(regs.map((r) => r.activity_id));
  const visibleEvents = events.filter((e) => e.status === "active" && !isEventEnded(e.end_time));
  const certs = regs.filter((r) => r.certificate_issued && r.activities?.has_certificate);

  const nav: { id: View; label: string }[] = [
    { id: "account", label: t("myAccount") },
    { id: "mine", label: t("myActivities") },
    { id: "certs", label: t("myCertificates") },
  ];

  return (
    <div className="min-h-screen">
      <TopBar
        homeHref="/student-dashboard"
        right={
          <div className="relative">
            <button className="btn-primary btn-sm max-w-[10rem]" onClick={() => setMenu((m) => !m)}>
              👤 <span className="truncate">{student.full_name.split(" ")[0]}</span> ▾
            </button>
            {menu && (
              <div className="absolute end-0 top-full z-40 mt-2 w-[min(15rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border-2 border-line bg-page shadow-xl">
                {nav.map((n) => (
                  <button
                    key={n.id}
                    className="block min-h-[48px] w-full px-4 py-3 text-start font-bold hover:bg-soft"
                    onClick={() => {
                      setView(n.id);
                      setMenu(false);
                    }}
                  >
                    {n.label}
                  </button>
                ))}
                <button className="block min-h-[48px] w-full px-4 py-3 text-start font-bold text-rose-600 hover:bg-soft" onClick={logout}>
                  {t("logout")}
                </button>
              </div>
            )}
          </div>
        }
      />

      <main className="mx-auto max-w-4xl space-y-4 px-4 py-6">
        <div className="flex flex-wrap gap-2">
          <button className={view === "browse" ? "btn-secondary btn-sm" : "btn-ghost btn-sm"} onClick={() => setView("browse")}>
            {t("browseEvents")}
          </button>
          {nav.map((n) => (
            <button key={n.id} className={view === n.id ? "btn-secondary btn-sm" : "btn-ghost btn-sm"} onClick={() => setView(n.id)}>
              {n.label}
            </button>
          ))}
        </div>

        {view === "browse" && (
          <section className="space-y-3">
            <h1 className="text-2xl font-bold text-head">{t("browseEvents")}</h1>
            {visibleEvents.length === 0 && <p className="card text-center">{t("noEvents")}</p>}
            {visibleEvents.map((ev) => {
              const acts = activities.filter((a) => a.event_id === ev.id);
              const open = openEvent === ev.id;
              return (
                <div key={ev.id} className="card">
                  <button className="min-h-[44px] w-full text-start" onClick={() => setOpenEvent(open ? null : ev.id)}>
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="min-w-0 break-words text-xl font-bold text-head">{ev.title}</h2>
                      <span className="text-xl">{open ? "▴" : "▾"}</span>
                    </div>
                    <p className="text-sm opacity-70">{fmtDate(ev.event_date, lang)}</p>
                    {ev.description && <p className="mt-1">{ev.description}</p>}
                  </button>
                  {open && (
                    <div className="mt-4 space-y-3">
                      {acts.length === 0 && <p className="opacity-70">{t("noActivities")}</p>}
                      {acts.map((a) => (
                        <div key={a.id} className="rounded-xl border-2 border-line bg-page p-4">
                          <h3 className="text-lg font-bold text-head">{a.title}</h3>
                          {a.description && <p className="mt-1">{a.description}</p>}
                          <div className="mt-2 flex flex-wrap gap-2 text-sm">
                            {a.location && <span className="rounded-full bg-soft px-3 py-1">📍 {a.location}</span>}
                            {a.room_number && <span className="rounded-full bg-soft px-3 py-1">🚪 {t("room")}: {a.room_number}</span>}
                            <span className="rounded-full bg-soft px-3 py-1">🔢 {t("sessions")}: {a.sessions_count}</span>
                            {a.duration && <span className="rounded-full bg-soft px-3 py-1">⏱ {a.duration}</span>}
                          </div>
                          <div className="mt-3">
                            {regIds.has(a.id) ? (
                              <span className="inline-block rounded-xl bg-emerald-100 px-4 py-2.5 font-bold text-emerald-700">✓ {t("registered")}</span>
                            ) : (
                              <button className="btn-primary w-full sm:w-auto" disabled={busyId === a.id} onClick={() => register(a)}>
                                {t("register")}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        )}

        {view === "mine" && (
          <section className="space-y-3">
            <h1 className="text-2xl font-bold text-head">{t("myActivities")}</h1>
            {regs.length === 0 && <p className="card text-center">{t("noRegs")}</p>}
            {regs.map((r) => {
              const a = r.activities;
              if (!a) return null;
              const done = Object.values(r.attendance_sessions ?? {}).filter(Boolean).length;
              return (
                <div key={r.id} className="card">
                  <p className="text-sm opacity-70">{a.events?.title}</p>
                  <h2 className="text-lg font-bold text-head">{a.title}</h2>
                  <div className="mt-2 flex flex-wrap gap-2 text-sm">
                    <span className="rounded-full bg-emerald-100 px-3 py-1 font-bold text-emerald-700">✓ {t("registered")}</span>
                    <span className="rounded-full bg-soft px-3 py-1">
                      {t("attendedSessions")}: {done}/{a.sessions_count}
                    </span>
                    {a.has_certificate && (
                      <span className="rounded-full bg-soft px-3 py-1">
                        🎓 {r.certificate_issued ? t("certReady") : t("waitingCert")}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {view === "certs" && (
          <section className="space-y-4">
            <h1 className="text-2xl font-bold text-head">{t("myCertificates")}</h1>
            {certs.length === 0 && <p className="card text-center">{t("noCerts")}</p>}
            {certs.map((r) => {
              const a = r.activities!;
              if (!a.certificate_template_url) return null;
              const data = {
                templateUrl: a.certificate_template_url,
                name: student.full_name,
                content: a.certificate_content ?? "",
                nameCoords: a.name_coords ?? DEFAULT_NAME_COORDS,
                contentCoords: a.content_coords ?? DEFAULT_CONTENT_COORDS,
              };
              return (
                <div key={r.id} className="card space-y-3">
                  <h2 className="break-words text-lg font-bold text-head">{a.title}</h2>
                  <CertificateView {...data} />
                  <button
                    className="btn-primary w-full sm:w-auto"
                    disabled={busyId === r.id}
                    onClick={async () => {
                      setBusyId(r.id);
                      try {
                        await downloadCertificatePdf(data, `${a.title} - ${student.full_name}`);
                      } catch {
                        alert(t("error"));
                      }
                      setBusyId("");
                    }}
                  >
                    {busyId === r.id ? t("loading") : `⬇ ${t("downloadPdf")}`}
                  </button>
                </div>
              );
            })}
          </section>
        )}

        {view === "account" && (
          <section className="card max-w-lg space-y-3">
            <h1 className="text-2xl font-bold text-head">{t("myAccount")}</h1>
            <div>
              <label className="label">{t("fullName")}</label>
              <input className="input" value={name} onChange={(e) => { setName(e.target.value); setMsg(""); }} />
            </div>
            <button className="btn-primary" onClick={saveName}>
              {t("save")}
            </button>
            {msg && <p className="font-bold text-emerald-600">{msg}</p>}
          </section>
        )}
      </main>
    </div>
  );
}
