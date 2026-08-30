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

**`dependency-cruiser` runs in CI with rules that fail the build on violation.**

Implemented in [`.dependency-cruiser.cjs`](../../../.dependency-cruiser.cjs). Every rule
has `severity: 'error'` — a warning is a violation that gets merged anyway.

### Layer rules, within `apps/api`

| Rule | Rationale |
|---|---|
| `domain-is-self-contained` — a module's `domain/` may import only from its own `domain/` | Business rules depend on nothing: no other layer, no other module, no npm or workspace package, no Node builtin |
| `application-must-not-depend-on-infrastructure` | `application/` declares ports; `infrastructure/` implements them |
| `no-cross-module-internals` — no module may import another module's `domain/` or `infrastructure/` | Contexts talk through published ports or domain events |
| `no-circular` | A cycle is a boundary that was never really there |
| `no-orphans` | Dead code left by a refactor. Entry points and config files are exempt, because being unimported is their normal state |

#### Why `domain-is-self-contained` is an allowlist

The first implementation was a denylist: forbid `domain/` from importing NestJS,
Drizzle, Zod, and the npm dependency types. **Verification proved it did not work.** A
deliberate violation importing an npm package from `domain/` passed cleanly, because
dependency-cruiser classified it as `npm-no-pkg` — resolved, but declared in the root
`package.json` rather than the app's — and that type was not in the list.

The rule was inverted to state what `domain/` *may* import, which is its own `domain/`
and nothing else. An allowlist cannot have that gap, there is no list of forbidden
things to keep current, and it replaced three separate rules with one.

The lesson generalises, and is the reason the verification step below is mandatory: a
rule that has never been observed failing is not known to work.

### Package rules, across the monorepo

| Rule | Rationale |
|---|---|
| `packages/contracts` must not import from any `apps/*` | It is the shared foundation both apps depend on; importing upward inverts the dependency |
| `apps/api` must not import from `apps/web`, and the reverse | The applications share code only through `packages/*` |

The package rules address a failure mode the layer rules cannot see. If
`packages/contracts` ever imports from `apps/api`, the frontend begins pulling backend
code through its own dependency graph and the shared package stops being shared. Nobody
writes that import deliberately; editor auto-import writes it, and without a rule nothing
objects.

### Expressing the rules

Module boundaries are written once using dependency-cruiser's capture-group
backreferences (`$1`), not once per module. A single rule of the form *"a module's
`domain/` may not be imported from a different module"* covers all four contexts and
every context added later. Per-module rules would need maintaining as modules appear,
and a rule that must be remembered is a rule that will be forgotten.

### Ordering

**These rules are written before the first feature**, not after. In practice this means
the rules land in the same commit as the repository scaffold — the directory structure
has to exist for the rules to match against — so that no application file is ever added
while the boundaries are unwatched.

Rules retrofitted onto an existing codebase begin life with a list of exceptions, and an
exception list is how enforcement becomes decoration.

### Verification — mandatory when rules change

**A rule that has never been observed failing is not known to work.** A configuration
that reports no violations is indistinguishable from one that checks nothing, and the
`npm-no-pkg` gap above was invisible until a violation was written deliberately.

Whenever a rule is added or modified:

1. Write a file that violates it on purpose.
2. Run `pnpm arch` and confirm the violation is reported, by rule name.
3. Delete the file and confirm the run is clean again.

This is not optional diligence. It is the only evidence that the enforcement described in
this ADR exists.

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
