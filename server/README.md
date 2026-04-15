# server

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run start
OR
bun run dev
TEST: curl http://localhost:3001/hello
```

Drizzle workflow

```bash
bun run db:generate
bun run db:migrate
bun run db:push
bun run db:studio
```

Setup BDD supabase
```bash
-- Optional but safe in many Supabase projects
create extension if not exists pgcrypto;

-- =========================================================
-- TABLES
-- =========================================================

create table if not exists properties (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  created_at timestamptz not null default now()
);

create table if not exists reservations (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  guest_name text not null,
  guest_language text not null default 'en',
  check_in_date date,
  check_out_date date,
  created_at timestamptz not null default now()
);

create table if not exists knowledge_items (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  category text not null,
  title text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists chat_runs (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid references reservations(id) on delete cascade,
  user_message text not null,
  detected_intent text,
  filter boolean not null default false,
  need_to_retrieve_context boolean not null default false,
  retrieved_context jsonb,
  first_response jsonb,
  guardrail_status text,
  final_reply jsonb,
  created_at timestamptz not null default now()
);

-- =========================================================
-- INDEXES
-- =========================================================

create index if not exists idx_reservations_property_id
  on reservations(property_id);

create index if not exists idx_knowledge_items_property_id
  on knowledge_items(property_id);

create index if not exists idx_chat_runs_reservation_id
  on chat_runs(reservation_id);

create index if not exists idx_chat_runs_created_at
  on chat_runs(created_at desc);

create index if not exists idx_knowledge_items_category
  on knowledge_items(category);

-- =========================================================
-- SAMPLE DATA
-- =========================================================

insert into properties (name, address)
values
  ('Ocean View Apartment', '12 Seaside Road, Brighton, UK'),
  ('Central London Studio', '48 Camden Street, London, UK')
on conflict do nothing;

insert into reservations (
  property_id,
  guest_name,
  guest_language,
  check_in_date,
  check_out_date
)
select
  p.id,
  x.guest_name,
  x.guest_language,
  x.check_in_date,
  x.check_out_date
from (
  values
    ('Ocean View Apartment', 'Alice Martin', 'en', date '2026-04-20', date '2026-04-24'),
    ('Ocean View Apartment', 'Jean Dupont', 'fr', date '2026-05-02', date '2026-05-06'),
    ('Central London Studio', 'Maria Garcia', 'es', date '2026-04-18', date '2026-04-21')
) as x(property_name, guest_name, guest_language, check_in_date, check_out_date)
join properties p on p.name = x.property_name;

insert into knowledge_items (
  property_id,
  category,
  title,
  content
)
select
  p.id,
  x.category,
  x.title,
  x.content
from (
  values
    (
      'Ocean View Apartment',
      'check_in',
      'Check-in instructions',
      'Check-in starts at 3 PM. The key is in the lockbox next to the blue gate.'
    ),
    (
      'Ocean View Apartment',
      'wifi',
      'Wi-Fi access',
      'Wi-Fi name: OceanViewGuest. Password: Welcome2026'
    ),
    (
      'Ocean View Apartment',
      'house_rules',
      'House rules',
      'No smoking. No parties. Quiet hours after 10 PM.'
    ),
    (
      'Central London Studio',
      'check_out',
      'Check-out instructions',
      'Check-out is at 11 AM. Please leave the keys on the kitchen table.'
    ),
    (
      'Central London Studio',
      'transport',
      'Nearby transport',
      'The nearest station is Camden Town, around 7 minutes on foot.'
    )
) as x(property_name, category, title, content)
join properties p on p.name = x.property_name;
```

Config .env file

```bash
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

Test:

```bash
curl http://localhost:3001/knowledge-items
```


This project was created using `bun init` in bun v1.3.9. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
