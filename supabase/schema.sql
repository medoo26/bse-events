-- =====================================================================
-- نظام إدارة الفعاليات المدرسية - مدارس ريادة الأعمال ثنائية اللغة
-- النسخة الآمنة (Hardened). شغّل الملف كاملا في Supabase: SQL Editor > New query > Run
-- آمن للتشغيل على قاعدة جديدة أو على قاعدة سبق إنشاؤها بالنسخة القديمة (يرقّيها).
--
-- النموذج الأمني:
--   * كل جداول التطبيق عليها RLS مفعّل وبلا أي سياسة للمفتاح العام (anon)،
--     وسحبت عنها صلاحيات anon/authenticated بالكامل.
--   * كل القراءة والكتابة تتم من خادم Next.js فقط عبر مفتاح service_role
--     (SUPABASE_SERVICE_ROLE_KEY) بعد التحقق من جلسة المنظم/الطالب.
--   * المتصفح يستخدم المفتاح العام فقط لاستقبال إشعارات Realtime (Broadcast) الخالية من البيانات.
-- =====================================================================

create extension if not exists pgcrypto;

-- 1) الفعاليات ---------------------------------------------------------
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  duration text,
  event_date date not null default current_date,
  end_time timestamptz not null,
  status text not null default 'active' check (status in ('active', 'ended')),
  created_at timestamptz not null default now()
);

-- 2) الأنشطة -----------------------------------------------------------
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  title text not null,
  description text,
  duration text,
  sessions_count int not null default 1 check (sessions_count >= 1 and sessions_count <= 20),
  location text,
  room_number text,
  has_certificate boolean not null default false,
  certificate_content text,
  certificate_template_url text,
  name_coords jsonb,
  content_coords jsonb,
  is_started boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists activities_event_idx on public.activities(event_id);

-- 3) حسابات الطلاب المؤقتة --------------------------------------------
-- كلمة المرور تخزن مشفرة (bcrypt) في password_hash ولا تخزن نصا مكشوفا أبدا.
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  is_school_student boolean not null default true,
  grade_level text,
  username text not null unique,
  password_hash text,
  created_at timestamptz not null default now()
);
-- ترقية من النسخة القديمة: إضافة العمود الجديد وحذف كلمات المرور النصية نهائيا
alter table public.students add column if not exists password_hash text;
alter table public.students drop column if exists password;
-- حسابات قديمة بلا hash لا يمكنها الدخول (تُحذف لأنها مؤقتة أصلا)
delete from public.students where password_hash is null;
alter table public.students alter column password_hash set not null;

-- 4) التسجيل والحضور ---------------------------------------------------
create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  student_id uuid references public.students(id) on delete cascade,
  manual_student_name text,
  manual_is_school_student boolean,
  manual_grade_level text,
  attendance_sessions jsonb not null default '{}'::jsonb,
  certificate_issued boolean not null default false,
  issued_at timestamptz,
  created_at timestamptz not null default now(),
  constraint reg_has_student check (student_id is not null or manual_student_name is not null)
);
create unique index if not exists registrations_unique_student
  on public.registrations(activity_id, student_id) where student_id is not null;
create index if not exists registrations_activity_idx on public.registrations(activity_id);
create index if not exists registrations_student_idx on public.registrations(student_id);

