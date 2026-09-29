# Module Boundaries

This document answers two questions without ambiguity:

1. Where does a new piece of code belong?
2. What is it allowed to import?

Every rule stated here is enforced automatically by `dependency-cruiser`
([ADR 0011](decisions/0011-automated-architecture-enforcement.md)). If a rule is not
enforceable, it does not belong in this document.

## Bounded contexts

Four contexts, one directory each under `apps/api/src/modules/`. What follows describes
**responsibility**; the entities each context owns are in the
[domain model](../domain-model.md).

| Module | Owns | Does not own |
|---|---|---|
| `identity` | The local profile representing a person, and its link to the external authentication subject | Credentials, passwords, sessions — those live entirely with the auth provider |
| `vehicles` | The set of vehicles a profile owns, and their identifying characteristics | Anything about work performed on a vehicle |
| `maintenance` | The record of maintenance performed — what, when, at what mileage, at what cost | Deciding what is due next |
| `reminders` | Deriving what maintenance is upcoming or overdue, and notifying about it | Storing maintenance history; it reads that from `maintenance` |

The split between `maintenance` and `reminders` is deliberate. Recording history is a
fact about the past and is always true. Deriving what is due is a policy about the
future, and that policy will change — intervals by kilometres, by time, by manufacturer
schedule. Keeping the policy out of the historical record means changing the policy never
risks the history.

## Layers within a module

```
modules/<context>/
├── domain/          → entities, value objects, domain services
├── application/     → use cases, port interfaces
└── infrastructure/  → controllers, repositories, external clients
```

### `domain/`

Business rules and the vocabulary of the context. Pure TypeScript.

**May import:** nothing outside its own `domain/`. Standard library only.

**May not import:** `application/`, `infrastructure/`, `@nestjs/*`, Drizzle, Zod, any
HTTP client, any other module.

The constraint is absolute on purpose. If the domain cannot be unit-tested with no
framework, no database, and no mocks beyond plain objects, the domain is not isolated and
the test will tell you immediately.

### `application/`

Use cases — one per meaningful operation the system performs — and the **port
interfaces** those use cases depend on. A port is declared here, in the language of the
domain; its implementation lives in `infrastructure/`.

**May import:** its own `domain/`; another module's `application/` ports (a published
contract).

**May not import:** `infrastructure/` — its own or anyone else's — or another module's
`domain/`.

### `infrastructure/`

Everything that touches the outside world: NestJS controllers, Drizzle repositories,
auth provider clients, schedulers.

**May import:** its own `domain/` and `application/`, and any framework or library.

**May not import:** another module's `domain/` or `infrastructure/`.

## Cross-module communication

Two mechanisms, both explicit:

**Published application ports.** When `reminders` needs maintenance history, it depends
on an interface published by `maintenance/application/`, not on `maintenance`'s domain
entities or its Drizzle repository. The dependency is on a contract, and it is visible in
the import.

**Domain events.** When a module needs to react to something rather than ask for it, the
originating module publishes an event and the reacting module subscribes. Neither knows
about the other.

Direct database access across module boundaries is prohibited. A module reading another
module's tables produces a coupling that no interface documents and no refactoring
survives.

## Outside the contexts

Not everything in `apps/api/src/` is a bounded context. These sit alongside `modules/`
and are deliberately exempt from the rules above:

| Path | What it is |
|---|---|
| `main.ts` | Process entry point. Validates the environment, then boots Nest |
| `app.module.ts` | **Composition root.** The only place allowed to know about every context |
| `config/` | Environment contract, validated once at boot |
| `health/` | Liveness endpoint. Belongs to no context because it describes the process, not the business |
| `database/` | The physical schema and its migrations. One file per context, but one database |

The composition root is what makes the boundaries possible rather than contradicting
them. Contexts do not import each other; something has to assemble them, and that
something is `app.module.ts`. Concentrating that knowledge in one file is the point — it
is why every other file can stay ignorant of the whole.

### `database/` — one database, four contexts

The Drizzle schema lives in `apps/api/src/database/schema/`, one file per bounded
context, and its foreign keys cross contexts freely — including
`vehicles.profile_id → profiles.id` and `maintenances.vehicle_id → vehicles.id`.

That is not a hole in the rules above; it is the same reasoning as the composition root.
There is one PostgreSQL database, and its constraints belong to the database rather than
to any module. Declaring a table inside a context would make every cross-context foreign
key an illegal import, and the practical result would be no foreign keys at all — the
guarantee traded away for a directory layout. See
[ADR 0013](decisions/0013-centralised-physical-schema.md).

What the boundary still forbids, enforced by `dependency-cruiser`:

| Rule | What it stops |
|---|---|
| `schema-is-infrastructure-only` | `domain/` or `application/` importing a table. Only `infrastructure/` may |
| `schema-must-not-depend-on-modules` | The schema reaching up into the code that owns it |

A repository imports **the schema file of its own context**, not the barrel in
`schema/index.ts` — that barrel exists for drizzle-kit and the test harness, which
legitimately need the whole database. Reaching into another context's tables remains
prohibited; it is now a visible import for review to catch rather than something the
tool can decide, and that is the price of having referential integrity at all.

`health/` is a liveness check only: it answers whether the process is serving requests,
and deliberately does not check the database or the auth provider. A liveness probe that
fails during a dependency outage makes the platform restart a process that is working,
turning a partial outage into a total one. Readiness checks, if they are ever needed,
belong on a separate route.

## Where does new code go?

Follow the chain in order.

1. **Which context does this belong to?** Answer with the responsibility table above.
   If it genuinely belongs to two contexts, it is probably two pieces of code, one in
   each, communicating through a port.

2. **Is it a business rule that would still be true with no database and no HTTP?**
   → `domain/`.

3. **Is it an operation the system performs, orchestrating domain objects?**
   → `application/`, as a use case. If it needs something from outside — persistence,
   the clock, another module, an email — declare a port for that need in
   `application/` and implement it in `infrastructure/`.

4. **Does it talk to the outside world?** → `infrastructure/`, implementing a port that
   `application/` already declared.

### `shared/`

The cross-cutting kernel. Only concepts that are genuinely shared by every context and
belong to none of them.

Bias strongly against adding to it. `shared/` is where module boundaries go to die: code
lands there because it was inconvenient to decide where it belonged, and once several
modules depend on it, the coupling is permanent and invisible. Duplicating a small
concept across two modules is usually cheaper than sharing it wrongly.

Before adding something here, answer: *would this still make sense if one of the modules
were deleted?* If not, it belongs to that module.
