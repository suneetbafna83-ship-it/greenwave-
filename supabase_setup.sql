-- ════════════════════════════════════════════════════════════════
-- GreenWave 3D · Supabase setup
-- Paste this whole file into Supabase → SQL Editor → Run.
-- Creates the `emergency_dispatches` table and DISABLES RLS so the
-- browser (anon key) can read/write during hackathon testing.
-- ⚠️  Re-enable RLS with proper policies before going to production.
-- ════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

create table if not exists public.emergency_dispatches (
  id                            uuid primary key default gen_random_uuid(),
  created_at                    timestamptz not null default now(),
  incident_type                 text        not null default 'Critical Ambulance Dispatch',
  sector                        text        not null default 'Sector 4',
  congestion_severity           integer     not null check (congestion_severity between 0 and 100),
  optimal_corridor_path         jsonb       not null default '[]'::jsonb,
  estimated_time_saved_minutes  numeric(6,2) not null default 0,
  standard_eta_minutes          numeric(6,2),
  greenwave_eta_minutes         numeric(6,2),
  ai_dispatch_note              text,
  source                        text        not null default 'war-room',
  status                        text        not null default 'dispatched'
);

create index if not exists emergency_dispatches_created_at_idx
  on public.emergency_dispatches (created_at desc);

-- Hackathon mode: no row level security
alter table public.emergency_dispatches disable row level security;

-- Allow the public anon / authenticated roles to use the table
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.emergency_dispatches to anon, authenticated;

-- Optional: a few seed rows so the analytics table is not empty
insert into public.emergency_dispatches
  (incident_type, sector, congestion_severity, optimal_corridor_path, estimated_time_saved_minutes, standard_eta_minutes, greenwave_eta_minutes, ai_dispatch_note, source)
values
  ('Cardiac Arrest Response', 'Sector 4', 91, '["Ring Rd × Harbor Ave","Ring Rd × Tech Park Ave","Ring Rd × Central Ave","Lotus Ln × Central Ave","MG Rd × Central Ave"]'::jsonb, 12.10, 18.40, 6.30, 'Hold cross-traffic on Ring Rd for 40s and flush Central Ave northbound.', 'seed'),
  ('Multi-Vehicle Collision', 'Sector 2', 84, '["Park St × Metro Ave","Park St × Central Ave","MG Rd × Central Ave"]'::jsonb, 9.60, 16.10, 6.50, 'Divert eastbound flow to Lotus Ln; pre-flush Central Ave junctions.', 'seed'),
  ('VIP Medical Transport', 'Sector 6', 72, '["Lake Rd × Hospital Ave","MG Rd × Hospital Ave"]'::jsonb, 6.80, 12.90, 6.10, 'Stagger Hospital Ave signals at 12s offsets for continuous green.', 'seed');
