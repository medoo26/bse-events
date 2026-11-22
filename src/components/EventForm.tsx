"use client";

import { FormEvent, useState } from "react";
import { api } from "@/lib/api";
import { isoToLocal, localToIso, todayStr } from "@/lib/format";
import type { EventRow } from "@/lib/types";
import { useApp } from "./Providers";
import { Modal } from "./TopBar";

export function EventForm({ event, onClose, onSaved }: { event?: EventRow; onClose: () => void; onSaved: () => void }) {
  const { t } = useApp();
  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [duration, setDuration] = useState(event?.duration ?? "");
  const [date, setDate] = useState(event?.event_date ?? todayStr());
  const [endTime, setEndTime] = useState(event ? isoToLocal(event.end_time) : "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !endTime || !date) return setErr(t("fillAll"));
    setBusy(true);
    setErr("");
    const r = await api("/api/organizer/saveEvent", {
      id: event?.id,
      title: title.trim(),
      description: description.trim(),
      duration: duration.trim(),
      event_date: date,
      end_time: localToIso(endTime),
    });
    setBusy(false);
    if (!r.ok) return setErr(t("error"));
    onSaved();
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={event ? t("editEvent") : t("addEvent")}
      footer={
        <button form="event-form" type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? t("saving") : t("save")}
        </button>
      }
    >
      <form id="event-form" onSubmit={submit} className="space-y-3">
        <div>
          <label className="label">{t("eventTitle")}</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="label">{t("description")}</label>
          <textarea className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">{t("duration")}</label>
            <input className="input" value={duration} onChange={(e) => setDuration(e.target.value)} />
          </div>
          <div>
            <label className="label">{t("eventDate")}</label>
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">{t("endTime")}</label>
          <input type="datetime-local" className="input" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </div>
        {err && <p className="text-sm font-bold text-rose-600">{err}</p>}
      </form>
    </Modal>
  );
}
