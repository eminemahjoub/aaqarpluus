# CRM Platform

A modern CRM platform and admin panel built as a monorepo with Next.js, Shadcn UI, Tailwind CSS, and PostgreSQL.

## Folder Structure

```
crm-platform/
├── apps/
│   └── web/                   # Next.js CRM & Admin Panel
├── docs/                      # Project documentation
└── README.md
```

## Prerequisites

- **Node.js** v18+
- **pnpm** — [install](https://pnpm.io/installation)
- **Docker** + **Docker Compose**

## Setup

### 1. Configure environment variables

```bash
cd apps/web
cp .env.example .env.local
```

If you run without Docker, keep `DB_HOST=127.0.0.1`. If you run with Docker Compose, the `web` container uses `apps/web/.env.docker` (it sets `DB_HOST=db`).

### 2. Run with Docker Compose (recommended)

```bash
docker compose up --build
```

App runs at `http://localhost:3001`.
# aaqarpluus
