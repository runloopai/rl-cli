# Cartridges: Declarative Configuration for Runloop

---

## Problem

As the Runloop API surface grows, launching a fully-configured devbox requires orchestrating multiple independent objects: blueprints, secrets, gateway configs, network policies, MCP configs, and more. Each object has its own creation flow, and the devbox launch itself requires stitching them all together by ID or name.

Assuming a blueprint already exists (build-time is a separate concern), a realistic workflow to launch a devbox with runtime dependencies looks like:

```bash
rli secret create anthropic-key <<< "$ANTHROPIC_KEY"
rli secret create openai-key <<< "$OPENAI_KEY"
rli gateway-config create --name anthropic --endpoint https://api.anthropic.com --bearer-auth
rli gateway-config create --name openai --endpoint https://api.openai.com --bearer-auth
rli network-policy create --name restricted --allowed-hostnames github.com,pypi.org
rli devbox create --name my-box --blueprint my-env --resources LARGE \
  --network-policy restricted \
  --gateway ANTHROPIC=anthropic,anthropic-key \
  --gateway OPENAI=openai,openai-key \
  --tunnel authenticated \
  --idle-time 1800 --idle-action suspend
```

That's 6+ commands just for runtime configuration — and the user must know the CLI syntax for every object type, understand the dependency graph between objects, manually track names and IDs across commands, and know which objects already exist in their account.

This is purely the **runtime** side. Build-time concerns (blueprints, Dockerfiles, system setup) are a separate lifecycle with their own complexity. A developer needs to understand both, but shouldn't be forced to conflate them.

The cognitive load scales with API surface area. Every new feature we add (MCP configs, idle policies, code mounts) makes the runtime configuration worse.


## Solution: Cartridges

A **Cartridge** is a declarative configuration file that describes a complete Runloop resource and its dependencies. Think of it as a `package.json` for a Runloop devbox — a human-readable file that fully describes what you want, that can be checked into version control, shared across a team, and executed with a single command.

The name "Cartridge" reflects the core UX: you slot it in and go. Self-contained, portable, pre-loaded with everything you need.


## Core Concepts

### 1. Declarative, Not Imperative

A cartridge describes the **desired state** of a devbox and its dependencies. The user doesn't specify the sequence of API calls — RLI figures that out.

Dependencies can be specified in two ways:

- **By reference** — point at an existing object by name or ID. It must already exist. A bare string value means "look this up."
- **Inline definition** — define the object's spec directly in the cartridge. If it doesn't exist, RLI can create it. If it exists and matches, RLI uses it.

Some objects (like blueprints) are complex build-time artifacts that **must** be referenced — they cannot be defined inline. Others (like network policies, gateway configs) are simple enough to define in-place.

```yaml
# devbox.cartridge
kind: devbox
name: my-ml-environment

# Blueprint must already exist — reference by name or ID.
# Use a locked ID (e.g. bp_abc123) for production lockdown.
blueprint: my-python-env

resources:
  size: LARGE

architecture: x86_64

idle:
  timeout_seconds: 1800
  action: suspend

# Network policy: defined inline. RLI will find-or-create by name.
# If "restricted" exists and matches this spec, it's used as-is.
# If it doesn't exist, RLI creates it.
network:
  policy:
    name: restricted
    allow_devbox_to_devbox: false
    allowed_hostnames:
      - api.anthropic.com
      - grafana.com
      - github.com
      - pypi.org
  tunnel: authenticated

# Secrets must already exist — reference by name or ID.
# (Secret values should never appear in a cartridge file.)
secrets:
  ANTHROPIC_API_KEY: anthropic-prod-key
  GRAFANA_TOKEN: grafana-token

# Gateway configs: can be referenced OR defined inline.
gateways:
  ANTHROPIC:
    # Inline definition — RLI will find-or-create this gateway config
    config:
      name: anthropic-gateway
      endpoint: https://api.anthropic.com
      auth: bearer
    secret: anthropic-prod-key

launch:
  entrypoint: /bin/bash
  commands:
    - pip install -r requirements.txt
  env:
    ENVIRONMENT: development
  ports: [8080, 8888]
```

