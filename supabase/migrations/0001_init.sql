-- DevizIA · schéma initial
-- À exécuter dans l'éditeur SQL de Supabase (ou via `supabase db push`).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Salons : un salon par lisseuse, avec sa grille tarifaire et ses réglages.
-- ---------------------------------------------------------------------------
create table public.salons (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid references auth.users (id) on delete set null,
  slug         text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name         text not null check (char_length(name) between 2 and 60),
  planity_url  text,
  deposit      integer not null default 30 check (deposit >= 0),
  range_width  integer not null default 20 check (range_width >= 0),
  -- Lissages proposés : [{ key, name, description, enabled }]
  treatments   jsonb not null default '[
    {"key":"tanin","name":"Tanin","description":"Lisse naturel et brillant","enabled":true},
    {"key":"keratine","name":"Kératine","description":"Discipline et anti-frisottis","enabled":true},
    {"key":"botox","name":"Botox capillaire","description":"Soin profond, effet lissé","enabled":true}
  ]'::jsonb,
  -- Prix de base par lissage et par longueur (épaules → au-delà de la taille)
  grid         jsonb not null default '{
    "tanin":[120,140,160,190,220],
    "keratine":[130,150,170,200,230],
    "botox":[90,110,130,160,190]
  }'::jsonb,
  supplements  jsonb not null default '{
    "volume_medium":15,"volume_dense":30,"curly":15,"coily":30,"bleach":20
  }'::jsonb,
  settings     jsonb not null default '{
    "notify_email":true,"reminder":true,"block_henna":true,"auto_send":false
  }'::jsonb,
  created_at   timestamptz not null default now()
);

create unique index salons_one_per_owner on public.salons (owner_id) where owner_id is not null;

-- ---------------------------------------------------------------------------
-- Brouillons : photos + analyse IA, avant que la cliente envoie sa demande.
-- Accessibles uniquement par le serveur (clé service).
-- ---------------------------------------------------------------------------
create table public.drafts (
  id           uuid primary key default gen_random_uuid(),
  salon_id     uuid not null references public.salons (id) on delete cascade,
  photo_paths  text[] not null default '{}',
  analysis     jsonb not null,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Demandes de devis envoyées par les clientes.
-- ---------------------------------------------------------------------------
create table public.quote_requests (
  id            uuid primary key default gen_random_uuid(),
  salon_id      uuid not null references public.salons (id) on delete cascade,
  draft_id      uuid references public.drafts (id) on delete set null,
  first_name    text not null,
  last_name     text not null,
  phone         text not null,
  email         text not null,
  treatment     text not null,
  -- { nature, nature_subtype, coloring, previous_straightening, henna }
  answers       jsonb not null,
  -- Analyse IA d'origine + corrections éventuelles de la cliente
  analysis      jsonb not null,
  corrections   jsonb not null default '{}'::jsonb,
  blocked       boolean not null default false,
  price_low     integer,
  price_high    integer,
  breakdown     jsonb not null default '[]'::jsonb,
  adjustment    integer not null default 0,
  status        text not null default 'new' check (status in ('new', 'sent', 'archived')),
  photo_paths   text[] not null default '{}',
  consent_at    timestamptz not null,
  created_at    timestamptz not null default now()
);

create index quote_requests_salon_created on public.quote_requests (salon_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Sécurité (RLS) : une lisseuse ne voit et ne modifie que son salon.
-- Les clientes n'écrivent jamais directement : tout passe par les routes API.
-- ---------------------------------------------------------------------------
alter table public.salons enable row level security;
alter table public.drafts enable row level security;
alter table public.quote_requests enable row level security;

create policy "salon: lecture par la propriétaire"
  on public.salons for select to authenticated
  using (owner_id = auth.uid());

create policy "salon: création par la propriétaire"
  on public.salons for insert to authenticated
  with check (owner_id = auth.uid());

create policy "salon: mise à jour par la propriétaire"
  on public.salons for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "demandes: lecture par la propriétaire"
  on public.quote_requests for select to authenticated
  using (salon_id in (select id from public.salons where owner_id = auth.uid()));

create policy "demandes: mise à jour par la propriétaire"
  on public.quote_requests for update to authenticated
  using (salon_id in (select id from public.salons where owner_id = auth.uid()))
  with check (salon_id in (select id from public.salons where owner_id = auth.uid()));

-- La lisseuse ne peut changer que le statut et l'ajustement de prix.
revoke update on public.quote_requests from authenticated;
grant update (status, adjustment) on public.quote_requests to authenticated;

-- ---------------------------------------------------------------------------
-- Stockage des photos : bucket privé, rangé par salon ({salon_id}/{draft_id}/…)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "photos: lecture par la propriétaire du salon"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] in (
      select id::text from public.salons where owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Nettoyage RGPD (à planifier avec pg_cron, voir README) :
--   - brouillons jamais envoyés : supprimés après 24 h
--   - photos des demandes : supprimées après 90 jours
-- ---------------------------------------------------------------------------
create or replace function public.purge_old_data() returns void
language sql security definer set search_path = public as $$
  delete from storage.objects o
  using public.drafts d
  where o.bucket_id = 'photos'
    and d.created_at < now() - interval '24 hours'
    and not exists (select 1 from public.quote_requests q where q.draft_id = d.id)
    and o.name like d.salon_id::text || '/' || d.id::text || '/%';

  delete from public.drafts d
  where d.created_at < now() - interval '24 hours'
    and not exists (select 1 from public.quote_requests q where q.draft_id = d.id);

  delete from storage.objects o
  where o.bucket_id = 'photos'
    and o.created_at < now() - interval '90 days';

  update public.quote_requests
  set photo_paths = '{}'
  where created_at < now() - interval '90 days' and photo_paths <> '{}';
$$;
