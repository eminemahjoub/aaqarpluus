# CRM Platform

A modern CRM platform and admin panel built as a monorepo with Next.js, Shadcn UI, Tailwind CSS, and Supabase.

## Folder Structure

```
crm-platform/
├── apps/
│   └── web/                   # Next.js CRM & Admin Panel
├── shared/
│   └── supabase/              # Supabase CLI project
│       ├── config.toml
│       └── migrations/        # SQL migration files (managed via Supabase CLI)
├── docs/                      # Project documentation
└── README.md
```

## Prerequisites

- **Node.js** v18+
- **pnpm** — [install](https://pnpm.io/installation)
- **Supabase CLI** — [install](https://supabase.com/docs/guides/cli/getting-started)

## Setup

### 1. Install dependencies

```bash
cd apps/web
pnpm install
```

### 2. Configure environment variables

```bash
cd apps/web
cp .env.example .env.local
```

Fill in your Supabase project credentials in `.env.local`.

### 3. Run the development server

```bash
cd apps/web
pnpm dev
```

App runs at `http://localhost:3000`.

## Supabase CLI

All database migrations live in `shared/supabase/migrations/` and are managed via the Supabase CLI.

### Start local Supabase

```bash
cd shared/supabase
supabase start
```

### Create a new migration

```bash
cd shared/supabase
supabase migration new <migration_name>
```

### Apply migrations to remote

```bash
cd shared/supabase
supabase db push
```

### Stop local Supabase

```bash
cd shared/supabase
supabase stop
```

> All Supabase CLI commands should be run from `shared/supabase/` so the CLI resolves `config.toml` correctly.
# aaqarpluus
