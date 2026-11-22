"use client";

import type { CSSProperties } from "react";
import type { Coords } from "@/lib/types";

export function layerStyle(c: Coords, weight: number): CSSProperties {
  return {
    position: "absolute",
    left: `${c.x}%`,
    top: `${c.y}%`,
    width: `${c.w}%`,
    transform: "translate(-50%, -50%)",
    fontFamily: '"SST Arabic", sans-serif',
    fontWeight: weight,
    fontSize: `${c.size}cqw`,
    lineHeight: 1.6,
    color: c.color,
    textAlign: c.align,
    direction: "rtl",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  };
}

/** معاينة الشهادة النهائية: اسم الطالب (Bold) + نص الشهادة (Medium) فوق القالب */
export function CertificateView({
  templateUrl,
  name,
  content,
  nameCoords,
  contentCoords,
}: {
  templateUrl: string;
  name: string;
  content: string;
  nameCoords: Coords;
  contentCoords: Coords;
}) {
  return (
    <div
      className="relative w-full overflow-hidden rounded-lg border border-line bg-white"
      style={{ containerType: "inline-size" } as CSSProperties}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={templateUrl} alt="certificate" crossOrigin="anonymous" className="block w-full select-none" draggable={false} />
      <div style={layerStyle(nameCoords, 700)}>{name}</div>
      {content.trim() && <div style={layerStyle(contentCoords, 500)}>{content}</div>}
    </div>
  );
}
