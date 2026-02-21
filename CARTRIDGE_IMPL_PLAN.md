# Cartridge v1 — Implementation Plan

## Goal

Quick prototype. No tests. Get something working end-to-end so we can play with it.
Launch a devbox from a `.cartridge` file with validation and inline object creation.

---

## Dependency Layers

When applying a cartridge, objects must be resolved/created in order because
later layers depend on earlier ones.

```
Layer 0 — Reference-only (must already exist, cannot be created from cartridge)
  ├── Blueprints     (build-time artifact, async lifecycle)
  ├── Snapshots      (created from running devboxes)
  ├── Code Mounts    (external repo references)
  └── Agent Mounts   (external agent references)

Layer 1 — Secrets (reference-only, but resolved before Layer 2 because gateways depend on them)
  └── Secrets        (values never in cartridge, must pre-exist)

Layer 2 — Helper objects (independent of each other, can be created from inline definitions)
  ├── Network Policy (one per cartridge)
  ├── Gateway Configs (N per cartridge, each paired with a secret from Layer 1)
  └── MCP Configs    (future)

Layer 3 — Devbox (final assembly — references everything above)
  └── Devbox create call with all resolved IDs
```

---

## File Structure

All new code goes under `src/cartridge/`:

```
src/cartridge/
├── types.ts              # Cartridge schema types
├── parser.ts             # YAML parsing + validation
├── resolver.ts           # Resolve references (name→ID), verify existence
├── applier.ts            # Create missing inline objects, assemble devbox create call
└── command.ts            # Commander command registration + CLI output
```

Plus one edit to wire it up:
- `src/utils/commands.ts` — add `cartridge` command group

---

## Milestone 1: Schema + Types

**File: `src/cartridge/types.ts`**

Define the TypeScript types for the cartridge schema. Key design:
- Union types for reference vs inline: `string | InlineSpec`
- Separate `CartridgeSource` and `CartridgeLocked` types sharing a base
- `kind: "devbox"` discriminator for future cartridge types

```typescript
// Core types to define:

interface DevboxCartridge {
  kind: "devbox";
  name: string;

  // Lock metadata (only in .cartridge.lock files)
  locked?: boolean;
  locked_at?: string;
  locked_by?: string;

  // Layer 0 — reference-only
  blueprint?: string;       // name or ID
  snapshot?: string;        // ID only

  // Compute
  resources?: { size: string; custom_cpu?: number; custom_memory?: number; custom_disk?: number };
  architecture?: string;

  // Lifecycle
  idle?: { timeout_seconds: number; action: "suspend" | "shutdown" };
  keep_alive_seconds?: number;

  // Layer 1 — secrets (reference-only)
  secrets?: Record<string, string>;  // ENV_VAR → secret name or ID

  // Layer 2 — network (reference or inline)
  network?: {
    policy?: string | NetworkPolicyInline;
    tunnel?: "open" | "authenticated";
  };

  // Layer 2 — gateways (config can be reference or inline)
  gateways?: Record<string, {
    config: string | GatewayConfigInline;
    secret: string;  // reference-only
  }>;

  // Launch config
  launch?: {
    entrypoint?: string;
    commands?: string[];
    env?: Record<string, string>;
    ports?: number[];
    user?: string;
    code_mounts?: Array<{ repo_url: string; install_command?: string }>;
  };

  metadata?: Record<string, string>;
}

interface NetworkPolicyInline {
  name: string;
  description?: string;
  allow_all?: boolean;
  allow_devbox_to_devbox?: boolean;
  allowed_hostnames?: string[];
}

interface GatewayConfigInline {
  name: string;
  endpoint: string;
  auth_mechanism: {
    type: "bearer" | "header";
    key?: string;   // only if type: "header"
  };
  description?: string;
}
```

---

## Milestone 2: Parser

**File: `src/cartridge/parser.ts`**

Responsibilities:
- Read file from disk (handle file-not-found with clear error)
- Parse YAML (use `yaml` package — already installed as a dependency)
- Basic structural validation (required fields: `kind`, `name`)
- Detect if file is locked (presence of `locked: true`)
- Return typed `DevboxCartridge` object

```typescript
export function parseCartridge(filePath: string): DevboxCartridge
```

Error cases:
- File not found → `Error: Cartridge file not found: <path>`
- Invalid YAML → `Error: Failed to parse cartridge: <yaml error>`
- Missing `kind` → `Error: Cartridge missing required field: kind`
- Unknown `kind` → `Error: Unsupported cartridge kind: <kind>. Supported: devbox`
- Missing `name` → `Error: Cartridge missing required field: name`

Note: `yaml` ^2.8.2 is already in package.json — no install needed.

---

## Milestone 3: Resolver

**File: `src/cartridge/resolver.ts`**

Responsibilities:
- Walk the cartridge and resolve every reference to verify it exists
- For names: query the backend (using existing service functions)
- For IDs: verify they exist (using existing service functions)
- Collect results into a resolution report
- Does NOT create anything

Uses existing services:
- `getBlueprintByIdOrName()` from `services/blueprintService.ts`
- `getGatewayConfigByIdOrName()` from `services/gatewayConfigService.ts`
- Secret lookup: `client.secrets.list({ limit: 5000 })` and filter by name
  (see `commands/secret/get.ts` pattern — no name filter on API, see EXTERNAL_TODO.md)
- Network policy by name: `listNetworkPolicies({ search: name })` — API supports
  `name` filter already, just need a `getNetworkPolicyByIdOrName()` helper in service
- Snapshot by ID: `client.devboxes.diskSnapshots.queryStatus(id)` for verification
  (returns `{ status, snapshot }` — see `snapshotService.ts:getSnapshot()`)