One file. One command to launch: `rli cartridge launch devbox.cartridge`

The `.cartridge` extension is all RLI needs — no `.yaml` suffix required.

The distinction is simple: **a string value is a reference, an object value is an inline definition.** RLI knows the difference and handles each accordingly.

### 2. Validate and Diff

Before launching, RLI compares the cartridge against cloud state:

```
$ rli cartridge validate devbox.cartridge

Cartridge: my-ml-environment (devbox)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  References (must exist):
  ✓ blueprint "my-python-env"           exists (bp_abc123)
  ✓ secret "anthropic-prod-key"         exists (sec_xyz789)
  ✓ secret "grafana-token"              exists (sec_def456)

  Inline definitions (find or create):
  ✓ gateway config "anthropic-gateway"  exists, spec matches (gwc_ghi789)
  ✗ network policy "restricted"         NOT FOUND — will create from inline spec

1 object will be created. 0 errors.
```

This is the **diff** — a clear picture of what exists, what needs to be created, and what's broken.

### 3. The package.json → Lockfile Pipeline

A cartridge has two forms:

**Source cartridge** (`devbox.cartridge`) — human-readable, uses names, checked into version control, edited by developers. The file format is YAML:

```yaml
kind: devbox
name: my-ml-environment
blueprint: my-python-gpu-env
secrets:
  ANTHROPIC_API_KEY: anthropic-prod-key
gateways:
  ANTHROPIC:
    config: anthropic-gateway
    secret: anthropic-prod-key
network:
  policy: ml-restricted
```

**Locked cartridge** (`devbox.cartridge.lock`) — fully resolved to immutable IDs, deterministic, used by production systems:

```yaml
kind: devbox
name: my-ml-environment
locked: true
locked_at: "2026-02-19T14:30:00Z"
locked_by: tode@runloop.ai

blueprint: bp_abc123def456

secrets:
  ANTHROPIC_API_KEY: sec_xyz789abc

gateways:
  ANTHROPIC:
    config: gwc_ghi789def
    secret: sec_xyz789abc

network:
  policy: np_jkl012mno
```

The rendering command:

```
$ rli cartridge render devbox.cartridge

Resolving references...
  blueprint "my-python-gpu-env"      → bp_abc123def456
  secret "anthropic-prod-key"        → sec_xyz789abc
  gateway config "anthropic-gateway" → gwc_ghi789def
  network policy "ml-restricted"     → np_jkl012mno

Locked: devbox.cartridge.lock
```

### 4. Launch

```
$ rli cartridge launch devbox.cartridge

Validating cartridge...
  ✓ All 4 dependencies exist

Launching devbox "my-ml-environment"...
  ✓ Created devbox dvb_mno345pqr (running)
```

If inline definitions need to be created, RLI handles it automatically:

```
$ rli cartridge launch devbox.cartridge

Validating cartridge...
  References (must exist):
  ✓ blueprint "my-python-env"           exists (bp_abc123)
  ✓ secret "anthropic-prod-key"         exists (sec_xyz789)
  ✓ secret "grafana-token"              exists (sec_def456)

  Inline definitions (find or create):
  ✓ gateway config "anthropic-gateway"  exists, spec matches (gwc_ghi789)
  ~ network policy "restricted"         creating from inline spec...
  ✓ network policy "restricted"         created (np_mno345)

Launching devbox "my-ml-environment"...
  ✓ Created devbox dvb_pqr678stu (running)
```

If a **reference** doesn't exist, it's a hard error — no interactive prompting, no implicit creation:

```
$ rli cartridge launch devbox.cartridge

Validating cartridge...
  ✗ blueprint "my-python-env"           NOT FOUND

Error: Referenced object "my-python-env" (blueprint) does not exist.
Hint: rli blueprint create --name my-python-env --dockerfile-path ./Dockerfile
```

