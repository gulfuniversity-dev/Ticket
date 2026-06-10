-- ============================================================
-- Gulf University Graduation E-Ticket & QR Check-in System
-- Database schema (PostgreSQL / Supabase)
-- ============================================================
-- Safe to run multiple times (idempotent).

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------
-- users : admin & gate staff accounts
-- ----------------------------------------------------------------
create table if not exists users (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text not null unique,
  password    text not null,                 -- bcrypt hash
  role        text not null check (role in ('admin', 'gate_staff')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------
-- students : imported graduating students
-- ----------------------------------------------------------------
create table if not exists students (
  id                uuid primary key default gen_random_uuid(),
  student_id        text not null unique,
  student_name      text not null,
  email             text,
  phone             text,
  tickets_purchased int  not null default 0,
  last_emailed_at   timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_students_name on students (lower(student_name));

-- Backfill for databases created before the email feature.
alter table students add column if not exists last_emailed_at timestamptz;

-- ----------------------------------------------------------------
-- tickets : one row per generated e-ticket
-- ----------------------------------------------------------------
create table if not exists tickets (
  id             uuid primary key default gen_random_uuid(),
  ticket_id      text not null unique,                 -- human friendly e.g. GU2026-000123
  student_id     text not null references students (student_id) on delete cascade,
  qr_token       text not null unique,                 -- long secure random token (in the QR)
  ticket_number  int  not null,                        -- e.g. 2  (of N)
  total_tickets  int  not null,                         -- N
  status         text not null default 'unused' check (status in ('unused', 'used', 'cancelled')),
  used_at        timestamptz,
  checked_in_by  uuid references users (id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_tickets_student on tickets (student_id);
create index if not exists idx_tickets_status  on tickets (status);
-- qr_token already has a unique index used for fast scan lookups.

-- ----------------------------------------------------------------
-- check_in_logs : immutable audit log of every gate action
-- ----------------------------------------------------------------
create table if not exists check_in_logs (
  id          uuid primary key default gen_random_uuid(),
  ticket_id   text,
  student_id  text,
  action      text not null check (action in (
                'valid_entry', 'already_used', 'invalid_ticket', 'cancelled_ticket',
                'manual_checkin', 'undo_checkin', 'cancel', 'reactivate'
              )),
  scanned_by  uuid references users (id),
  scanned_at  timestamptz not null default now(),
  device_info text
);

create index if not exists idx_logs_scanned_at on check_in_logs (scanned_at desc);
create index if not exists idx_logs_action     on check_in_logs (action);
create index if not exists idx_logs_ticket      on check_in_logs (ticket_id);

-- ----------------------------------------------------------------
-- email_log : audit trail of ticket-delivery emails
-- ----------------------------------------------------------------
create table if not exists email_log (
  id           uuid primary key default gen_random_uuid(),
  student_id   text,
  recipient    text not null,
  ticket_count int,
  status       text not null check (status in ('sent', 'failed')),
  error        text,
  created_at   timestamptz not null default now()
);

create index if not exists idx_email_log_student on email_log (student_id);
create index if not exists idx_email_log_created on email_log (created_at desc);
