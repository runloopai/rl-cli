/**
 * Shared validation for MCP config create/update operations.
 * Used by both CLI commands and UI components.
 */

export interface McpConfigValidationInput {
  name?: string;
  endpoint?: string;
  allowedTools?: string;
}

export interface McpConfigValidationResult {
  valid: boolean;
  errors: string[];
  /** Sanitized values (trimmed) - only present when valid */
  sanitized?: {
    name?: string;
    endpoint?: string;
    allowedTools?: string[];
  };
}

/**
 * Validate and sanitize MCP config fields.
 *
 * @param input - The fields to validate
 * @param opts.requireName - Whether name is required (true for create, false for update)
 * @param opts.requireEndpoint - Whether endpoint is required (true for create, false for update)
 * @param opts.requireAllowedTools - Whether allowed_tools is required (true for create, false for update)
 */
export function validateMcpConfig(
  input: McpConfigValidationInput,
  opts: {
    requireName?: boolean;
    requireEndpoint?: boolean;
    requireAllowedTools?: boolean;
  } = {},
): McpConfigValidationResult {
  const errors: string[] = [];

  const name = input.name?.trim();
  const endpoint = input.endpoint?.trim();
  const rawTools = input.allowedTools?.trim();

  if (opts.requireName && !name) {
    errors.push("Name is required");
  }

  if (opts.requireEndpoint && !endpoint) {
    errors.push("Endpoint URL is required");
  }
  if (endpoint) {
    if (!endpoint.startsWith("https://") && !endpoint.startsWith("http://")) {
      errors.push(
        "Endpoint must be a valid URL starting with https:// or http://",
      );
    }

    try {
      new URL(endpoint);
    } catch {
      errors.push("Endpoint is not a valid URL");
    }
  }

  const allowedTools = rawTools
    ? rawTools
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

  if (opts.requireAllowedTools && allowedTools.length === 0) {
    errors.push(
      "At least one allowed tool pattern is required (e.g., '*' for all tools)",
    );
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
      allowedTools: allowedTools.length > 0 ? allowedTools : undefined,
    },
  };
}