The rule is simple: **inline definitions are created on the fly. References must already exist.** This keeps the launch path predictable and avoids any interactive flows during launch.


## Cartridge Types

Runloop has a natural separation between **build-time** and **runtime** concerns. A developer should understand both, but cartridges keep them cleanly separated. Each cartridge type maps to one top-level API resource and its immediate dependencies.

### Devbox Cartridge (`kind: devbox`) — Runtime

The primary cartridge type and the focus of this design. Describes everything needed to launch a devbox: which pre-built blueprint to use, what secrets and gateway configs to attach, networking, resource sizing, and lifecycle settings.

A devbox cartridge **references** artifacts (blueprints, objects, agents) by name or ID — it does not define or build them. They must already exist.

### Artifact Cartridges — Build-time

Blueprints, Objects, and Agents share a common pattern: they produce **binary artifacts stored in the Runloop cloud** that are accessed by reference. A devbox cartridge can't inline them because they involve file uploads, builds, or complex publishing workflows — they're not simple API objects with a few fields.

These are the "artifact tree" of Runloop: each one takes local source material, processes it, and produces an immutable cloud artifact identified by an ID. The cartridge captures the *recipe* for that artifact, and the lock file pins the *result*.

#### Blueprint Cartridge (`kind: blueprint`) — Future

Blueprints involve Dockerfiles, system setup commands, async builds that can fail, and container image artifacts. This is build-time configuration, not runtime composition.

A blueprint cartridge describes how to build an environment image:

```yaml
kind: blueprint
name: my-python-gpu-env

dockerfile: |
  FROM python:3.11-slim
  RUN apt-get update && apt-get install -y git curl
  RUN pip install torch transformers

system_setup_commands:
  - nvidia-smi  # verify GPU access

resources:
  size: LARGE
  architecture: x86_64

launch:
  ports: [8080, 8888]
  user: root
```

Locking a blueprint cartridge pins the built image ID — a `blueprint.cartridge.lock` records the specific `bp_abc123` that was produced from this Dockerfile at render time. Rebuilding the same Dockerfile might produce a different image (updated base layers, new package versions), so the lock is essential for reproducibility.

#### Object Cartridge (`kind: object`) — Future

Objects are file-based artifacts (datasets, models, config bundles) uploaded to Runloop cloud storage and mounted into devboxes. The artifact is the uploaded file/folder itself.

An object cartridge describes what to upload and how to validate it:

```yaml
kind: object
name: training-dataset-v3

source:
  path: ./data/training/
  # or: url: https://storage.example.com/dataset.tar.gz

# Local validation before upload (future)
validate:
  max_size: 10GB
  required_files:
    - manifest.json
    - data/*.parquet

metadata:
  version: "3.1"
  created_by: ml-team
```

The key challenge with objects is local validation — ensuring the source material is well-formed before uploading a potentially large artifact. The cartridge captures the validation rules alongside the source path, so the upload is repeatable and self-documenting.

Locking pins the uploaded object ID: `object.cartridge.lock` records `obj_xyz789`, the specific artifact that was uploaded. Re-uploading the same files might produce a different ID (contents could have changed on disk), so the lock is the version record.

#### Agent Cartridge (`kind: agent`) — Future

Agents are the most complex artifact type. They involve code, dependencies, configuration, and a publishing workflow that's best handled through CI/CD (GitHub Actions). The artifact is the published agent binary/bundle, and the `agent_id` serves as its version identifier.

An agent cartridge describes how to build and publish an agent:

```yaml
kind: agent
name: code-review-agent

source:
  path: ./agents/code-review/
  entrypoint: main.py

dependencies:
  requirements: ./agents/code-review/requirements.txt

config:
  model: claude-sonnet-4-5-20250929
  max_turns: 10

publish:
  # Recommended: use GHA for publishing rather than local builds
  workflow: .github/workflows/publish-agent.yml
```

The recommended workflow for agents is CI-driven: push code, GHA builds and publishes, the resulting `agent_id` is the version. Locking an agent cartridge pins that `agent_id`: `agent.cartridge.lock` records `agent_abc123`, the specific published version.

