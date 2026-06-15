create table if not exists dining_merchants (
  id text primary key,
  name text not null,
  zone text not null,
  source text default 'meituan',
  rating numeric default 0,
  monthly_sales integer default 0,
  heat integer default 0,
  scene_tags text[] default '{}',
  custom_tags text[] default '{}',
  updated_at timestamptz default now()
);

create table if not exists dining_dishes (
  id text primary key,
  merchant_id text references dining_merchants(id) on delete cascade,
  name text not null,
  calories integer default 0,
  price numeric default 0,
  heat integer default 0,
  tags text[] default '{}',
  ingredients text[] default '{}',
  updated_at timestamptz default now()
);

alter table dining_merchants enable row level security;
alter table dining_dishes enable row level security;

create policy "public read dining_merchants"
on dining_merchants for select
using (true);

create policy "public insert dining_merchants"
on dining_merchants for insert
with check (true);

create policy "public update dining_merchants"
on dining_merchants for update
using (true)
with check (true);

create policy "public read dining_dishes"
on dining_dishes for select
using (true);

create policy "public insert dining_dishes"
on dining_dishes for insert
with check (true);

create policy "public update dining_dishes"
on dining_dishes for update
using (true)
with check (true);
