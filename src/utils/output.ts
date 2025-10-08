/**
 * Utility for handling different output formats across CLI commands
 */

import YAML from "yaml";

export type OutputFormat = "text" | "json" | "yaml";

export interface OutputOptions {
  output?: string;
}

/**
 * Check if the command should use non-interactive output
 */
export function shouldUseNonInteractiveOutput(options: OutputOptions): boolean {
  return !!options.output;
}

/**
 * Output data in the specified format
 */
export function outputData(data: any, format: OutputFormat = "json"): void {
  if (format === "json") {
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  if (format === "yaml") {
    console.log(YAML.stringify(data));
    return;
  }

  if (format === "text") {
    // Simple text output
    if (Array.isArray(data)) {
      // For lists of complex objects, just output IDs
      data.forEach((item) => {
        if (typeof item === "object" && item !== null && "id" in item) {
          console.log(item.id);
        } else {
          console.log(formatTextOutput(item));
        }
      });
    } else {
      console.log(formatTextOutput(data));
    }
    return;
  }

  console.error(`Unknown output format: ${format}`);
  process.exit(1);
}

/**
 * Format a single item as text output
 */
function formatTextOutput(item: any): string {
  if (typeof item === "string") {
    return item;
  }

  // For objects, create a simple key: value format
  const lines: string[] = [];
  for (const [key, value] of Object.entries(item)) {
    if (value !== null && value !== undefined) {
      lines.push(`${key}: ${value}`);
    }
  }
  return lines.join("\n");
}

/**
 * Output a single result (for create, delete, etc)
 */
export function outputResult(
  result: any,
  options: OutputOptions,
  successMessage?: string,
): void {
  if (shouldUseNonInteractiveOutput(options)) {
    outputData(result, options.output as OutputFormat);
    return;
  }

  // Interactive mode - print success message
  if (successMessage) {
    console.log(successMessage);
  }
}

/**
 * Output a list of items (for list commands)
 */
export function outputList(items: any[], options: OutputOptions): void {
  if (shouldUseNonInteractiveOutput(options)) {
    outputData(items, options.output as OutputFormat);
  }
}

/**
 * Handle errors in both interactive and non-interactive modes
 */
export function outputError(error: Error, options: OutputOptions): void {
  if (shouldUseNonInteractiveOutput(options)) {
    if (options.output === "json") {
      console.error(JSON.stringify({ error: error.message }, null, 2));
    } else if (options.output === "yaml") {
      console.error(YAML.stringify({ error: error.message }));
    } else {
      console.error(`Error: ${error.message}`);
    }
    process.exit(1);
  }

  // Let interactive UI handle the error
  throw error;
}

/**
 * Validate output format option
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
  process.exit(1);
}
