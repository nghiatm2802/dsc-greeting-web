-- =====================================================================
--  một lời chúc — Supabase schema
--  Bước 1: dán toàn bộ file này vào Supabase Dashboard → SQL Editor → Run.
--  Bước 2: chạy tiếp file supabase/members.local.sql (chứa email thật, KHÔNG commit).
--  Chạy lại nhiều lần vẫn an toàn.
-- =====================================================================

-- ---------- Bảng ----------
create table if not exists public.members (
  member_id text primary key,                 -- phải trùng "id" trong js/config.js
  email     text not null unique,             -- lưu chữ thường
  role      text not null default 'member' check (role in ('member', 'admin'))
);

create table if not exists public.wishes (
  id           uuid primary key default gen_random_uuid(),
  recipient_id text not null references public.members(member_id) on delete cascade,
  sender_name  text check (sender_name is null or char_length(sender_name) <= 60),
  message      text not null check (char_length(btrim(message)) between 1 and 1000),
  created_at   timestamptz not null default now()
);

create index if not exists wishes_recipient_idx on public.wishes (recipient_id);

alter table public.members enable row level security;
alter table public.wishes  enable row level security;

-- ---------- Hàm hỗ trợ ----------
create or replace function public.current_email()
returns text language sql stable as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.members
    where email = public.current_email() and role = 'admin'
  )
$$;

create or replace function public.my_member_id()
returns text language sql stable security definer set search_path = public as $$
  select member_id from public.members where email = public.current_email() limit 1
$$;

create or replace function public.is_recipient(rid text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where member_id = rid and role = 'member')
$$;

-- Số lời chúc mỗi người nhận được (công khai, không lộ nội dung)
create or replace function public.wish_counts()
returns table (recipient_id text, total bigint)
language sql stable security definer set search_path = public as $$
  select w.recipient_id, count(*) from public.wishes w group by w.recipient_id
$$;

grant execute on function public.current_email()    to anon, authenticated;
grant execute on function public.is_admin()         to anon, authenticated;
grant execute on function public.my_member_id()     to anon, authenticated;
grant execute on function public.is_recipient(text) to anon, authenticated;
grant execute on function public.wish_counts()      to anon, authenticated;

-- ---------- Quyền ----------
grant insert on public.wishes  to anon, authenticated;
grant select on public.wishes  to authenticated;
grant select on public.members to authenticated;

drop policy if exists "members: read own row or admin" on public.members;
create policy "members: read own row or admin" on public.members
  for select to authenticated
  using (email = public.current_email() or public.is_admin());

drop policy if exists "wishes: anyone can send" on public.wishes;
create policy "wishes: anyone can send" on public.wishes
  for insert to anon, authenticated
  with check (public.is_recipient(recipient_id));

drop policy if exists "wishes: recipient or admin can read" on public.wishes;
create policy "wishes: recipient or admin can read" on public.wishes
  for select to authenticated
  using (public.is_admin() or recipient_id = public.my_member_id());

-- Không có policy update/delete → client không sửa/xoá được.
