/**
 * Shared validation for gateway config create/update operations.
 * Used by both CLI commands and UI components.
 */

export interface GatewayConfigValidationInput {
  name?: string;
  endpoint?: string;
  authType?: string;
  authKey?: string;
}

export interface GatewayConfigValidationResult {
  valid: boolean;
  errors: string[];
  /** Sanitized values (trimmed) - only present when valid */
  sanitized?: {
    name?: string;
    endpoint?: string;
    authType?: string;
    authKey?: string;
  };
}

/**
 * Validate and sanitize gateway config fields.
 *
 * @param input - The fields to validate
 * @param opts.requireName - Whether name is required (true for create, false for update)
 * @param opts.requireEndpoint - Whether endpoint is required (true for create, false for update)
 */
export function validateGatewayConfig(
  input: GatewayConfigValidationInput,
  opts: { requireName?: boolean; requireEndpoint?: boolean } = {},
): GatewayConfigValidationResult {
  const errors: string[] = [];

  const name = input.name?.trim();
  const endpoint = input.endpoint?.trim();
  const authType = input.authType?.toLowerCase();
  const authKey = input.authKey?.trim();

  // Name validation
  if (opts.requireName && !name) {
    errors.push("Name is required");
  }

  // Endpoint validation
  if (opts.requireEndpoint && !endpoint) {
    errors.push("Endpoint URL is required");
  }
  if (endpoint) {
    if (!endpoint.startsWith("https://") && !endpoint.startsWith("http://")) {
      errors.push(
        "Endpoint must be a valid URL starting with https:// or http://",
      );
    }

    // Basic URL structure validation
    try {
      new URL(endpoint);
    } catch {
      errors.push("Endpoint is not a valid URL");
    }
  }

  // Auth validation
  if (authType && authType !== "bearer" && authType !== "header") {
    errors.push('Auth type must be either "bearer" or "header"');
  }
  if (authType === "header" && !authKey) {
    errors.push("Auth header key is required when using header authentication");
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    sanitized: {
      name,
      endpoint,
      authType,
      authKey,
    },
  };
}
