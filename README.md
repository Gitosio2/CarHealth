# CarHealth

Maintenance tracking for private vehicle owners. A person registers the vehicles they
own and keeps a history of services, costs, and mileage, so that upcoming or overdue
maintenance is never a guess.

## Status

**Persistence in place, no features yet.** The architecture and technology stack are
decided and documented, the workspace and its architecture boundaries are in place, and
the database schema for all four bounded contexts exists with its first migration and
integration tests. No use cases, repositories or endpoints have been written.

## Getting started

Requires Node 24 (see `.nvmrc`) and pnpm.

```bash
pnpm install
```

| Command | What it does |
|---|---|
| `pnpm arch` | Checks architecture boundaries. Fails on violation |
| `pnpm arch:graph` | Emits the dependency graph in Graphviz DOT format |
| `pnpm typecheck` | Type-checks every workspace package |
| `pnpm test` | Runs the unit test suites |
| `pnpm test:int` | Runs the integration suites against real PostgreSQL. Requires Docker |
| `pnpm build` | Builds every workspace package |
| `pnpm --filter @carhealth/api dev` | Runs the API in watch mode |

### Environment

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | `postgres://` connection string. No default: one that quietly falls back to localhost is how a deployment writes to the wrong database without saying so |
| `PORT` | No | Defaults to `3000` |
| `NODE_ENV` | No | Defaults to `development` |

They are validated at boot, and an invalid value stops the process with a message naming
every offending variable rather than surfacing as `undefined` inside a request later.

### Database

| Command | What it does |
|---|---|
| `pnpm --filter @carhealth/api db:generate` | Generates a migration from the schema. Review the emitted SQL |
| `pnpm --filter @carhealth/api db:migrate` | Applies pending migrations to `DATABASE_URL` |

The schema lives in `apps/api/src/database/schema/`, one file per bounded context, and
migrations are checked in as SQL under `apps/api/drizzle/`. `drizzle-kit push` is
deliberately not wired up: it mutates a database with nothing to review and no record of
what changed.

Integration tests start a real PostgreSQL through Testcontainers and run the migration
files against it, so what the tests exercise is what production will run. SQLite and
in-memory substitutes are prohibited — see
[ADR 0009](docs/architecture/decisions/0009-drizzle-and-postgresql.md).

`pnpm arch` runs first in CI, before type checking. A boundary violation is a design
defect, and it is cheaper to learn that before waiting on everything else.

**When adding or changing a rule in `.dependency-cruiser.cjs`, verify it by writing a
file that violates it on purpose and confirming `pnpm arch` reports it.** A rule never
observed failing is not known to work — see
[ADR 0011](docs/architecture/decisions/0011-automated-architecture-enforcement.md).

## Documentation

Start at [docs/architecture/README.md](docs/architecture/README.md) — it indexes the
system overview, the stack reference, and every Architecture Decision Record.

## Stack at a glance

| Area | Choice |
|---|---|
| Backend | Node 24 + NestJS + TypeScript |
| Database | PostgreSQL + Drizzle ORM |
| API contract | Zod schemas → OpenAPI (`nestjs-zod`) |
| Frontend | React 19 + Vite, installable PWA |
| Repository | pnpm workspaces + Turborepo |
| Authentication | Managed provider (JWT resource server) |

See [docs/architecture/stack.md](docs/architecture/stack.md) for the full reference and
the reasoning behind each choice.

## Conventions

- All project artifacts — code, comments, documentation, commit messages, UI copy — are
  written in English.
- Commits follow [Conventional Commits](https://www.conventionalcommits.org/).
- Architecture decisions live in `docs/architecture/decisions/` as append-only ADRs.