```typescript
interface ResolvedReference {
  type: "blueprint" | "snapshot" | "secret" | "network_policy" | "gateway_config";
  cartridgeName: string;     // what the cartridge specified
  resolvedId: string | null; // null if not found
  found: boolean;
  isInline: boolean;         // true if this was an inline definition
}

interface ResolutionReport {
  cartridgeName: string;
  references: ResolvedReference[];
  allResolved: boolean;      // true if all non-inline references found
  missingReferences: ResolvedReference[];  // references that must exist but don't
  inlineToCreate: ResolvedReference[];     // inline definitions that need creation
}

export async function resolveCartridge(cartridge: DevboxCartridge): Promise<ResolutionReport>
```

Resolution logic per layer:

**Layer 0 (blueprint, snapshot):**
- String value → look up by name or ID → must exist
- Not found → add to `missingReferences` with hint command

**Layer 1 (secrets):**
- Always string → list all secrets, find by name → must exist
- Not found → add to `missingReferences`

**Layer 2 (network policy, gateway configs):**
- String value → look up by name or ID → must exist
- Object value (inline) → look up by `name` field
  - Found → use existing (no diff for v1, just accept)
  - Not found → add to `inlineToCreate`

---

## Milestone 4: Applier

**File: `src/cartridge/applier.ts`**

Responsibilities:
- Takes a cartridge + resolution report
- Creates any inline objects that need creation (Layer 2)
- Assembles the final `devboxes.create` call with all resolved IDs
- Executes the create

```typescript
interface ApplyResult {
  devboxId: string;
  createdObjects: Array<{ type: string; name: string; id: string }>;
}

export async function applyCartridge(
  cartridge: DevboxCartridge,
  report: ResolutionReport,
): Promise<ApplyResult>
```

Apply order (follows dependency layers):

```
1. Bail if any missingReferences (hard errors)
2. Create inline network policies (Layer 2)
   → use createNetworkPolicy() from networkPolicyService
3. Create inline gateway configs (Layer 2)
   → use createGatewayConfig() from gatewayConfigService
4. Assemble devbox create params:
   - blueprint → resolved ID
   - snapshot → resolved ID
   - secrets → map of ENV_VAR → resolved secret name (API takes names)
   - network_policy_id → resolved ID
   - gateways → map of ENV_PREFIX → { gateway: resolved config ID, secret: resolved secret name }
   - resources, architecture, idle, launch, tunnel → pass through from cartridge
5. Call client.devboxes.create(params)
6. Return devbox ID + list of created objects
```

---

## Milestone 5: CLI Command

**File: `src/cartridge/command.ts`**

Register `rli cartridge` command group with subcommands.

### `rli cartridge validate <file>`

```
1. Parse cartridge file
2. Run resolver
3. Print resolution report:
   - References (must exist): ✓/✗ per item
   - Inline definitions (find or create): ✓/~ per item
4. Exit 0 if all references exist, exit 1 if any missing
```

Flags: `--json` for machine-readable output

### `rli cartridge launch <file>`

```
1. Parse cartridge file
2. Run resolver
3. If missing references → print errors with hint commands, exit 1
4. Run applier (creates inline objects + launches devbox)
5. Print result: created objects + devbox ID
```

Flags:
- `--dry-run` — stop after step 3, print what would happen
- `--locked-only` — reject if cartridge is not locked
- `--output json|text`

### Wiring into CLI

Edit `src/utils/commands.ts`:

```typescript
// Add at the end of createProgram():
const cartridge = program
  .command("cartridge")
  .description("Manage cartridge configurations")
  .alias("c");

cartridge
  .command("validate <file>")
  .description("Validate a cartridge against cloud state")
  .option("--json", "Output as JSON")
  .action(async (file, options) => {
    const { validateCartridge } = await import("../cartridge/command.js");
    await validateCartridge(file, options);
  });

cartridge
  .command("launch <file>")
  .description("Launch a devbox from a cartridge")
  .option("--dry-run", "Show what would happen without doing it")
  .option("--locked-only", "Only accept locked cartridges")
  .option("-o, --output [format]", "Output format: text|json")
  .action(async (file, options) => {
    const { launchCartridge } = await import("../cartridge/command.js");
    await launchCartridge(file, options);
  });
```

---

## Implementation Order

```
Step 1: Create src/cartridge/types.ts
Step 2: Create src/cartridge/parser.ts  (yaml package already installed)
Step 3: Create src/cartridge/resolver.ts
        (add getNetworkPolicyByIdOrName() to networkPolicyService.ts)
        (add getSecretByName() helper — list-all + filter until API supports name lookup)
Step 4: Create src/cartridge/applier.ts
Step 5: Create src/cartridge/command.ts
Step 6: Wire into src/utils/commands.ts
Step 7: Build and test with a real cartridge file
```

Note: All imports must use `.js` extensions (ESM with `"module": "NodeNext"`).

---

## Example Test Cartridge

Create `examples/devbox.cartridge` to test with:

```yaml
kind: devbox
name: cartridge-test

blueprint: default

resources:
  size: SMALL

launch:
  entrypoint: /bin/bash
  env:
    TEST: "true"
  ports: [8080]
```

Start simple (just a blueprint reference), then layer in secrets, gateways, network policies as each part works.

---

## What We're NOT Doing (v1 Prototype)

- No `render` command (lock file generation)
- No `diff` command
- No `init` command
- No tests
- No schema validation beyond required fields
- No spec diffing for inline objects (just accept if name matches)
- No caching of resolution results
- No fancy Ink UI — just console.log output with ✓/✗ markers
