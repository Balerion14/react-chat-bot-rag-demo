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

Supabase database setup
```bash
bun run db:migrate
```

The database schema is defined in `db/schema.ts`, and SQL migrations are generated in `drizzle/`.

If your `DATABASE_URL` points to your Supabase Postgres database, applying the Drizzle migrations is enough to create and update the required tables and indexes.

The current migrations also insert seed test data, so running them will create the schema and populate the database with sample records for local development and testing.

Recommended workflow:

1. Update the schema in `db/schema.ts`
2. Generate a migration
3. Apply the migration to Supabase

```bash
bun run db:generate
bun run db:migrate
```

You do not need to manually run raw SQL to create the tables if you use this workflow.

Config .env file

```bash
DATABASE_URL
```

Test:

```bash
curl http://localhost:3001/health
```


This project was created using `bun init` in bun v1.3.9. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
