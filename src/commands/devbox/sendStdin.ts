/**
 * Send stdin to a running async execution
 */

import { getClient } from "../../utils/client.js";
import { output, outputError } from "../../utils/output.js";

interface SendStdinOptions {
  text?: string;
  signal?: string;
  output?: string;
}

export async function sendStdin(
  devboxId: string,
  executionId: string,
  options: SendStdinOptions = {},
) {
  try {
    // Validate that either text or signal is provided, but not both
    if (!options.text && !options.signal) {
      outputError("Either --text or --signal must be specified");
    }
    if (options.text && options.signal) {
      outputError("Only one of --text or --signal can be specified");
    }

    const client = getClient();

    // Build the request body
    const requestBody: Record<string, unknown> = {};
    if (options.text) {
      requestBody.text = options.text;
    }
    if (options.signal) {
      requestBody.signal = options.signal;
    }

    const result = await client.devboxes.executions.sendStdIn(
      devboxId,
      executionId,
      requestBody,
    );

    // Default: just confirm success for text output
    if (!options.output || options.output === "text") {
      if (options.text) {
        console.log(`Sent text to execution ${executionId}`);
      } else {
        console.log(
          `Sent ${options.signal} signal to execution ${executionId}`,
        );
      }
    } else {
      output(result, { format: options.output, defaultFormat: "json" });
    }
  } catch (error) {
    outputError("Failed to send stdin", error);
  }
}
