/**
 * Cartridge schema types
 */

export interface DevboxCartridge {
  kind: "devbox";
  name: string;

  // Lock metadata
  locked?: boolean;
  locked_at?: string;
  locked_by?: string;

  // Layer 0 — reference-only
  blueprint?: string;
  snapshot?: string;

  // Compute
  resources?: {
    size: string;
    custom_cpu?: number;
    custom_memory?: number;
    custom_disk?: number;
  };
  architecture?: string;

  // Lifecycle
  idle?: { timeout_seconds: number; action: "suspend" | "shutdown" };
  keep_alive_seconds?: number;

  // Layer 1 — secrets (reference-only)
  secrets?: Record<string, string>; // ENV_VAR -> secret name or ID

  // Layer 2 — network (reference or inline)
  network?: {
    policy?: string | NetworkPolicyInline;
    tunnel?: "open" | "authenticated";
  };

  // Layer 2 — gateways (config can be reference or inline)
  gateways?: Record<
    string,
    {
      config: string | GatewayConfigInline;
      secret: string; // reference-only
    }
  >;

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

export interface NetworkPolicyInline {
  name: string;
  description?: string;
  allow_all?: boolean;
  allow_devbox_to_devbox?: boolean;
  allowed_hostnames?: string[];
}

export interface GatewayConfigInline {
  name: string;
  endpoint: string;
  auth_mechanism: {
    type: string;
    key?: string;
  };
  description?: string;
}

export interface ResolvedReference {
  type: "blueprint" | "snapshot" | "secret" | "network_policy" | "gateway_config";
  cartridgeName: string;
  resolvedId: string | null;
  found: boolean;
  isInline: boolean;
}

export interface ResolutionReport {
  cartridgeName: string;
  references: ResolvedReference[];
  allResolved: boolean;
  missingReferences: ResolvedReference[];
  inlineToCreate: ResolvedReference[];
}

export interface ApplyResult {
  devboxId: string;
  createdObjects: Array<{ type: string; name: string; id: string }>;
}
