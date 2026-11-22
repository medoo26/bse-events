"use client";

import { CSSProperties, useRef, useState } from "react";
import type { Align, Coords } from "@/lib/types";
import { useApp } from "./Providers";
import { layerStyle } from "./CertificateView";

type Which = "name" | "content";

const clamp = (v: number) => Math.min(100, Math.max(0, v));

/**
 * أداة السحب والإفلات لتحديد مكان اسم الطالب ومحتوى الشهادة.
 * تعمل بـ Pointer Events (ماوس + لمس + قلم). الإحداثيات تخزن كنسب مئوية من أبعاد
 * القالب، فتبقى دقيقة مهما تغير حجم الشاشة. أزرار الأسهم للضبط الدقيق على اللمس.
 */
export function CertificatePositioner({
  templateUrl,
  contentText,
  name,
  content,
  onChange,
}: {
  templateUrl: string;
  contentText: string;
  name: Coords;
  content: Coords;
  onChange: (name: Coords, content: Coords) => void;
}) {
  const { t } = useApp();
  const box = useRef<HTMLDivElement>(null);
  const [sel, setSel] = useState<Which>("name");
  const [dragging, setDragging] = useState<Which | null>(null);
  // فرق موضع الإصبع عن مركز المربع لحظة الإمساك (لمنع القفز)
  const grab = useRef({ dx: 0, dy: 0 });
  // آخر قيم لتفادي استخدام قيم قديمة داخل أحداث السحب السريعة
  const latest = useRef({ name, content });
  latest.current = { name, content };

  const cur = sel === "name" ? name : content;

  const emit = (which: Which, patch: Partial<Coords>) => {
    const { name: n, content: c } = latest.current;
    if (which === "name") onChange({ ...n, ...patch }, c);
    else onChange(n, { ...c, ...patch });
  };

  const move = (e: React.PointerEvent) => {
    if (!dragging || !box.current) return;
    const r = box.current.getBoundingClientRect();
    const x = clamp(((e.clientX - r.left - grab.current.dx) / r.width) * 100);
    const y = clamp(((e.clientY - r.top - grab.current.dy) / r.height) * 100);
    emit(dragging, { x: +x.toFixed(2), y: +y.toFixed(2) });
  };

  const start = (which: Which) => (e: React.PointerEvent<HTMLDivElement>) => {
    if (!box.current) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const r = box.current.getBoundingClientRect();
    const c = which === "name" ? latest.current.name : latest.current.content;
    grab.current = {
      dx: e.clientX - r.left - (c.x / 100) * r.width,
      dy: e.clientY - r.top - (c.y / 100) * r.height,
    };
    setDragging(which);
    setSel(which);
  };

  const end = () => setDragging(null);

  const nudge = (dx: number, dy: number) =>
    emit(sel, { x: +clamp(cur.x + dx).toFixed(2), y: +clamp(cur.y + dy).toFixed(2) });

  const layer = (which: Which, c: Coords, weight: number): CSSProperties => ({
    ...layerStyle(c, weight),
    // منطقة لمس لا تقل عن 44px دون تغيير مركز النص (يبقى مطابقا للشهادة النهائية)
    display: "grid",
    alignContent: "center",
    minHeight: 44,
    boxSizing: "border-box",
    outline: `2px dashed ${which === "name" ? "#3474B8" : "#e11d48"}`,
    outlineOffset: 2,
    background: sel === which ? "rgba(52,116,184,0.18)" : "rgba(255,255,255,0.2)",
    cursor: dragging === which ? "grabbing" : "grab",
    touchAction: "none",
    userSelect: "none",
    WebkitUserSelect: "none",
    zIndex: sel === which ? 2 : 1,
    // يمنع النص الطويل من تكبير المربع خارج الشهادة
    overflow: "hidden",
  });

  const sizeBtn = "btn-ghost !min-h-[44px] !min-w-[44px] !px-0 text-xl";

  return (
    <div className="space-y-3">
      <p className="text-sm font-bold text-head">{t("dragHint")}</p>
      <div
        ref={box}
        className="relative w-full select-none overflow-hidden rounded-lg border-2 border-line bg-white"
        style={{ containerType: "inline-size", touchAction: "pan-y" } as CSSProperties}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={templateUrl} alt="template" crossOrigin="anonymous" className="block w-full select-none" draggable={false} />
        <div style={layer("name", name, 700)} onPointerDown={start("name")}>
          {t("nameBox")}
        </div>
        <div style={layer("content", content, 500)} onPointerDown={start("content")}>
          {contentText.trim() || t("contentBox")}
        </div>
      </div>

      <div className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <button type="button" className={sel === "name" ? "btn-secondary btn-sm" : "btn-ghost btn-sm"} onClick={() => setSel("name")}>
              {t("nameBox")}
            </button>
            <button type="button" className={sel === "content" ? "btn-secondary btn-sm" : "btn-ghost btn-sm"} onClick={() => setSel("content")}>
              {t("contentBox")}
            </button>
          </div>
          {/* ضبط دقيق بالأسهم (مفيد على الجوال والآيباد) */}
          <div dir="ltr" className="flex items-center gap-1">
            <button type="button" aria-label="left" className={sizeBtn} onClick={() => nudge(-0.5, 0)}>
              ←
            </button>
            <div className="flex flex-col gap-1">
              <button type="button" aria-label="up" className={`${sizeBtn} !min-h-[40px]`} onClick={() => nudge(0, -0.5)}>
                ↑
              </button>
              <button type="button" aria-label="down" className={`${sizeBtn} !min-h-[40px]`} onClick={() => nudge(0, 0.5)}>
                ↓
              </button>
            </div>
            <button type="button" aria-label="right" className={sizeBtn} onClick={() => nudge(0.5, 0)}>
              →
            </button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">
              {t("fontSize")} ({cur.size.toFixed(1)})
            </label>
            <input
              type="range"
              min={1}
              max={10}
              step={0.1}
              value={cur.size}
              onChange={(e) => emit(sel, { size: +e.target.value })}
              className="h-9 w-full accent-brand-secondary"
            />
          </div>
          <div>
            <label className="label">
              {t("boxWidth")} ({Math.round(cur.w)}%)
            </label>
            <input
              type="range"
              min={10}
              max={100}
              step={1}
              value={cur.w}
              onChange={(e) => emit(sel, { w: +e.target.value })}
              className="h-9 w-full accent-brand-secondary"
            />
          </div>
          <div>
            <label className="label">{t("fontColor")}</label>
            <input
              type="color"
              value={cur.color}
              onChange={(e) => emit(sel, { color: e.target.value })}
              className="h-11 w-full cursor-pointer rounded-lg border-2 border-line bg-page"
            />
          </div>
          <div>
            <label className="label">{t("alignment")}</label>
            <select className="input" value={cur.align} onChange={(e) => emit(sel, { align: e.target.value as Align })}>
              <option value="right">{t("alignRight")}</option>
              <option value="center">{t("alignCenter")}</option>
              <option value="left">{t("alignLeft")}</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
