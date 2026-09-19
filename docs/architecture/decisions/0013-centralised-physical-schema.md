# 0013. The physical schema is a single artefact

- **Status**: Accepted
- **Date**: 2026-09-02

## Context

[ADR 0009](0009-drizzle-and-postgresql.md) chose Drizzle, whose schema is TypeScript.
[Module boundaries](../module-boundaries.md) place repositories in each context's
`infrastructure/` and forbid a context from importing another context's internals — a
rule enforced by `dependency-cruiser` ([ADR 0011](0011-automated-architecture-enforcement.md)).

Writing the first schema surfaced a conflict the boundary rules had not met yet.

The [domain model](../domain-model.md) relates entities across contexts: a vehicle
belongs to a profile, a maintenance belongs to a vehicle, a task refers to the catalog,
a schedule refers to both a vehicle and a catalog entry. Those are foreign keys, and in
Drizzle a foreign key is written as `references(() => otherTable.id)` — an import of the
table it points at.

If the tables live in `modules/<context>/infrastructure/`, every one of those foreign
keys is a cross-context import, and `no-cross-module-internals` rejects it. The choice
is therefore not cosmetic: it decides whether PostgreSQL enforces referential integrity
at all.

## Decision

The physical schema lives in **`apps/api/src/database/schema/`**, one file per bounded
context, outside `modules/`. Foreign keys are declared normally, including the ones that
cross contexts, with the delete behaviour each relationship deserves.

`database/` joins `main.ts`, `app.module.ts`, `config/` and `health/` as a path that is
deliberately not a bounded context.

Two new `dependency-cruiser` rules replace the one that no longer applies:

- `schema-is-infrastructure-only` — `domain/` and `application/` may not import
  `database/`. Only `infrastructure/` may.
- `schema-must-not-depend-on-modules` — `database/` may not import `modules/`.

## Rationale

The rule that broke is about **code** reaching into another context. This is about
**tables**, and the two are not the same thing.

There is one PostgreSQL database, in one deployment ([ADR 0002](0002-modular-monolith.md)),
and its constraints are a property of that database rather than of any module. Something
has to declare the schema as a whole, exactly as `app.module.ts` has to know every
context in order to assemble them. Concentrating that knowledge in one place is what lets
everything else stay ignorant of it.

What the boundary rules actually protect — a repository querying tables it does not own —
is untouched. `schema-is-infrastructure-only` keeps persistence out of the domain and the
use cases, and a repository importing another context's schema file remains a visible,
reviewable import rather than something hidden inside a query.

## Consequences

### Positive

- Referential integrity is enforced by PostgreSQL. An orphan row is impossible rather
  than merely unlikely, and deleting a profile removes what it owns in one statement.
- Delete behaviour is stated per relationship where the relationship is declared:
  `CASCADE` for owned data, a refused delete for catalog entries history refers to,
  `SET NULL` for a workshop whose record is removed but whose visits happened.
- drizzle-kit reads one entry point and generates one migration per change, with no glob
  to keep current.
- The migration is a single reviewable SQL file, which is what ADR 0009 asked for.

### Negative

- The schema is the one place where all four contexts are visible at once. Nothing
  prevents a repository from importing a table it has no business touching; the rules
  make that import visible, and review has to do the rest.
- Extracting a context into its own service later means splitting the schema and
  replacing the cross-context foreign keys with something else. That cost is real, and
  it is the cost ADR 0002 already accepted by choosing a monolith.
- A foreign key proves a row exists, not who owns it. A maintenance can reference
  another profile's workshop, and a task another profile's private task type, without
  PostgreSQL objecting. Ownership is the repositories' job to check.
- Two foreign keys cannot be expressed in Drizzle: `tasks.task_type_id` and
  `vehicle_task_schedules.task_type_id` are `DEFERRABLE INITIALLY DEFERRED`, added by
  hand to the migration SQL. Deleting a profile cascades to its private task types and,
  by another path, to the tasks that use them; checked immediately, the key rejects the
  account deletion before the second path has run. drizzle-kit does not track the
  clause, so a regenerated key would silently lose it — an integration test guards it.

### Neutral

- File layout inside `database/schema/` follows physical dependency order, not the
  context map. `odometer_readings` belongs to `vehicles` but sits in its own file,
  because a reading points at the maintenance that produced it while a maintenance points
  at its vehicle — declaring both in place would make two files import each other. The
  cycle is in the file graph rather than in the model, and it is broken where it appears.

## Alternatives considered

**Tables in each module's `infrastructure/`, with no cross-context foreign keys.**
Columns would be plain `uuid`s and integrity would become application code. Rejected:
it trades a guarantee the database gives for free against discipline in every future
write path, and the failure mode — orphan rows, a half-deleted profile — is silent and
discovered late.

**Tables in each module, relaxing `no-cross-module-internals` for `infrastructure/`.**
Keeps the foreign keys without moving anything. Rejected because the exception is far
wider than the need: the same hole that lets a schema file import another schema file
lets a repository query another context's tables, which is precisely what the boundary
document prohibits. An exception that cannot distinguish the two is not an exception,
it is a removed rule.

**A single `schema.ts` for the whole database.** Simpler for drizzle-kit and marginally
simpler to import. Rejected because it erases the context map from the layer where the
data actually lives; one file per context keeps the boundaries legible even where the
tables are assembled together.