This creates a natural **cross-repo dependency chain**: a devbox cartridge in one repo references an agent by name, but the agent is built and published from another repo. The lock files on both sides provide the version trail — the agent repo's lock captures what was published, and the devbox repo's lock captures which published version is pinned.

#### How Artifact Cartridges Relate to Devbox Cartridges

The relationship is always **reference-only**. A devbox cartridge points at artifacts by name or ID:

```yaml
# devbox.cartridge
kind: devbox
name: my-agent-env

blueprint: my-python-env        # → built from blueprint.cartridge in this or another repo
# objects: (future mount syntax)
# agents: (future agent attachment syntax)
```

Artifact cartridges have their own lock lifecycle. A devbox lock pins the artifact IDs that were current at render time. If the artifact is rebuilt/republished, the devbox lock becomes stale until re-rendered — which is exactly the behavior you want for production stability.

### Benchmark Cartridge (`kind: benchmark`) — Future

Benchmarks have their own object graph (scenarios, scoring, runs) and are another domain-specific cartridge type worth building when the time comes.


## Schema Design

### Devbox Cartridge — Full Schema

```yaml
# Required
kind: devbox
name: string                    # Devbox name

# Lock metadata (present only in locked cartridges)
locked: boolean
locked_at: string               # ISO 8601 timestamp
locked_by: string               # email or identifier

# Source — one of blueprint or snapshot (by name or ID)
blueprint: string
snapshot: string

# Compute
resources:
  size: X_SMALL | SMALL | MEDIUM | LARGE | X_LARGE | XX_LARGE | CUSTOM_SIZE
  custom_cpu: number            # 2-16, even (only if CUSTOM_SIZE)
  custom_memory: number         # 2-64 GB, even (only if CUSTOM_SIZE)
  custom_disk: number           # 2-64 GB, even (only if CUSTOM_SIZE)
architecture: arm64 | x86_64   # default: x86_64

# Lifecycle
idle:
  timeout_seconds: number
  action: suspend | shutdown
keep_alive_seconds: number      # default: 3600

# Networking
# policy can be a string (reference) or an object (inline definition)
network:
  policy: string | NetworkPolicySpec
  tunnel: open | authenticated  # omit for no tunnel

# When referenced by string (name or ID):
#   policy: restricted
# When defined inline:
#   policy:
#     name: restricted
#     allow_devbox_to_devbox: false
#     allowed_hostnames: [github.com, pypi.org]

# Secrets — map of ENV_VAR_NAME → secret name or ID
# Secrets are ALWAYS references — values never appear in cartridges
secrets:
  ENV_NAME: secret-name

# AI Gateway Configs — map of ENV_PREFIX → {config, secret}
# config can be a string (reference) or an object (inline definition)
gateways:
  ENV_PREFIX:
    config: string | GatewayConfigSpec
    secret: string              # Secret — always a reference

# When config is referenced by string:
#   config: anthropic-gateway
# When config is defined inline:
#   config:
#     name: anthropic-gateway
#     endpoint: https://api.anthropic.com
#     auth: bearer

# MCP Configs (future)
# mcp:
#   - name: string
#     config: string

# Launch configuration
launch:
  entrypoint: string
  commands: string[]
  env: Record<string, string>   # Plain env vars (not secrets)
  ports: number[]
  user: string                  # username:uid format, or "root"
  code_mounts:                  # Code mount specifications
    - repo_url: string
      install_command: string

# Metadata — arbitrary key-value pairs
metadata:
  key: value
```

### Reference vs Inline — Resolution Rules

The schema uses a consistent pattern: **a string value is a reference, an object value is an inline definition.** This applies to `network.policy`, `gateways.*.config`, and any future dependency types.

Resolution behavior:

| Spec type | Object exists? | Behavior |
|-----------|---------------|----------|
| Reference (string) | Yes | Use it |
| Reference (string) | No | **Error** — must exist |
| Inline (object) | Yes, spec matches | Use existing |
| Inline (object) | Yes, spec differs | **Warn** — prompt to create new or use existing |
| Inline (object) | No | **Create** from inline spec |

