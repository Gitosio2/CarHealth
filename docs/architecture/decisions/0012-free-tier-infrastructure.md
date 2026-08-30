# 0012. Free-tier infrastructure

- **Status**: Accepted
- **Date**: 2026-08-30

## Context

CarHealth must run at zero cost. That constraint influenced several earlier decisions —
the language ([ADR 0001](0001-typescript-over-java.md)), the mobile strategy
([ADR 0006](0006-pwa-first-mobile-strategy.md)), and the frontend architecture
([ADR 0010](0010-react-spa-over-nextjs.md)).

This ADR records what was actually verified, when, and what the caveats are.

> **All findings below were verified on 2026-08-30.** Free-tier terms change frequently
> and without notice. Treat every claim here as needing re-verification before
> deployment, and update this ADR with a new date when you do. A stale infrastructure
> claim presented with confidence is worse than no claim.

### One constraint follows from the framework choice

**NestJS requires a Node runtime and does not run on edge runtimes such as Cloudflare
Workers.** Edge deployment would require a different framework — Hono — which was
considered and rejected in [ADR 0004](0004-nestjs-as-backend-framework.md). Realistic
deployment targets are therefore container and Node platforms, not edge platforms.

This is a genuine reduction in available free options, and it is the price of the
framework decision.

## Decision

Provider selection is **deferred** until deployment, because terms will need
re-verification anyway. The evaluated landscape and the current recommendation are
recorded here.

### Recommendation

| Component | Target | Fallback |
|---|---|---|
| API (`apps/api`) | Google Cloud Run | Render or Koyeb |
| PostgreSQL | Neon | Supabase, with the caveat below |
| Web (`apps/web`) | Cloudflare Pages | Netlify |
| Authentication | Deferred — see [ADR 0007](0007-managed-authentication-provider.md) | — |

Oracle Cloud Always Free is documented as the fallback for the whole backend if free-tier
terms degrade.

### What was verified

**Google Cloud Run** — scales to zero with a generous free request allowance. Node cold
starts are around a second, against tens of seconds for a JVM. The strongest fit for this
stack, and the option that makes scale-to-zero practical rather than painful.

**Render / Koyeb** — permanent free tiers at 512 MB RAM, comfortable for a Node process.
Render spins down on inactivity; with Node the wake-up cost is tolerable, where with a
JVM it would not have been.

**Neon** — managed PostgreSQL with autosuspend and fast resume. Preferred over Supabase
specifically because of the pause behaviour below.

**Supabase** — 500 MB database and 50,000 monthly active users for authentication, which
is generous. **Critical caveat: free projects pause after one week of inactivity.** For a
maintenance application — where a user may legitimately not open the app for a month —
an automatic pause is a real availability defect, not a footnote. If Supabase is chosen,
this must be recorded as an accepted risk with a stated mitigation, such as a scheduled
keep-alive request.

**Oracle Cloud Always Free** — 4 ARM Ampere cores and 24 GB RAM, with no expiration. By
far the most generous free offering available. Its role changed with the language
decision: under a JVM backend it was close to necessary, whereas a Node process no longer
forces an always-on VM. It is now a fallback rather than a requirement.

## Consequences

### Positive

- The project runs at zero cost with the recommended combination.
- Scale-to-zero is practical rather than a workaround, which is a direct consequence of
  ADR 0001 and worth recognising as such.
- The frontend deploys as static files, so its hosting is free and durable regardless of
  what happens to the API's platform.
- Oracle Always Free provides a real escape route if commercial free tiers degrade.

### Negative

- Free tiers have no SLA, no backups, and no support. **Database backups are the
  project's responsibility** and are not covered by any decision recorded so far — this
  needs addressing before real data exists.
- Cold starts on scale-to-zero platforms mean the first request after idling is slow.
  Around a second with Node; acceptable, but present.
- Provider terms can change unilaterally, which is why this ADR is dated and the
  provider choice is deferred.
- Edge runtimes are unavailable, per the framework constraint above.

### Neutral

- Deferring provider selection costs nothing. The API is a standard containerised Node
  application and the database is standard PostgreSQL, so no platform-specific coupling
  is being deferred along with the decision.

## Alternatives considered

**Cloudflare Workers** — the best free tier available for backends, with no cold-start
penalty. **Not available**: NestJS requires a Node runtime. Reaching it would mean
replacing the framework with Hono and building dependency injection and module boundaries
by hand — see [ADR 0004](0004-nestjs-as-backend-framework.md).

**Oracle Cloud Always Free as the primary target** — the most generous resources by a
wide margin, and no scale-to-zero cold starts. Rejected as the primary choice because it
requires manually managing Linux, networking, and TLS, which is operational work a
managed platform absorbs. It stays as the documented fallback.

**Fly.io / Railway** — good developer experience. Not recommended because their free
allowances are the least stable of the options reviewed, and stability of terms is the
property that matters most for a project whose defining constraint is zero cost.

**Paying a small monthly amount** — would remove every caveat in this document. Rejected
because zero cost is a stated project constraint, not a preference. Worth revisiting if
the project ever acquires users whose data justifies an SLA and real backups.
