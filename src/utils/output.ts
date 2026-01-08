/**
 * Utility for handling different output formats across CLI commands
 *
 * Simple API:
 * - output(data, options) - outputs data in specified format
 * - outputError(message, error) - outputs error and exits
 */

import YAML from "yaml";
import { processUtils } from "./processUtils.js";

export type OutputFormat = "text" | "json" | "yaml";

export interface OutputOptions {
  output?: string;
}

/**
 * Options for the simplified output function
 */
export interface SimpleOutputOptions {
  /** The format to use (json, yaml, text). If not provided, uses defaultFormat */
  format?: string;
  /** The default format if none specified. Defaults to 'json' */
  defaultFormat?: OutputFormat;
}

/**
 * Resolve the output format from options
 */
function resolveFormat(options: SimpleOutputOptions): OutputFormat {
  const format = options.format || options.defaultFormat || "json";

  if (format === "json" || format === "yaml" || format === "text") {
    return format;
  }

  console.error(
    `Unknown output format: ${format}. Valid options: text, json, yaml`,
  );
  processUtils.exit(1);
}

/**
 * Format a value for text output (key-value pairs)
 */
function formatKeyValue(data: unknown, indent: number = 0): string {
  const prefix = "  ".repeat(indent);

  if (data === null || data === undefined) {
    return `${prefix}(none)`;
  }

  if (
    typeof data === "string" ||
    typeof data === "number" ||
    typeof data === "boolean"
  ) {
    return String(data);
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return `${prefix}(empty)`;
    }
    // For arrays of primitives, join them
    if (data.every((item) => typeof item !== "object" || item === null)) {
      return data.join(", ");
    }
    // For arrays of objects, format each with separator
    return data
      .map((item) => {
        if (typeof item === "object" && item !== null) {
          const lines: string[] = [];
          for (const [key, value] of Object.entries(item)) {
            if (value !== null && value !== undefined) {
              const formattedValue =
                typeof value === "object"
                  ? formatKeyValue(value, indent + 1)
                  : String(value);
              lines.push(`${prefix}${key}: ${formattedValue}`);
            }
          }
          return lines.join("\n");
        }
        return `${prefix}${item}`;
      })
      .join(`\n${prefix}---\n`);
  }

  if (typeof data === "object") {
    const lines: string[] = [];
    for (const [key, value] of Object.entries(data)) {
      if (value !== null && value !== undefined) {
        if (typeof value === "object" && !Array.isArray(value)) {
          lines.push(`${prefix}${key}:`);
          lines.push(formatKeyValue(value, indent + 1));
        } else if (Array.isArray(value)) {
          lines.push(`${prefix}${key}: ${formatKeyValue(value, 0)}`);
        } else {
          lines.push(`${prefix}${key}: ${value}`);
        }
      }
    }
    return lines.join("\n");
  }

  return String(data);
}

/**
 * Main output function - outputs data in the specified format
 *
 * @param data - The data to output
 * @param options - Output options (format, defaultFormat)
 *
 * @example
 * // Output a devbox as text (default for single items)
 * output(devbox, { format: options.output, defaultFormat: 'text' });
 *
 * @example
 * // Output a list as JSON (default for lists)
 * output(devboxes, { format: options.output, defaultFormat: 'json' });
 */
export function output(data: unknown, options: SimpleOutputOptions = {}): void {
  const format = resolveFormat(options);

  if (format === "json") {
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  if (format === "yaml") {
    console.log(YAML.stringify(data));
    return;
  }

  // Text format - key-value pairs
  console.log(formatKeyValue(data));
}

/**
 * Output an error message and exit
 *
 * @param message - Human-readable error message
 * @param error - Optional Error object with details
 *
 * @example
 * outputError('Failed to get devbox', error);
 */
export function outputError(message: string, error?: Error | unknown): never {
  const errorMessage =
    error instanceof Error ? error.message : String(error || message);
  console.error(`Error: ${message}`);
  if (error && errorMessage !== message) {
    console.error(`  ${errorMessage}`);
  }
  processUtils.exit(1);
}

/**
 * Output a success message for action commands
 *
 * @param message - Success message
 * @param data - Optional data to include
 * @param options - Output options
 */
export function outputSuccess(
  message: string,
  data?: unknown,
  options: SimpleOutputOptions = {},
): void {
  const format = resolveFormat(options);

  if (format === "json") {
    console.log(
      JSON.stringify(
        {
          success: true,
          message,
          ...(data && typeof data === "object" ? data : { data }),
        },
        null,
        2,
      ),
    );
    return;
  }

  if (format === "yaml") {
    console.log(
      YAML.stringify({
        success: true,
        message,
        ...(data && typeof data === "object" ? data : { data }),
      }),
    );
    return;
  }

  // Text format
  console.log(`✓ ${message}`);
  if (data) {
    console.log(formatKeyValue(data));
  }
}

// ============================================================================
// Legacy API (for backward compatibility during migration)
// ============================================================================

/**
 * @deprecated Use output() instead
 */
export function shouldUseNonInteractiveOutput(options: OutputOptions): boolean {
  return !!options.output && options.output !== "interactive";
}

/**
 * @deprecated Use output() instead
 */
export function outputData(data: unknown, format: OutputFormat = "json"): void {
  output(data, { format, defaultFormat: format });
}

/**
 * @deprecated Use output() instead
 */
export function outputResult(
  result: unknown,
  options: OutputOptions,
  successMessage?: string,
): void {
  if (shouldUseNonInteractiveOutput(options)) {
    output(result, { format: options.output, defaultFormat: "text" });
    return;
  }

  // Interactive mode - print success message
  if (successMessage) {
    console.log(successMessage);
  }
}

/**
 * @deprecated Use output() instead
 */
export function outputList(items: unknown[], options: OutputOptions): void {
  if (shouldUseNonInteractiveOutput(options)) {
    output(items, { format: options.output, defaultFormat: "json" });
  }
}

/**
 * @deprecated Use validateOutputFormat with the new output() function
 */
export function validateOutputFormat(format?: string): OutputFormat {
  if (!format || format === "text") {
    return "text";
  }

  if (format === "json") {
    return "json";
  }

  if (format === "yaml") {
    return "yaml";
  }

  console.error(
    `Unknown output format: ${format}. Valid options: text, json, yaml`,
  );
  processUtils.exit(1);
}
