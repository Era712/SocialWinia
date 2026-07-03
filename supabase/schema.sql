create table if not exists public.giveaways (
  id uuid primary key default gen_random_uuid(),
  platform text not null,
  title text not null,
  description text,
  url text not null unique,
  organizer text,
  follower_count integer,
  is_verified boolean default false,
  posted_at timestamptz,
  category text,
  secondary_categories text[] default '{}',
  tags text[] default '{}',
  prize_value_chf numeric default 0,
  prize_items text[] default '{}',
  entry_methods text[] default '{}',
  end_date date,
  requirements text[] default '{}',
  winner_count integer default 1,
  participants integer default 0,
  visited boolean default false,
  trust_score numeric default 50,
  risk_level text default 'medium',
  processing_method text default 'openai',
  processing_notes text,
  last_seen_at timestamptz default now(),
  scraped_at timestamptz default now()
);

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  subscription_status text not null default 'trial',
  trial_started_at timestamptz not null default now(),
  trial_ends_at timestamptz not null default (now() + interval '4 hours'),
  stripe_customer_id text,
  referral_code text unique,
  referred_by uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.visited_giveaways (
  user_id uuid not null references auth.users(id) on delete cascade,
  giveaway_id uuid not null references public.giveaways(id) on delete cascade,
  visited_at timestamptz not null default now(),
  primary key (user_id, giveaway_id)
);

create index if not exists giveaways_platform_idx on public.giveaways(platform);
create index if not exists giveaways_category_idx on public.giveaways(category);
create index if not exists giveaways_prize_value_chf_idx on public.giveaways(prize_value_chf);
create index if not exists giveaways_scraped_at_idx on public.giveaways(scraped_at desc);
create index if not exists user_profiles_subscription_status_idx on public.user_profiles(subscription_status);
create index if not exists visited_giveaways_user_id_idx on public.visited_giveaways(user_id);

alter table public.giveaways enable row level security;
alter table public.user_profiles enable row level security;
alter table public.visited_giveaways enable row level security;

drop policy if exists "Authenticated users can read giveaways" on public.giveaways;
create policy "Authenticated users can read giveaways"
  on public.giveaways
  for select
  to authenticated
  using (true);

drop policy if exists "Users can read own profile" on public.user_profiles;
create policy "Users can read own profile"
  on public.user_profiles
  for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "Users can create own profile" on public.user_profiles;
create policy "Users can create own profile"
  on public.user_profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.user_profiles;
create policy "Users can update own profile"
  on public.user_profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Users can read own visited giveaways" on public.visited_giveaways;
create policy "Users can read own visited giveaways"
  on public.visited_giveaways
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can create own visited giveaways" on public.visited_giveaways;
create policy "Users can create own visited giveaways"
  on public.visited_giveaways
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own visited giveaways" on public.visited_giveaways;
create policy "Users can update own visited giveaways"
  on public.visited_giveaways
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant usage on schema public to anon, authenticated, service_role;

grant select on public.giveaways to authenticated;
grant all privileges on public.giveaways to service_role;

grant select, insert, update on public.user_profiles to authenticated;
grant all privileges on public.user_profiles to service_role;

grant select, insert, update, delete on public.visited_giveaways to authenticated;
grant all privileges on public.visited_giveaways to service_role;
