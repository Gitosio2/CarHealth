# CarHealth

Maintenance tracking for private vehicle owners. A person registers the vehicles they
own and keeps a history of services, costs, and mileage, so that upcoming or overdue
maintenance is never a guess.

## Status

**Pre-implementation.** The architecture and technology stack have been decided and
documented. No application code exists yet.

## Documentation

Start at [docs/architecture/README.md](docs/architecture/README.md) — it indexes the
system overview, the stack reference, and every Architecture Decision Record.

## Stack at a glance

| Area | Choice |
|---|---|
| Backend | Node 22 + NestJS + TypeScript |
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
