# 0011. Automated architecture enforcement

- **Status**: Accepted
- **Date**: 2026-08-30

## Context

This project documents a specific structure: bounded contexts with explicit boundaries
([ADR 0002](0002-modular-monolith.md)) and hexagonal layering within each
([ADR 0003](0003-hexagonal-architecture.md)).

Documented structure decays. Not through carelessness, but through a hundred individually
reasonable decisions: a use case that imports the repository directly because the port
felt like ceremony, a domain object that imports a NestJS decorator because it was
convenient, one module reading another module's tables because the query was simpler that
way. Each is defensible in isolation. Together they dissolve the architecture, and the
decay is invisible until a change that should be local turns out not to be.

[ADR 0001](0001-typescript-over-java.md) recorded a specific cost of choosing TypeScript
over Java: the structural pressure the Java ecosystem applies for free is gone. In Java,
a module system and ecosystem conventions push toward structure. In TypeScript on Node,
nothing objects to any import whatsoever.

That pressure has to be replaced deliberately. This ADR is the replacement.

## Decision

**`dependency-cruiser` runs in CI with layer and module rules that fail the build on
violation.** Rules to encode:

| Rule | Rationale |
|---|---|
| `domain/` must not import `application/` or `infrastructure/` | Dependencies point inward |
| `application/` must not import `infrastructure/` | Ports, not implementations |
| `domain/` must not import `@nestjs/*`, Drizzle, Zod, or any framework | The domain is framework-free |
| No module may import another module's `domain/` or `infrastructure/` | Contexts talk through published ports |
| No circular dependencies anywhere | — |

**These rules are written before the first feature**, not after. Rules added to an
existing codebase begin life with a list of exceptions, and an exception list is how
enforcement becomes decoration.

## Consequences

### Positive

- A boundary violation fails the build. The architecture is a property of the code, not a
  claim in a document.
- Violations surface at the moment they are introduced, in the pull request that caused
  them, while the reasoning is still in the author's head.
- The rules document the architecture in an executable form. Where prose and
  configuration disagree, the configuration is authoritative.
- New contributors learn the boundaries from feedback rather than from reading
  documentation they may not find.

### Negative

- A configuration to write and maintain. As modules are added, the rules need updating.
- Friction when a violation is legitimate. That friction is the feature — it forces the
  exception to be argued for explicitly rather than committed silently — but it is real,
  and it will occasionally be annoying.
- CI time, though negligible for a project this size.

### Neutral

- The rules will need revising as the architecture legitimately evolves. Revising them
  deliberately is fine; adding exceptions to make a build pass is not. The distinction is
  whether the rule changed or the code merely violated it.

## Alternatives considered

**Code review alone** — no tooling, full human judgement. Rejected because this is a solo
project, so review is self-review, and self-review does not reliably catch a convenient
shortcut taken twenty minutes earlier. It also does not scale to every commit.

**ESLint with `import/no-restricted-paths`** — no additional dependency, since ESLint is
present anyway. A reasonable option, and rejected for expressiveness: `dependency-cruiser`
states rules in terms of layers and modules rather than path globs, produces dependency
graphs that make violations legible, and detects cycles. The rules stay readable as the
number of modules grows.

**Nx module boundaries** — capable and well integrated, but requires adopting Nx.
Rejected along with Nx in [ADR 0005](0005-pnpm-turborepo-monorepo.md); adopting an entire
build system to obtain one feature is disproportionate.

**Trusting the documentation** — rejected. A documented boundary with no automated check
is a boundary that erodes within weeks. This project has one developer, no review
partner, and a stated architecture that only survives if something enforces it.
