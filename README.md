# CarHealth

Maintenance tracking for private vehicle owners. A person registers the vehicles they
own and keeps a history of services, costs, and mileage, so that upcoming or overdue
maintenance is never a guess.

## Status

**Scaffolded, pre-implementation.** The architecture and technology stack are decided and
documented, and the workspace and its architecture boundaries are in place. No
application code exists yet.

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
| `pnpm test` | Runs the test suites |
| `pnpm build` | Builds every workspace package |
| `pnpm --filter @carhealth/api dev` | Runs the API in watch mode |

The API reads `PORT` and `NODE_ENV`, both optional. They are validated at boot, and an
invalid value stops the process with a message naming every offending variable rather
than surfacing as `undefined` inside a request later.

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