-- 5) الأرشيف الدائم (لا يحذف أبدا) ------------------------------------
create table if not exists public.activity_archives (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid unique references public.activities(id) on delete set null,
  event_title text,
  activity_title text,
  activity_description text,
  activity_date date,
  attendance_snapshot jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- الأرشيف لا يحذف أبدا: حذف النشاط أو الفعالية يفك الارتباط فقط (set null) ويبقى السجل كاملا.
-- ترقية القواعد القديمة (كان الارتباط cascade فيحذف الأرشيف):
alter table public.activity_archives alter column activity_id drop not null;
alter table public.activity_archives drop constraint if exists activity_archives_activity_id_fkey;
alter table public.activity_archives
  add constraint activity_archives_activity_id_fkey
  foreign key (activity_id) references public.activities(id) on delete set null;

-- 6) محاولات الدخول (لحد المحاولات Rate Limiting) -----------------------
create table if not exists public.auth_attempts (
  key text primary key,
  fails int not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- تسجيل حضور جلسة بشكل ذري (يمنع تضارب التحديثات)
-- ---------------------------------------------------------------------
create or replace function public.set_attendance(p_reg uuid, p_session text, p_value boolean)
returns void
language sql
security invoker
set search_path = public
as $$
  update public.registrations
     set attendance_sessions = coalesce(attendance_sessions, '{}'::jsonb) || jsonb_build_object(p_session, p_value)
   where id = p_reg;
$$;

-- ---------------------------------------------------------------------
-- تحديث الأرشيف: نسخة كاملة من الحضور (بالأسماء) لنشاط واحد
-- ---------------------------------------------------------------------
create or replace function public.refresh_activity_archive(p_activity uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_act public.activities%rowtype;
  v_evt public.events%rowtype;
  v_snap jsonb;
begin
  select * into v_act from public.activities where id = p_activity;
  if not found then return; end if;
  select * into v_evt from public.events where id = v_act.event_id;

  select jsonb_build_object(
    'sessions_count', v_act.sessions_count,
    'students', coalesce(jsonb_agg(
      jsonb_build_object(
        'name', coalesce(s.full_name, r.manual_student_name),
        'is_school_student', coalesce(s.is_school_student, r.manual_is_school_student),
        'grade_level', coalesce(s.grade_level, r.manual_grade_level),
        'attendance', r.attendance_sessions,
        'certificate_issued', r.certificate_issued
      ) order by r.created_at
    ) filter (where r.id is not null), '[]'::jsonb)
  )
  into v_snap
  from public.registrations r
  left join public.students s on s.id = r.student_id
  where r.activity_id = p_activity;

  insert into public.activity_archives
    (activity_id, event_title, activity_title, activity_description, activity_date, attendance_snapshot, updated_at)
  values
    (p_activity, v_evt.title, v_act.title, v_act.description, v_evt.event_date, coalesce(v_snap, '{}'::jsonb), now())
  on conflict (activity_id) do update set
    event_title = excluded.event_title,
    activity_title = excluded.activity_title,
    activity_description = excluded.activity_description,
    activity_date = excluded.activity_date,
    attendance_snapshot = excluded.attendance_snapshot,
    updated_at = now();
end;
$$;

-- ---------------------------------------------------------------------
-- الحذف التلقائي
--  (أ) حسابات الطلاب بعد 48 ساعة من انتهاء فعاليتهم (مع تسجيلاتهم وشهاداتهم).
--  (ب) أي حساب مضى على إنشائه أكثر من 7 أيام ولم يسجل في أي نشاط.
--  (ج) تنظيف سجل محاولات الدخول القديمة.
-- لا يلمس أبدا: events, activities, activity_archives (ويؤرشف الأنشطة قبل الحذف).
-- ---------------------------------------------------------------------
create or replace function public.cleanup_expired_students()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_act record;
  v_expired int := 0;
  v_orphans int := 0;
begin
  update public.events set status = 'ended'
   where status = 'active' and end_time < now();

  for v_act in
    select a.id
    from public.activities a
    join public.events e on e.id = a.event_id
    where e.end_time + interval '48 hours' < now()
  loop
    perform public.refresh_activity_archive(v_act.id);
  end loop;

  -- (أ) طلاب كل فعالياتهم انتهت منذ أكثر من 48 ساعة
  with expired as (
    select r.student_id
    from public.registrations r
    join public.activities a on a.id = r.activity_id
    join public.events e on e.id = a.event_id
    where r.student_id is not null
    group by r.student_id
    having bool_and(e.end_time + interval '48 hours' < now())
  ), del as (
    delete from public.students s using expired x
    where s.id = x.student_id
    returning s.id
  )
  select count(*) into v_expired from del;

  -- (ب) حسابات بلا أي تسجيل مضى عليها أكثر من 7 أيام
  with del as (
    delete from public.students s
    where s.created_at < now() - interval '7 days'
      and not exists (select 1 from public.registrations r where r.student_id = s.id)
    returning s.id
  )
  select count(*) into v_orphans from del;

  -- (ج) تنظيف محاولات الدخول القديمة
  delete from public.auth_attempts where updated_at < now() - interval '1 day';

  return coalesce(v_expired, 0) + coalesce(v_orphans, 0);
end;
$$;

-- الجدولة كل ساعة عبر pg_cron
do $$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule('cleanup-expired-students')
    where exists (select 1 from cron.job where jobname = 'cleanup-expired-students');
  perform cron.schedule('cleanup-expired-students', '0 * * * *', 'select public.cleanup_expired_students();');
exception when others then
  raise notice 'تعذر تفعيل pg_cron تلقائيا: فعّله من Database > Extensions ثم أعد تشغيل الملف. (%)', sqlerrm;
end $$;

-- ---------------------------------------------------------------------
-- Realtime: لم نعد نبث تغييرات الجداول (قد تحوي بيانات طلاب).
-- التحديث اللحظي يتم عبر قناة Broadcast خالية من البيانات يرسلها الخادم.
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['events','activities','students','registrations','activity_archives'] loop
    begin
      execute format('alter publication supabase_realtime drop table public.%I', t);
    exception when others then null;
    end;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- RLS: مفعّل على كل الجداول، مع حذف السياسات المفتوحة القديمة، وبلا أي سياسة جديدة
-- (أي: anon و authenticated لا يصلان لأي صف. خادم Next.js يتجاوز RLS بمفتاح service_role).
-- ---------------------------------------------------------------------
alter table public.events enable row level security;
alter table public.activities enable row level security;
alter table public.students enable row level security;
alter table public.registrations enable row level security;
alter table public.activity_archives enable row level security;
alter table public.auth_attempts enable row level security;

do $$
declare t text;
begin
  foreach t in array array['events','activities','students','registrations','activity_archives','auth_attempts'] loop
    execute format('drop policy if exists "open_all_%1$s" on public.%1$I', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- التخزين: حاوية قوالب الشهادات
--  * القراءة عامة (روابط الصور العامة) لعرض الشهادات.
--  * الرفع لا يتم إلا بروابط رفع موقعة يصدرها الخادم للمنظم فقط (لا سياسة رفع لـ anon).
--  * صور فقط (JPEG/PNG) وبحد أقصى 5MB تفرضه Supabase Storage نفسه.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('certificate-templates', 'certificate-templates', true, 5242880, array['image/jpeg', 'image/png'])
on conflict (id) do update set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png'];

drop policy if exists "templates_read" on storage.objects;
drop policy if exists "templates_insert" on storage.objects;
drop policy if exists "templates_update" on storage.objects;

-- ---------------------------------------------------------------------
-- الصلاحيات: سحب كل شيء من anon/authenticated، وإبقاؤه لـ service_role فقط.
-- (يوضع في النهاية ليشمل كل ما أنشئ أعلاه)
-- ---------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated;
