# 0009. Drizzle ORM and PostgreSQL

- **Status**: Accepted
- **Date**: 2026-08-30

## Context

CarHealth stores profiles, vehicles, and maintenance history — relational data with
clear foreign-key relationships and a need for transactional consistency. A relational
database is the obvious fit; the questions are which one, and how it is accessed.

The access layer also has to respect the hexagonal boundary
([ADR 0003](0003-hexagonal-architecture.md)): domain code must not import it, and
repository implementations live in `infrastructure/`.

## Decision

**PostgreSQL 16+** with **Drizzle ORM** and **drizzle-kit** for migrations.

Integration tests run against real PostgreSQL through **Testcontainers**.

## Consequences

### Positive

- Drizzle has no code generation step. The schema is TypeScript, and types are inferred
  from it directly — nothing to regenerate, nothing to be stale.
- Its runtime footprint is small, which matters directly on a 512 MB free tier
  ([ADR 0012](0012-free-tier-infrastructure.md)).
- Queries read like SQL, so what executes against the database is visible at the call
  site rather than hidden behind an abstraction.
- Migrations are explicit SQL files, reviewable in a pull request before they run
  anywhere.
- PostgreSQL is available on every free-tier platform under consideration, so this
  decision does not constrain the deferred hosting choice.

### Negative

- Drizzle demands more discipline than Prisma. It gives control over the emitted SQL and
  therefore expects the author to know what good SQL is. Someone new to databases will
  find Prisma gentler.
- Its ecosystem is younger than Prisma's, with less tooling and fewer answered questions.
- Testcontainers makes integration tests slower than an in-memory database would, and
  requires a working Docker environment locally and in CI.

### Neutral

- Drizzle is a query builder more than an ORM. There is no identity map and no lazy
  loading — which suits hexagonal architecture, where the repository adapter maps between
  rows and domain objects explicitly anyway.

## Alternatives considered

**Prisma** — the more mature ecosystem, a gentler learning curve, and a more integrated
migration workflow. Rejected on two grounds: the code generation step reintroduces a
build artefact that can go stale, and the runtime footprint is larger on a constrained
free tier. A third consideration weighed in — Prisma's migration generation will emit
schema changes that lock tables without warning, which is exactly the kind of hidden
complexity that becomes expensive as data grows. Drizzle's explicitness is preferable
here even though it asks more of the author.

**TypeORM** — familiar to developers arriving from Hibernate, which would have suited the
Java background. Rejected for weaker type inference and a decorator-driven model that
pulls persistence concerns toward entity definitions — directly against the boundary
rules in [ADR 0003](0003-hexagonal-architecture.md).

**Raw SQL with a thin query layer** — maximum control, minimum abstraction. Rejected
because it discards type inference between the schema and the queries, which is the main
benefit TypeScript offers at this layer.

**SQLite** — simplest possible deployment, and free everywhere. Rejected because it
diverges from PostgreSQL in ways that surface late, and the free tiers under
consideration offer managed PostgreSQL anyway.

## Testing constraint

Integration tests run against real PostgreSQL via Testcontainers. **SQLite and in-memory
substitutes are prohibited.** They accept SQL that PostgreSQL rejects and reject SQL that
PostgreSQL accepts, which produces green-locally / red-in-production — the specific
failure mode that makes an integration test worse than no test at all, because it
provides false confidence.
