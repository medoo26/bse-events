import { createClient } from "@supabase/supabase-js";

// المتصفح يستخدم المفتاح العام فقط لاستقبال إشعارات Realtime (Broadcast) الخالية من البيانات.
// لا يملك أي صلاحية على الجداول (RLS مغلق). كل البيانات تأتي من API الخادم.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

export const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { params: { eventsPerSecond: 5 } },
});

/** يستدعي cb عند أي إشعار تغيير، مع تحديث احتياطي دوري. يعيد دالة لإلغاء الاشتراك. */
export function watch(cb: () => void, fallbackMs = 20000) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const debounced = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(cb, 250);
  };
  const ch = supabase
    .channel("bse", { config: { broadcast: { self: false } } })
    .on("broadcast", { event: "changed" }, debounced)
    .subscribe();
  const iv = setInterval(cb, fallbackMs);
  return () => {
    if (timer) clearTimeout(timer);
    clearInterval(iv);
    supabase.removeChannel(ch);
  };
}
