"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { useApp } from "@/components/Providers";
import { TopBar } from "@/components/TopBar";
import { api } from "@/lib/api";

export default function StudentLoginPage() {
  const { t } = useApp();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr("");
    if (!username.trim() || !password) return setErr(t("fillAll"));
    setBusy(true);
    const r = await api("/api/student/login", { username: username.trim(), password });
    setBusy(false);
    if (r.status === 429) return setErr(t("tooMany"));
    if (!r.ok) return setErr(r.status === 401 ? t("badLogin") : t("error"));
    router.push("/student-dashboard");
  };

  return (
    <div className="min-h-screen">
      <TopBar />
      <main className="mx-auto max-w-md px-4 py-12">
        <h1 className="mb-6 text-center text-3xl font-bold text-head">{t("loginTitle")}</h1>
        <form onSubmit={submit} className="card space-y-4">
          <div>
            <label className="label">{t("username")}</label>
            <input className="input" dir="ltr" autoCapitalize="none" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div>
            <label className="label">{t("password")}</label>
            <input type="password" className="input" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {err && <p className="font-bold text-rose-600">{err}</p>}
          <button className="btn-primary w-full !py-4 !text-xl" disabled={busy}>
            {busy ? t("loading") : t("login")}
          </button>
          <Link href="/register" className="block text-center font-bold text-brand-secondary underline">
            {t("noAccount")}
          </Link>
        </form>
      </main>
    </div>
  );
}
