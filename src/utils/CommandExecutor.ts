/**
 * Shared class for executing commands with different output formats
 * Reduces code duplication across all command files
 */

import { render } from "ink";
import { getClient } from "./client.js";
import {
  shouldUseNonInteractiveOutput,
  outputList,
  outputResult,
  OutputOptions,
} from "./output.js";
import YAML from "yaml";

export class CommandExecutor<T = unknown> {
  constructor(private options: OutputOptions = {}) {
    // Set default output format to json if none specified
    if (!this.options.output) {
      this.options.output = "json";
    }
  }

  /**
   * Execute a list command with automatic format handling
   */
  async executeList(
    fetchData: () => Promise<T[]>,
    renderUI: () => JSX.Element,
    limit: number = 10,
  ): Promise<void> {
    if (shouldUseNonInteractiveOutput(this.options)) {
      try {
        const items = await fetchData();
        // Limit results for non-interactive mode
        const limitedItems = items.slice(0, limit);
        outputList(limitedItems, this.options);
      } catch (err) {
        this.handleError(err as Error);
      }
      return;
    }

    // Interactive mode
    // Enter alternate screen buffer
    process.stdout.write("\x1b[?1049h");
    console.clear();
    const { waitUntilExit } = render(renderUI());
    await waitUntilExit();
    // Exit alternate screen buffer
    process.stdout.write("\x1b[?1049l");
  }

  /**
   * Execute a create/action command with automatic format handling
   */
  async executeAction(
    performAction: () => Promise<T>,
    renderUI: () => JSX.Element,
  ): Promise<void> {
    if (shouldUseNonInteractiveOutput(this.options)) {
      try {
        const result = await performAction();
        outputResult(result, this.options);
      } catch (err) {
        this.handleError(err as Error);
      }
      return;
    }

    // Interactive mode
    // Enter alternate screen buffer
    process.stdout.write("\x1b[?1049h");
    console.clear();
    const { waitUntilExit } = render(renderUI());
    await waitUntilExit();
    // Exit alternate screen buffer
    process.stdout.write("\x1b[?1049l");
  }

  /**
   * Execute a delete command with automatic format handling
   */
  async executeDelete(
    performDelete: () => Promise<void>,
    id: string,
    renderUI: () => JSX.Element,
  ): Promise<void> {
    if (shouldUseNonInteractiveOutput(this.options)) {
      try {
        await performDelete();
        outputResult({ id, status: "deleted" }, this.options);
      } catch (err) {
        this.handleError(err as Error);
      }
      return;
    }

    // Interactive mode
    // Enter alternate screen buffer
    process.stdout.write("\x1b[?1049h");
    const { waitUntilExit } = render(renderUI());
    await waitUntilExit();
    // Exit alternate screen buffer
    process.stdout.write("\x1b[?1049l");
  }

  /**
   * Fetch items from an async iterator with optional filtering and limits
   */
  async fetchFromIterator<Item>(
    iterator: AsyncIterable<Item>,
    options: {
      filter?: (item: Item) => boolean;
      limit?: number;
    } = {},
  ): Promise<Item[]> {
    const { filter, limit = 100 } = options;
    const items: Item[] = [];
    let count = 0;

    for await (const item of iterator) {
      if (filter && !filter(item)) {
        continue;
      }
      items.push(item);
      count++;
      if (count >= limit) {
        break;
      }
    }

    return items;
  }

  /**
   * Handle errors consistently across all commands
   */
  private handleError(error: Error): never {
    if (this.options.output === "yaml") {
      console.error(YAML.stringify({ error: error.message }));
    } else {
      console.error(JSON.stringify({ error: error.message }, null, 2));
    }
    process.exit(1);
  }

  /**
   * Get the client instance
   */
  getClient() {
    return getClient();
  }
}

/**
 * Factory function to create a CommandExecutor
 */
export function createExecutor(options: OutputOptions = {}): CommandExecutor {
  return new CommandExecutor(options);
}
