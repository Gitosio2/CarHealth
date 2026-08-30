# 0005. Monorepo with pnpm workspaces and Turborepo

- **Status**: Accepted
- **Date**: 2026-08-30

## Context

The central benefit claimed for choosing TypeScript on the backend
([ADR 0001](0001-typescript-over-java.md)) is that an API shape can be defined once and
consumed by both the backend and the frontend
([ADR 0008](0008-zod-contracts-and-openapi.md)).

That benefit is only real if both applications can import the same package trivially. In
separate repositories, sharing means publishing an internal package to a registry and
versioning it — friction that, in practice, leads to copying types instead, which
reintroduces exactly the duplication the language choice was meant to eliminate.

## Decision

A single repository with **pnpm workspaces** and **Turborepo**:

```
carhealth/
├── apps/
│   ├── api/            → NestJS backend
│   └── web/            → React + Vite PWA
├── packages/
│   ├── contracts/      → Zod schemas + inferred types
│   └── tsconfig/       → shared TypeScript + ESLint configuration
├── pnpm-workspace.yaml
└── turbo.json
```

`packages/contracts` is the keystone. It is the only place an API shape is defined, and
both applications depend on it.

## Consequences

### Positive

- A contract change and its consumers move in one commit. A breaking change surfaces at
  compile time in the same pull request that caused it, instead of at runtime after a
  version bump.
- No internal package publishing, no version coordination between repositories.
- One toolchain configuration — TypeScript, ESLint, formatting — shared through
  `packages/tsconfig`.
- Turborepo caches task output, so unchanged packages are not rebuilt or retested.
- pnpm's content-addressed store keeps disk usage and install times low, which matters
  on constrained CI runners.

### Negative

- CI must be configured to build and deploy the two applications independently despite
  the shared repository, or every frontend change redeploys the backend.
- Turborepo adds a configuration layer that must be understood before task graphs behave
  predictably.
- A single repository means a single set of permissions. Not a concern for a solo
  project; worth revisiting if contributors are added.

### Neutral

- Deployment remains fully independent. A monorepo is a source-organisation decision, not
  a deployment one — `apps/api` and `apps/web` deploy to different platforms
  ([ADR 0012](0012-free-tier-infrastructure.md)).

## Alternatives considered

**Separate repositories** — cleaner separation, independent histories, simpler CI per
repository. Rejected because it defeats the primary reason for choosing TypeScript on the
backend. Sharing the contract would require publishing a package, and the predictable
outcome under that friction is copied types and silent drift.

**Monorepo with npm or yarn workspaces** — no additional tooling to learn. Rejected in
favour of pnpm for its stricter dependency resolution: pnpm's non-flat `node_modules`
prevents a package from importing a dependency it did not declare, which is a class of
accidental coupling that flat installers permit silently.

**Nx instead of Turborepo** — more capable, with module-boundary enforcement built in
that would partly overlap [ADR 0011](0011-automated-architecture-enforcement.md).
Rejected as more tool than this project needs; Turborepo's caching is the feature
actually required, and `dependency-cruiser` covers boundaries without adopting a larger
framework.
