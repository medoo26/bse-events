"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useApp } from "@/components/Providers";
import { Modal, TopBar } from "@/components/TopBar";
import { api } from "@/lib/api";

const IDLE_MS = 120_000;

export default function LoginPage() {
  const { t } = useApp();
  const router = useRouter();
  const [origin, setOrigin] = useState("");
  const [codeOpen, setCodeOpen] = useState(false);
  const [code, setCode] = useState("");
  const [bad, setBad] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setOrigin(process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || window.location.origin);
  }, []);

  // مؤقت الخمول: 120 ثانية دون أي تفاعل -> العودة للواجهة الرئيسية
  useEffect(() => {
    const reset = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.push("/"), IDLE_MS);
    };
    const events = ["pointerdown", "pointermove", "click", "keydown", "touchstart", "scroll", "wheel"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      events.forEach((e) => window.removeEventListener(e, reset));
      if (timer.current) clearTimeout(timer.current);
    };
  }, [router]);

  const [msg, setMsg] = useState("");
  const [checking, setChecking] = useState(false);
  const submitCode = async (e: FormEvent) => {
    e.preventDefault();
    if (!code) return;
    setChecking(true);
    const r = await api("/api/organizer/login", { code });
    setChecking(false);
    if (r.ok) return router.push("/organizer");
    setBad(true);
    setMsg(r.status === 429 ? t("tooMany") : t("wrongCode"));
  };

  const registerUrl = `${origin}/register`;

  return (
    <div className="min-h-screen">
      <TopBar
        right={
          <button className="btn-primary btn-sm" onClick={() => setCodeOpen(true)}>
            🔒 {t("organizerLogin")}
          </button>
        }
      />
      <main className="flex flex-col items-center px-4 py-5 text-center sm:py-8">
        <p className="mb-3 text-lg font-bold text-head sm:text-xl md:text-2xl">{t("scanQr")}</p>
        <Link
          href="/register"
          className="rounded-3xl border-4 border-brand-primary bg-white p-3 shadow-xl sm:p-5 transition hover:scale-[1.02]"
          aria-label="register"
        >
          <div style={{ width: "min(78vw, 52vh, 420px)", minWidth: 200 }}>
            {origin ? (
              <QRCodeSVG value={registerUrl} size={420} level="M" fgColor="#1B2A6B" bgColor="#ffffff" style={{ width: "100%", height: "auto", display: "block" }} />
            ) : (
              <div style={{ aspectRatio: "1 / 1" }} />
            )}
          </div>
        </Link>
        <p dir="ltr" className="mt-3 max-w-full break-all px-2 text-xs opacity-60 sm:text-sm">
          {registerUrl}
        </p>
        <Link href="/student-login" className="btn-secondary mt-6 max-w-full !px-8 !py-4 !text-xl sm:mt-8 sm:!px-12 sm:!py-5 sm:!text-2xl">
          {t("studentLogin")}
        </Link>
        <p className="mt-6 text-sm opacity-60">{t("idleNote")}</p>
      </main>

      <Modal open={codeOpen} onClose={() => { setCodeOpen(false); setBad(false); setCode(""); }} title={t("orgCodeTitle")}>
        <form onSubmit={submitCode} className="space-y-3">
          <input
            autoFocus
            type="password"
            inputMode="numeric"
            className="input text-center text-2xl tracking-widest"
            value={code}
            onChange={(e) => { setCode(e.target.value); setBad(false); }}
          />
          {bad && <p className="text-center font-bold text-rose-600">{msg}</p>}
          <button className="btn-primary w-full" disabled={checking}>{t("confirm")}</button>
        </form>
      </Modal>
    </div>
  );
}
