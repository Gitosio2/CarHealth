# 0007. Managed authentication provider

- **Status**: Accepted
- **Date**: 2026-08-30

## Context

CarHealth associates vehicles with a person, so it needs authentication before any
meaningful feature works.

Authentication is routinely underestimated. It is not a login endpoint. A complete
implementation requires registration, email verification, password reset with
single-use expiring tokens, secure password hashing, refresh-token rotation with reuse
detection, rate limiting and lockout, session revocation, and eventually social login and
multi-factor authentication.

Each of those is a place where a subtle mistake becomes a credential breach, and none of
them is specific to vehicle maintenance. They are the same for every application.

## Decision

Authentication is delegated to a **managed provider** that issues JWTs. The CarHealth API
is a **JWT resource server**: it validates tokens against the provider's JWKS endpoint
and does nothing else with credentials.

The `identity` module stores a local `Profile` referencing the external subject (`sub`)
claim. **Credentials never exist in CarHealth's database.**

The concrete provider — Supabase Auth, Auth0, or Clerk — is deliberately deferred,
because it interacts with the hosting decision in
[ADR 0012](0012-free-tier-infrastructure.md).

## Consequences

### Positive

- The largest avoidable security surface in the application is removed. Password
  hashing, token rotation, and reset flows are not written here, so they cannot be
  written wrongly here.
- A credential breach in CarHealth's database is not possible, because there are no
  credentials in it.
- Social login and multi-factor authentication become configuration rather than
  projects.
- Development starts on the actual domain — vehicles and maintenance — rather than on
  weeks of authentication plumbing.
- All three candidate providers have free tiers adequate for this project's scale.

### Negative

- An external dependency on the critical path: if the provider is down, nobody logs in.
- Vendor lock-in risk, mitigated but not eliminated by the port boundary below.
- Free-tier terms can change. The provider is a business decision that may need
  revisiting, which is why the choice is recorded as deferred rather than assumed
  permanent.
- User data lives with a third party, which has privacy implications worth stating
  plainly if the project ever has users beyond its author.

### Neutral

- The `sub` claim becomes the stable link between the external identity and the local
  profile. Everything the domain needs to know about a person lives in `Profile`; the
  provider owns only authentication.

## Alternatives considered

**Self-managed authentication in NestJS** — full control, no external dependency, no
vendor lock-in, and no cost. Rejected because the work is far larger than it appears and
the failure mode is a credential breach rather than a bug. The components listed in the
Context section are each individually easy to get subtly wrong, and getting them right is
not what this project is for.

**Keycloak, self-hosted** — open source, no vendor lock-in, complete control. Rejected on
resource grounds: it needs its own container and meaningful memory, which does not fit
the free-tier budget in [ADR 0012](0012-free-tier-infrastructure.md), and it becomes a
second service to operate and keep patched.

## Consequence for the architecture

The provider is accessed exclusively through a port declared in
`identity/application/`, implemented by an adapter in `identity/infrastructure/`. No
other module, and no domain code, knows which provider is in use.

This is what keeps the deferred provider decision genuinely deferred: changing it touches
one adapter. See [ADR 0003](0003-hexagonal-architecture.md).
