# 0003. Hexagonal architecture per module

- **Status**: Accepted
- **Date**: 2026-08-30

## Context

Each bounded context ([ADR 0002](0002-modular-monolith.md)) needs an internal structure.
The default in most NestJS projects is a controller/service/repository triple, where the
service holds business logic and imports the repository directly.

That structure couples business rules to persistence. It works until the rules become
non-trivial — and in CarHealth they will, particularly in `reminders`, where deriving
what maintenance is due involves policy that changes over time.

Several decisions in this project are also explicitly provisional: the authentication
provider ([ADR 0007](0007-managed-authentication-provider.md)) and the hosting provider
([ADR 0012](0012-free-tier-infrastructure.md)) are both deferred. Provisional decisions
need to be swappable, which means they must sit behind an interface.

## Decision

Every module follows **ports and adapters**:

```
modules/<context>/
├── domain/          → entities, value objects, domain services
├── application/     → use cases, port interfaces
└── infrastructure/  → controllers, repositories, external clients
```

Dependencies point inward only. `domain/` knows nothing of `application/` or
`infrastructure/`; `application/` knows nothing of `infrastructure/`. Anything the
application layer needs from the outside world is declared there as a port interface and
implemented in `infrastructure/`.

`domain/` imports no framework at all — not NestJS, not Drizzle, not Zod.

The precise rules and their enforcement are in
[module-boundaries.md](../module-boundaries.md).

## Consequences

### Positive

- Domain logic is testable with no framework, no database, and no mocks beyond plain
  objects. Fast tests, and tests that describe business rules rather than wiring.
- Deferred decisions stay deferred. Changing the auth provider or the database touches
  one adapter, not the business rules.
- The dependency direction is checkable, so the structure cannot silently degrade.
- Business rules are readable without knowing NestJS.

### Negative

- More files and more indirection than a controller/service/repository layout. For a
  trivial CRUD operation, the port interface genuinely adds ceremony with no immediate
  payoff.
- Requires discipline in the first weeks, when the payoff is not yet visible and the
  shortcut is tempting.
- A developer new to the codebase needs to understand the layering before contributing.

### Neutral

- NestJS supports this well. Its dependency injection is exactly the mechanism ports and
  adapters requires, so the framework works with the pattern rather than against it
  ([ADR 0004](0004-nestjs-as-backend-framework.md)).

## Alternatives considered

**Controller / service / repository** — the NestJS default, familiar, and less code.
Rejected because it couples business rules to persistence, which is the specific coupling
that makes the deferred provider decisions expensive to change later. It is a reasonable
choice for a system whose rules stay thin; CarHealth's will not.

**Hexagonal only where complexity warrants it** — apply ports and adapters in
`reminders`, keep the simpler layout elsewhere. Genuinely tempting, and rejected for a
practical reason: mixed conventions mean every contributor must first work out which
convention applies here, and in practice the simpler layout spreads because it is easier
to write. Consistency is worth the ceremony in the simple modules.

**Clean Architecture with a separate use-case layer per operation** — more granular
still. Rejected as more structure than this project's complexity justifies; the
three-layer split already provides the isolation that motivated the decision.
