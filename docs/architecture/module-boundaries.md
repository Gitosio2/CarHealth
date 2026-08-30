# Module Boundaries

This document answers two questions without ambiguity:

1. Where does a new piece of code belong?
2. What is it allowed to import?

Every rule stated here is enforced automatically by `dependency-cruiser`
([ADR 0011](decisions/0011-automated-architecture-enforcement.md)). If a rule is not
enforceable, it does not belong in this document.

## Bounded contexts

Four contexts, one directory each under `apps/api/src/modules/`. The data model is not
yet defined; what follows describes **responsibility**, not entities.

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
