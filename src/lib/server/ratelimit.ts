import { admin } from "./admin";

/** يعيد عدد الثواني المتبقية للحظر، أو 0 إن كان مسموحا */
export async function lockedFor(key: string): Promise<number> {
  const { data } = await admin().from("auth_attempts").select("locked_until").eq("key", key).maybeSingle();
  if (data?.locked_until) {
    const left = Math.ceil((new Date(data.locked_until).getTime() - Date.now()) / 1000);
    if (left > 0) return left;
  }
  return 0;
}

/** يسجل محاولة فاشلة؛ عند بلوغ الحد يقفل المفتاح lockMin دقيقة */
export async function recordFail(key: string, max: number, windowMin: number, lockMin: number) {
  const db = admin();
  const { data } = await db.from("auth_attempts").select("fails, updated_at").eq("key", key).maybeSingle();
  const fresh = data && Date.now() - new Date(data.updated_at).getTime() < windowMin * 60_000;
  const fails = (fresh ? data!.fails : 0) + 1;
  await db.from("auth_attempts").upsert({
    key,
    fails: fails >= max ? 0 : fails,
    locked_until: fails >= max ? new Date(Date.now() + lockMin * 60_000).toISOString() : null,
    updated_at: new Date().toISOString(),
  });
}

export async function clearFails(key: string) {
  await admin().from("auth_attempts").delete().eq("key", key);
}
