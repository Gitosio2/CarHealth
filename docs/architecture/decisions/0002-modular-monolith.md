# 0002. Modular monolith over microservices

- **Status**: Accepted
- **Date**: 2026-08-30

## Context

CarHealth has four bounded contexts — `identity`, `vehicles`, `maintenance`, and
`reminders` — one developer, and a requirement to run on free infrastructure.

Microservices are frequently treated as the default for a system with several contexts.
They are not free: they convert in-process calls into network calls, convert local
transactions into distributed ones, and multiply deployment targets, observability
surface, and failure modes.

## Decision

The backend is a **modular monolith**: one deployable unit containing all four contexts,
each with explicit and automatically enforced boundaries
([ADR 0011](0011-automated-architecture-enforcement.md)).

## Consequences

### Positive

- One deployment target, which is what makes the free-tier constraint achievable at all.
- Cross-context operations are local calls: no network latency, no partial failure, no
  distributed transactions, no eventual consistency to reason about.
- Refactoring across context boundaries is a compiler-checked operation rather than a
  coordinated multi-service release.
- Local development is a single process.

### Negative

- The whole application scales as one unit. Not a concern at this scale, and a concern
  that can be addressed by extraction if it ever becomes one.
- Module boundaries are enforced by tooling rather than by the network. Tooling can be
  disabled; a network boundary cannot. This is why the enforcement runs in CI and not
  merely in an editor.
- A fault in one module can affect the whole process.

### Neutral

- Extracting a context into its own service later remains available, and is cheap
  **precisely because** the boundaries already exist. The modular monolith is not a
  compromise on the way to microservices; it is the correct shape now, which happens to
  preserve that option.

## Alternatives considered

**Microservices** — genuine benefits around independent scaling, independent deployment,
and fault isolation. Rejected because none of those benefits apply here: there is one
developer, so independent deployment coordinates nothing; there is no differential load,
so independent scaling optimises nothing; and free-tier infrastructure cannot host four
services. The costs, meanwhile, apply in full and immediately.

**A monolith without module boundaries** — less upfront structure, faster to start.
Rejected because it is the option that cannot be reversed. Boundaries that are not
established early are not established at all, and the resulting coupling is what makes
later extraction impossible. The cost of module boundaries is paid once, at the
beginning; the cost of not having them compounds indefinitely.