Some object types are **reference-only** and cannot be defined inline:

- **Blueprints** — complex build-time artifacts with async lifecycle (see Artifact Cartridges)
- **Objects** — file-based artifacts uploaded to cloud storage (see Artifact Cartridges)
- **Agents** — published code artifacts with CI-driven lifecycle (see Artifact Cartridges)
- **Secrets** — values must never appear in cartridge files
- **Snapshots** — created from running devboxes, not declaratively

Everything else (network policies, gateway configs, and future types like MCP configs) supports both modes.


## CLI Commands

All commands accept **both source and locked cartridges.** RLI detects the type automatically (via the `locked: true` field). The behavior differs:

| Command | Source cartridge (`.cartridge`) | Locked cartridge (`.cartridge.lock`) |
|---------|-------------------------------|-------------------------------------|
| `validate` | Resolves names, checks existence, reports inline objects to create | Checks that all pinned IDs still exist |
| `launch` | Resolves names, creates inline objects, launches | Skips resolution, launches directly from IDs (fastest path) |
| `render` | Produces a `.cartridge.lock` sibling file | Re-validates (equivalent to `--verify`) |

This means developers can iterate with source cartridges locally, and CI/production can run the exact same `rli cartridge launch` command against locked cartridges — no workflow change, just a different file.

### `rli cartridge validate <file>`

Parse the cartridge, check all referenced objects against cloud state, and report a diff.

Flags:
- `--json` — output structured diff as JSON (for CI integration)

### `rli cartridge launch <file>`

Validate, create any inline-defined objects that don't exist, and launch the devbox. References that don't resolve are hard errors.

Flags:
- `--dry-run` — show what would happen (validate + list creates) without doing it
- `--locked-only` — only accept locked cartridges (for production enforcement)
- `--output json|text` — output format

### `rli cartridge render <file>`

Resolve all named references to immutable IDs. Produces a `.cartridge.lock` sibling file.

Flags:
- `--output <path>` — write to a specific file instead of the default
- `--sync` — if references don't resolve, prompt to create missing objects first, then render
- `--verify` — re-validate a locked cartridge (check that all IDs still exist)

### `rli cartridge init`

Interactive scaffolding. Asks the user what kind of cartridge, walks through options, writes a starter file. Essentially the inverse of the current devbox create form — instead of launching immediately, it produces a reusable config.

### `rli cartridge diff <file>`

Compare a source cartridge against its locked version. Show what has drifted. Useful before re-locking.

```
$ rli cartridge diff devbox.cartridge

Comparing source → lock...
  gateway config "anthropic-gateway"
    source: anthropic-gateway
    lock:   gwc_ghi789def (name: "anthropic-gateway", endpoint: api.anthropic.com)
    status: ✓ match

  network policy "ml-restricted"
    source: ml-restricted
    lock:   np_jkl012mno (name: "ml-restricted")
    status: ⚠ name matches but spec may have changed (re-render recommended)
```


## Security Model (Future)

The source → locked pipeline enables a powerful security posture:

### Development Keys
- Can launch from **source cartridges** (names resolved at runtime)
- Inline definitions created on the fly
- May have resource limits (smaller devbox sizes, shorter keep-alive)
- Full flexibility for experimentation

### Production Keys
- Can **only** launch from **locked cartridges** (`--locked-only` enforced server-side)
- All object IDs are pre-resolved and immutable
- No runtime resolution, no object creation, no surprises
- Deterministic: the same locked cartridge always produces the same devbox configuration

### The Review Workflow

```
developer branch:
  1. Edit devbox.cartridge (source)
  2. rli cartridge validate — verify everything resolves
  3. rli cartridge render — produce devbox.cartridge.lock
  4. git add both files
  5. Open PR

reviewer:
  6. Review the source cartridge (human-readable, easy to understand intent)
  7. Review the lock diff (verify exact IDs, catch unexpected changes)
  8. Approve

CI/production:
  9. rli cartridge launch devbox.cartridge.lock
```

