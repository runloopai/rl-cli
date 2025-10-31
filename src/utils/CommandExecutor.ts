/**
 * Shared class for executing commands with different output formats
 * Reduces code duplication across all command files
 */

import React from "react";
import { render } from "ink";
import { getClient } from "./client.js";
import {
  shouldUseNonInteractiveOutput,
  outputList,
  outputResult,
  OutputOptions,
} from "./output.js";
import {
  enableSynchronousUpdates,
  disableSynchronousUpdates,
} from "./terminalSync.js";
import {
  exitAlternateScreenBuffer,
  enterAlternateScreenBuffer,
} from "./screen.js";
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
    renderUI: () => React.ReactElement,
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
    // Enter alternate screen buffer (this automatically clears the screen)

    enableSynchronousUpdates();

    const { waitUntilExit } = render(renderUI(), {
      patchConsole: false,
      exitOnCtrlC: false,
    });
    await waitUntilExit();

    // Exit alternate screen buffer
    disableSynchronousUpdates();
    exitAlternateScreenBuffer();
  }

  /**
   * Execute a create/action command with automatic format handling
   */
  async executeAction(
    performAction: () => Promise<T>,
    renderUI: () => React.ReactElement,
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
    // Enter alternate screen buffer (this automatically clears the screen)
    enterAlternateScreenBuffer();
    enableSynchronousUpdates();

    const { waitUntilExit } = render(renderUI(), {
      patchConsole: false,
      exitOnCtrlC: false,
    });
    await waitUntilExit();

    // Exit alternate screen buffer
    disableSynchronousUpdates();
    exitAlternateScreenBuffer();
  }

  /**
   * Execute a delete command with automatic format handling
   */
  async executeDelete(
    performDelete: () => Promise<void>,
    id: string,
    renderUI: () => React.ReactElement,
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
    enterAlternateScreenBuffer();
    enableSynchronousUpdates();

    const { waitUntilExit } = render(renderUI(), {
      patchConsole: false,
      exitOnCtrlC: false,
    });
    await waitUntilExit();

    // Exit alternate screen buffer
    disableSynchronousUpdates();
    exitAlternateScreenBuffer();
  }

  /**
   * Fetch items from an async iterator with optional filtering and limits
   * IMPORTANT: This method tries to access the page data directly first to avoid
   * auto-pagination issues that can cause memory errors with large datasets.
   */
  async fetchFromIterator<Item>(
    iterator: AsyncIterable<Item>,
    options: {
      filter?: (item: Item) => boolean;
      limit?: number;
    } = {},
  ): Promise<Item[]> {
    const { filter, limit = 100 } = options;
    let items: Item[] = [];

    // Try to access page data directly to avoid auto-pagination
    const pageData = (iterator as any).data || (iterator as any).items;
    if (pageData && Array.isArray(pageData)) {
      items = pageData;
    } else {
      // Fall back to iteration with limit
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
    }

    // Apply filter if provided
    if (filter) {
      items = items.filter(filter);
    }

    // Apply limit
    return items.slice(0, limit);
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
