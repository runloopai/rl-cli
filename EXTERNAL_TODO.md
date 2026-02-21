# External TODO — API Changes Wanted

Server-side changes that would improve the CLI (and cartridge support specifically).

---

## 1. Secrets: Retrieve by Name

**Priority: High** — Blocks efficient cartridge resolution

Currently there is no way to look up a secret by name. The only option is
`client.secrets.list({ limit: 5000 })` and filter client-side. This is the
pattern used in `src/commands/secret/get.ts`.

**Request:** Add a `GET /secrets/:name` endpoint (or `GET /secrets?name=<name>`)
that returns secret metadata **without** the secret value:

```json
{
  "id": "sec_abc123",
  "name": "MY_API_KEY",
  "created_at": "2025-01-01T00:00:00Z",
  "updated_at": "2025-01-15T00:00:00Z"
}
```

This would bring secrets in line with blueprints, gateway configs, and network
policies — all of which support name-based lookup.

---

## 2. Secrets: Name Filter on List Endpoint

**Priority: High** — Related to #1

Blueprints, gateway configs, and network policies all support a `name` query
parameter on their list endpoints for server-side filtering:

```
client.blueprints.list({ name: "my-blueprint" })       ✓
client.gatewayConfigs.list({ name: "my-config" })       ✓
client.networkPolicies.list({ name: "my-policy" })      ✓
client.secrets.list({ name: "my-secret" })              ✗ — not supported
```

**Request:** Add `name` filter support to `GET /secrets` list endpoint, matching
the existing pattern on other resource types.

---

## 3. Snapshots: Name Filter on List Endpoint

**Priority: Low** — Nice-to-have, not blocking v1

Snapshots support a `devbox_id` filter but not a `name` filter. Currently
cartridges reference snapshots by ID only, but name-based references would be
more user-friendly.

```
client.devboxes.listDiskSnapshots({ devbox_id: "..." })  ✓
client.devboxes.listDiskSnapshots({ name: "..." })       ✗ — not supported
```

**Request:** Add `name` filter support to the snapshot list endpoint.