This gives security teams exactly what they want: **only reviewed and locked configurations run in production.** The locked cartridge is the auditable artifact.


## Conflict Resolution

### The Problem

Multiple users might reference the same object name but expect different configurations. User A creates gateway config "anthropic" with one endpoint, User B changes it to another.

### Why It's Mostly Fine

Most Runloop objects are effectively immutable — you create a new one rather than mutating an existing one. This means:
- Two users can create objects with the same name but different IDs
- The locked cartridge pins to a specific ID, so it's immune to this

### Where It Gets Tricky

In the **source cartridge**, a name like `anthropic-gateway` is ambiguous if multiple objects share that name. RLI should:
1. During `validate`: warn if a name resolves to multiple objects
2. During `render`: fail if a name is ambiguous, require the user to disambiguate (use ID directly, or rename)
3. During `launch` from source: prompt the user to pick which one

### The Lock Escape Hatch

Locking is the solution to all ambiguity. Once locked, there's no name resolution at all — just immutable IDs. Teams that care about determinism should always run from locked cartridges.


## Migration Path: CLI → Cloud API

Phase 1 (this design): Cartridges are a **client-side** concept. RLI parses the YAML, validates against the API, creates missing objects, and calls the existing `devboxes.create` endpoint with the resolved parameters.

Phase 2 (future): Introduce a **server-side** `POST /v1/devboxes/create_from_cartridge` endpoint. The server accepts a locked cartridge directly, validates it, and launches. This unlocks:
- Programmatic launches from any language/SDK without needing RLI
- Server-side enforcement of `--locked-only` for production API keys
- Cartridge storage and versioning in the Runloop cloud
- Audit logs tied to specific cartridge versions

The client-side implementation in Phase 1 is not throwaway work — it validates the schema, UX, and workflow before baking it into the API.


## File Conventions

```
project/
├── cartridges/
│   ├── devbox.cartridge              # Runtime cartridge (human-edited)
│   ├── devbox.cartridge.lock         # Locked (machine-generated)
│   ├── pr-worker.cartridge
│   ├── pr-worker.cartridge.lock
│   ├── blueprint.cartridge           # Artifact cartridge (future)
│   ├── blueprint.cartridge.lock      # Pins built image ID
│   ├── dataset.cartridge             # Object artifact cartridge (future)
│   └── agent.cartridge               # Agent artifact cartridge (future)
├── .gitignore                        # Should NOT ignore lock files
└── ...
```

File naming convention: `<name>.cartridge` for source, `<name>.cartridge.lock` for locked. Both are YAML — the extension is implicit.


## CI / GitHub Actions Integration

The validate → render → launch pipeline maps naturally to CI workflows:

### PR Validation

```yaml
# .github/workflows/cartridge-validate.yml
on: pull_request
jobs:
  validate:
    steps:
      - run: rli cartridge validate devbox.cartridge --json
      # Posts a status check: "all 5 dependencies exist" or "2 missing objects"
```

### Render on Merge

```yaml
# .github/workflows/cartridge-render.yml
on:
  push:
    branches: [main]
    paths: ['cartridges/*.cartridge']
jobs:
  render:
    steps:
      - run: rli cartridge render cartridges/devbox.cartridge
      - run: |
          git add cartridges/*.cartridge.lock
          git commit -m "chore: re-lock cartridges"
          git push
```

### Production Health Check

```yaml
# .github/workflows/cartridge-verify.yml
on:
  schedule:
    - cron: '0 */6 * * *'  # every 6 hours
jobs:
  verify:
    steps:
      - run: rli cartridge render --verify cartridges/devbox.cartridge.lock
      # Fails if any pinned ID no longer exists
```

The `--verify` check is the lightweight alternative to object locking — rather than preventing deletion at the API level, you detect staleness in CI and alert.


## Open Questions

