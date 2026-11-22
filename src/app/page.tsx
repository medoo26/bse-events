"use client";

import Link from "next/link";
import { useApp } from "@/components/Providers";
import { Logo, ThemeLangButtons } from "@/components/TopBar";

export default function HomePage() {
  const { t } = useApp();
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-soft to-page px-6 text-center">
      <div className="absolute end-4 top-4 flex gap-2">
        <ThemeLangButtons />
      </div>
      <Logo className="h-28 sm:h-40 md:h-56" />
      <h1 className="mt-8 text-3xl font-bold text-head sm:text-4xl md:text-6xl">{t("welcome")}</h1>
      <p className="mt-3 text-lg font-bold text-brand-secondary sm:text-xl md:text-3xl">{t("school")}</p>
      <p className="mt-2 text-lg opacity-80">{t("welcomeSub")}</p>
      <Link
        href="/login"
        className="btn-primary mt-10 !rounded-3xl !px-8 !py-6 !text-2xl shadow-xl sm:!px-16 sm:!py-8 sm:!text-3xl md:!px-24 md:!py-10 md:!text-5xl"
      >
        {t("enterEvents")}
      </Link>
    </main>
  );
}
