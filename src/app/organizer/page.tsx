"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/Providers";
import { Modal, TopBar } from "@/components/TopBar";
import { EventForm } from "@/components/EventForm";
import { ActivityForm } from "@/components/ActivityForm";
import { watch } from "@/lib/supabase";
import { api, apiDelete } from "@/lib/api";
import { fmtDate, fmtDateTime, isEventEnded } from "@/lib/format";
import { downloadAttendanceExcel } from "@/lib/excel";
import type { Activity, ArchiveRow, EventRow } from "@/lib/types";

export default function OrganizerPage() {
  const { t, lang } = useApp();
  const router = useRouter();
  const [ok, setOk] = useState(false);
  const [tab, setTab] = useState<"events" | "records">("events");
  const [events, setEvents] = useState<EventRow[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [archives, setArchives] = useState<ArchiveRow[]>([]);
  const [eventForm, setEventForm] = useState<{ event?: EventRow } | null>(null);
  const [del, setDel] = useState<{ kind: "event" | "activity"; id: string; title: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [delErr, setDelErr] = useState("");
  const [actForm, setActForm] = useState<{ eventId: string; activity?: Activity } | null>(null);

  const load = useCallback(async () => {
    const r = await api("/api/organizer/overview");
    if (r.status === 401) return router.replace("/login");
    if (!r.ok) return;
    setOk(true);
    setEvents((r.data.events ?? []) as EventRow[]);
    setActivities((r.data.activities ?? []) as Activity[]);
    setArchives((r.data.archives ?? []) as ArchiveRow[]);
  }, [router]);

  useEffect(() => {
    load();
    return watch(load);
  }, [load]);

  const start = async (a: Activity) => {
    await api("/api/organizer/start", { id: a.id });
    router.push(`/organizer/activity/${a.id}`);
  };

  const confirmDelete = async () => {
    if (!del) return;
    setDeleting(true);
    setDelErr("");
    const r = await apiDelete(`/api/organizer/${del.kind === "event" ? "events" : "activities"}/${del.id}`);
    setDeleting(false);
    if (!r.ok) return setDelErr(t("error"));
    setDel(null);
    load();
  };

  const logout = async () => {
    await api("/api/organizer/logout", {});
    router.push("/");
  };

  const downloadArchive = async (r: ArchiveRow) => {
    const snap = r.attendance_snapshot ?? {};
    await downloadAttendanceExcel({
      title: r.activity_title ?? "activity",
      sessions: snap.sessions_count ?? 1,
      filename: `سجل حضور - ${r.activity_title ?? ""}`,
      rows: (snap.students ?? []).map((s) => ({
        name: s.name,
        isSchool: !!s.is_school_student,
        grade: s.grade_level ?? "",
        attendance: s.attendance ?? {},
      })),
    });
  };

  if (!ok) return null;

  return (
    <div className="min-h-screen">
      <TopBar
        homeHref="/organizer"
        right={
          <button
            className="btn-ghost btn-sm"
            onClick={logout}
          >
            {t("logout")}
          </button>
        }
      />
      <main className="mx-auto max-w-5xl space-y-4 px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-head sm:text-3xl">{t("organizerPanel")}</h1>
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
            <button className={tab === "events" ? "btn-secondary btn-sm" : "btn-ghost btn-sm"} onClick={() => setTab("events")}>
              {t("eventsTab")}
            </button>
            <button className={tab === "records" ? "btn-secondary btn-sm" : "btn-ghost btn-sm"} onClick={() => setTab("records")}>
              📁 {t("activityRecords")}
            </button>
          </div>
        </div>

        {tab === "events" && (
          <>
            <button className="btn-primary w-full sm:w-auto" onClick={() => setEventForm({})}>
              ＋ {t("addEvent")}
            </button>
            {events.length === 0 && <p className="card text-center">{t("noEvents")}</p>}
            {events.map((ev) => {
              const acts = activities.filter((a) => a.event_id === ev.id);
              const ended = ev.status === "ended" || isEventEnded(ev.end_time);
              return (
                <div key={ev.id} className="card space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h2 className="break-words text-xl font-bold text-head">{ev.title}</h2>
                      <p className="text-sm opacity-70">
                        {fmtDate(ev.event_date, lang)} — {t("endTime")}: {fmtDateTime(ev.end_time, lang)}
                      </p>
                      {ev.description && <p className="mt-1">{ev.description}</p>}
                    </div>
                    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                      <span className={`rounded-full px-3 py-1 text-sm font-bold ${ended ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                        {ended ? t("endedStatus") : t("activeStatus")}
                      </span>
                      <button className="btn-ghost btn-sm" onClick={() => setEventForm({ event: ev })}>
                        ✎ {t("edit")}
                      </button>
                      <button className="btn-secondary btn-sm" onClick={() => setActForm({ eventId: ev.id })}>
                        ＋ {t("addActivity")}
                      </button>
                      <button className="btn-danger btn-sm" onClick={() => setDel({ kind: "event", id: ev.id, title: ev.title })}>
                        🗑 {t("deleteEvent")}
                      </button>
                    </div>
                  </div>
                  {acts.length === 0 && <p className="text-sm opacity-70">{t("noActivities")}</p>}
                  {acts.map((a) => (
                    <div key={a.id} className="flex flex-col gap-3 rounded-xl border-2 border-line bg-page p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <h3 className="break-words font-bold text-head">{a.title}</h3>
                        <p className="text-sm opacity-70">
                          {t("sessions")}: {a.sessions_count}
                          {a.location ? ` • ${a.location}` : ""}
                          {a.room_number ? ` • ${t("room")} ${a.room_number}` : ""}
                          {a.has_certificate ? " • 🎓" : ""}
                        </p>
                      </div>
                      <div className="grid grid-cols-3 gap-2 sm:flex sm:shrink-0">
                        <button className="btn-ghost btn-sm" onClick={() => setActForm({ eventId: ev.id, activity: a })}>
                          ✎ {t("edit")}
                        </button>
                        <button className="btn-ok btn-sm" onClick={() => start(a)}>
                          ▶ {t("startActivity")}
                        </button>
                        <button className="btn-danger btn-sm" onClick={() => setDel({ kind: "activity", id: a.id, title: a.title })}>
                          🗑 {t("deleteActivity")}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </>
        )}

        {tab === "records" && (
          <section className="space-y-3">
            {archives.length === 0 && <p className="card text-center">{t("noRecords")}</p>}
            {archives.map((r) => (
              <div key={r.id} className="card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm opacity-70">{r.event_title}</p>
                  <h2 className="text-lg font-bold text-head">{r.activity_title}</h2>
                  {r.activity_description && <p className="text-sm">{r.activity_description}</p>}
                  <p className="mt-1 text-sm opacity-70">
                    {t("executedOn")}: {fmtDate(r.activity_date, lang)} — {t("registeredCount")}: {r.attendance_snapshot?.students?.length ?? 0}
                  </p>
                </div>
                <button className="btn-primary btn-sm w-full sm:w-auto sm:shrink-0" onClick={() => downloadArchive(r)}>
                  ⬇ {t("downloadExcel")}
                </button>
              </div>
            ))}
          </section>
        )}
      </main>

      <Modal
        open={!!del}
        onClose={() => !deleting && setDel(null)}
        title={del?.kind === "event" ? t("deleteEvent") : t("deleteActivity")}
        footer={
          <div className="grid grid-cols-2 gap-3">
            <button className="btn-ghost" disabled={deleting} onClick={() => setDel(null)}>
              {t("cancel")}
            </button>
            <button className="btn-danger" disabled={deleting} onClick={confirmDelete}>
              {deleting ? t("deleting") : t("confirmDelete")}
            </button>
          </div>
        }
      >
        {del && (
          <div className="space-y-3">
            <p className="break-words rounded-xl bg-soft p-3 text-center font-bold text-head">{del.title}</p>
            <p className="leading-8">{del.kind === "event" ? t("deleteEventMsg") : t("deleteActivityMsg")}</p>
            <p className="text-sm opacity-70">{t("archiveKept")}</p>
            {delErr && <p className="font-bold text-rose-600">{delErr}</p>}
          </div>
        )}
      </Modal>

      {eventForm && <EventForm event={eventForm.event} onClose={() => setEventForm(null)} onSaved={load} />}
      {actForm && <ActivityForm eventId={actForm.eventId} activity={actForm.activity} onClose={() => setActForm(null)} onSaved={load} />}
    </div>
  );
}