1. **Should locked cartridges be signed?** A hash or signature would let the server verify the lock file hasn't been tampered with after locking. Adds complexity but strengthens the security story significantly.

2. **Cartridge versioning.** Should the schema have a `version` field for forward compatibility? Probably yes — `schema_version: 1` — so we can evolve the format without breaking existing cartridges.

3. **Secrets in definitions.** Should inline `definitions` support creating secrets? The value has to come from somewhere (env var, stdin, vault). This might be out of scope for the cartridge itself — secrets are the one object where the *value* matters and shouldn't be in a file.

4. **Artifact cartridge lifecycles.** Each artifact type has unique build/publish semantics. Blueprint builds are async and can fail. Object uploads need local validation before pushing large files. Agent publishing is best done through CI (GHA). Should each artifact cartridge type have its own `build`/`publish` subcommand, or should `rli cartridge render` handle all of them? The answer likely varies per type.

5. **Lock file expiry.** Should locked cartridges have a TTL? An object ID could become invalid if the object is deleted. `rli cartridge render --verify` handles this manually, but should there be a built-in staleness check?

6. **Object protection.** When a locked cartridge pins `sec_xyz789`, what happens if someone deletes that secret? Options range from lightweight (periodic `--verify` in CI, as shown above) to heavyweight (server-side reference counting that prevents deletion of objects referenced by locked cartridges). The lightweight approach fits v1; server-side protection could come with Phase 2.

7. **Render automation.** Should `rli cartridge render` support a `--commit` flag that auto-commits the lock file? Or is that better left to CI scripts? Leaning toward keeping render pure (just writes a file) and letting CI handle the git workflow — fewer opinions baked into the tool.


## Future Extension: Explicit Reference Typing

v1 uses implicit type detection for references: a bare string is a name lookup, an object is an inline definition. This is clean and covers the initial use cases well. However, as we add more source types (cartridge imports, lock file references, registry lookups), implicit detection becomes fragile.

A future version could introduce **explicit discriminator keys** while preserving bare-string sugar for the common case:

```yaml
# v1 (implicit) — bare string is always name lookup
blueprint: my-python-env

# Future (explicit) — object with discriminator key
blueprint: { id: bp_abc123 }                    # pinned ID
blueprint: { from: ./blueprint.cartridge.lock }  # cartridge/lock import
blueprint: { name: my-python-env }               # explicit name (equivalent to bare string)

# Inline definitions remain objects WITHOUT discriminator keys
# (they have domain-specific fields instead)
network:
  policy:
    name: restricted
    allowed_hostnames: [github.com, pypi.org]
```

Reserved discriminator keys:

| Key | Meaning |
|-----|---------|
| `id` | Pinned ID reference |
| `from` | Cartridge or lock file path |
| `name` (alone, no other fields) | Name lookup (same as bare string) |

The resolution rule: if it's a string → treat as `{name: value}`. If it's an object → check for a discriminator key (`id`, `from`, or `name` with no sibling fields). If no discriminator found → it's an inline definition.

This also makes locked cartridges more self-documenting — `{ id: bp_abc123 }` is clearer than a bare ID string. For v1, we stick with implicit typing and design the parser so this explicit form can be added backward-compatibly later.


## Non-Goals (v1)

- **Composition/inheritance.** No `import` or `extend` between cartridges. Each cartridge is self-contained. If this becomes a pain point with real usage, revisit in v2.
- **Explicit reference typing.** v1 uses implicit type detection (string = reference, object = inline). Explicit discriminator keys (`id`, `from`) are a future extension (see above).
- **Object lifecycle management.** Cartridges describe creation, not teardown. No `rli cartridge teardown`. We are explicitly not building full IaC state management.
- **Fleet orchestration.** A cartridge describes one resource, not a collection of devboxes.
- **Build-time configuration.** A devbox cartridge is purely runtime. It references existing artifacts (blueprints, objects, agents) by name or ID. Artifact cartridges (blueprint, object, agent) and benchmark cartridges are natural future extensions, each with their own lifecycle considerations.
