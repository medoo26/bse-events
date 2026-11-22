"use client";

import Link from "next/link";
import { ReactNode, useEffect } from "react";
import { useApp } from "./Providers";

export function Logo({ className = "h-12" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.png"
      alt="BSE"
      className={`${className} w-auto rounded-xl object-contain dark:bg-white dark:p-1`}
    />
  );
}

export function ThemeLangButtons() {
  const { dark, toggleDark, lang, setLang, t } = useApp();
  return (
    <>
      <button className="btn-ghost btn-sm" onClick={toggleDark} aria-label="theme">
        {dark ? "☀️" : "🌙"} <span className="hidden sm:inline">{dark ? t("lightMode") : t("darkMode")}</span>
      </button>
      <button className="btn-ghost btn-sm" onClick={() => setLang(lang === "ar" ? "en" : "ar")} aria-label="language">
        🌐 {t("langSwitch")}
      </button>
    </>
  );
}

export function TopBar({ left, right, homeHref = "/" }: { left?: ReactNode; right?: ReactNode; homeHref?: string }) {
  const { t } = useApp();
  return (
    <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-2 border-b-2 border-line bg-page/95 px-3 py-2 backdrop-blur sm:gap-3 sm:px-4 sm:py-3">
      <div className="flex min-w-0 items-center gap-3">
        <Link href={homeHref} className="flex min-w-0 items-center gap-3">
          <Logo className="h-10 sm:h-12" />
          <span className="hidden truncate text-lg font-bold text-head lg:inline">{t("school")}</span>
        </Link>
        {left}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {right}
        <ThemeLangButtons />
      </div>
    </header>
  );
}

/**
 * نافذة منبثقة متجاوبة: على الجوال تظهر كورقة من الأسفل بكامل الارتفاع تقريبا،
 * المحتوى يتمرر داخلها، والأزرار (footer) ثابتة أسفلها فلا تختفي أبدا.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const { t } = useApp();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className={`flex max-h-[100dvh] w-full flex-col overflow-hidden rounded-t-2xl border-2 border-line bg-page shadow-2xl sm:max-h-[92dvh] sm:rounded-2xl ${
          wide ? "sm:max-w-5xl" : "sm:max-w-lg"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b-2 border-line px-4 py-3">
          <h2 className="min-w-0 break-words text-lg font-bold text-head sm:text-xl">{title}</h2>
          <button className="btn-ghost btn-sm shrink-0" onClick={onClose}>
            ✕ <span className="hidden sm:inline">{t("close")}</span>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">{children}</div>
        {footer && (
          <div className="shrink-0 border-t-2 border-line bg-page px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
