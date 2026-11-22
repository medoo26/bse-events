"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import { supabase } from "@/lib/supabase";
import { api } from "@/lib/api";
import { Activity, Coords, DEFAULT_CONTENT_COORDS, DEFAULT_NAME_COORDS } from "@/lib/types";
import { useApp } from "./Providers";
import { Modal } from "./TopBar";
import { CertificatePositioner } from "./CertificatePositioner";

export function ActivityForm({
  eventId,
  activity,
  onClose,
  onSaved,
}: {
  eventId: string;
  activity?: Activity;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useApp();
  const [title, setTitle] = useState(activity?.title ?? "");
  const [description, setDescription] = useState(activity?.description ?? "");
  const [duration, setDuration] = useState(activity?.duration ?? "");
  const [sessions, setSessions] = useState(String(activity?.sessions_count ?? 1));
  const [location, setLocation] = useState(activity?.location ?? "");
  const [room, setRoom] = useState(activity?.room_number ?? "");
  const [hasCert, setHasCert] = useState(activity?.has_certificate ?? false);
  const [certText, setCertText] = useState(activity?.certificate_content ?? "");
  const [tplUrl, setTplUrl] = useState(activity?.certificate_template_url ?? "");
  const [nameC, setNameC] = useState<Coords>(activity?.name_coords ?? DEFAULT_NAME_COORDS);
  const [contentC, setContentC] = useState<Coords>(activity?.content_coords ?? DEFAULT_CONTENT_COORDS);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const upload = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setErr("");
    if (!["image/jpeg", "image/png"].includes(f.type) || f.size > 5 * 1024 * 1024) {
      e.target.value = "";
      return setErr(t("badImage"));
    }
    setUploading(true);
    // الخادم يتحقق من المنظم ويصدر رابط رفع موقعا؛ Storage نفسه يفرض: صور JPEG/PNG فقط وحتى 5MB
    const r = await api("/api/organizer/uploadUrl", { type: f.type, size: f.size });
    if (!r.ok) {
      setUploading(false);
      return setErr(r.data?.error === "bad_type" || r.data?.error === "too_big" ? t("badImage") : t("error"));
    }
    const { error } = await supabase.storage
      .from("certificate-templates")
      .uploadToSignedUrl(r.data.path, r.data.token, f, { contentType: f.type });
    setUploading(false);
    if (error) return setErr(t("error"));
    setTplUrl(r.data.publicUrl);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const n = parseInt(sessions, 10);
    if (!title.trim() || !n || n < 1) return setErr(t("fillAll"));
    if (hasCert && !tplUrl) return setErr(t("uploadTemplate"));
    setBusy(true);
    setErr("");
    const r = await api("/api/organizer/saveActivity", {
      id: activity?.id,
      event_id: eventId,
      title: title.trim(),
      description: description.trim(),
      duration: duration.trim(),
      sessions_count: n,
      location: location.trim(),
      room_number: room.trim(),
      has_certificate: hasCert,
      certificate_content: hasCert ? certText : "",
      certificate_template_url: hasCert ? tplUrl : "",
      name_coords: hasCert ? nameC : null,
      content_coords: hasCert ? contentC : null,
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
      wide
      title={activity ? t("editActivity") : t("addActivity")}
      footer={
        <div className="space-y-2">
          {err && <p className="text-sm font-bold text-rose-600">{err}</p>}
          <button form="activity-form" type="submit" className="btn-primary w-full" disabled={busy || uploading}>
            {busy ? t("saving") : t("save")}
          </button>
        </div>
      }
    >
      <form id="activity-form" onSubmit={submit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">{t("activityTitle")}</label>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="label">{t("duration")}</label>
            <input className="input" value={duration} onChange={(e) => setDuration(e.target.value)} />
          </div>
          <div>
            <label className="label">{t("sessions")}</label>
            <input type="number" min={1} className="input" value={sessions} onChange={(e) => setSessions(e.target.value)} />
          </div>
          <div>
            <label className="label">{t("location")}</label>
            <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
          <div>
            <label className="label">{t("room")}</label>
            <input className="input" value={room} onChange={(e) => setRoom(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">{t("about")}</label>
            <textarea className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>

        <div className="card">
          <p className="label">{t("hasCert")}</p>
          <div className="flex gap-2">
            <button type="button" className={hasCert ? "btn-secondary btn-sm" : "btn-ghost btn-sm"} onClick={() => setHasCert(true)}>
              {t("yes")}
            </button>
            <button type="button" className={!hasCert ? "btn-secondary btn-sm" : "btn-ghost btn-sm"} onClick={() => setHasCert(false)}>
              {t("no")}
            </button>
          </div>

          {hasCert && (
            <div className="mt-4 space-y-3">
              <div>
                <label className="label">{t("certContent")}</label>
                <textarea className="input" rows={3} value={certText} onChange={(e) => setCertText(e.target.value)} />
              </div>
              <div>
                <label className="label">{t("uploadTemplate")}</label>
                <input type="file" accept="image/png,image/jpeg" onChange={upload} className="input" />
                <p className="mt-1 text-xs opacity-70">{t("badImage")}</p>
                {uploading && <p className="mt-1 text-sm">{t("uploading")}</p>}
              </div>
              {tplUrl && (
                <CertificatePositioner
                  templateUrl={tplUrl}
                  contentText={certText}
                  name={nameC}
                  content={contentC}
                  onChange={(n, c) => {
                    setNameC(n);
                    setContentC(c);
                  }}
                />
              )}
            </div>
          )}
        </div>

      </form>
    </Modal>
  );
}
