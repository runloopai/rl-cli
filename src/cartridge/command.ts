/**
 * Cartridge CLI commands
 */

import { parseCartridge } from "./parser.js";
import { resolveCartridge } from "./resolver.js";
import { applyCartridge } from "./applier.js";
import { output, outputError } from "../utils/output.js";
import { processUtils } from "../utils/processUtils.js";

export async function validateCartridge(
  file: string,
  options: { json?: boolean } = {},
) {
  let cartridge;
  try {
    cartridge = parseCartridge(file);
  } catch (err) {
    outputError("Failed to parse cartridge", err);
  }

  console.log(`Validating cartridge: ${cartridge.name}`);
  console.log();

  let report;
  try {
    report = await resolveCartridge(cartridge);
  } catch (err) {
    outputError("Failed to resolve cartridge references", err);
  }

  // Print report
  for (const ref of report.references) {
    if (ref.isInline) {
      const marker = ref.found ? "\u2713" : "~";
      const status = ref.found ? "exists" : "will create";
      console.log(`  ${marker} ${ref.type}: ${ref.cartridgeName} (${status})`);
    } else {
      const marker = ref.found ? "\u2713" : "\u2717";
      const status = ref.found ? ref.resolvedId : "NOT FOUND";
      console.log(`  ${marker} ${ref.type}: ${ref.cartridgeName} -> ${status}`);
    }
  }

  console.log();

  if (report.allResolved) {
    console.log("\u2713 All references resolved");
    if (report.inlineToCreate.length > 0) {
      console.log(
        `  ${report.inlineToCreate.length} inline object(s) will be created on launch`,
      );
    }
  } else {
    console.log(
      `\u2717 ${report.missingReferences.length} reference(s) not found`,
    );
    for (const ref of report.missingReferences) {
      console.log(`  - ${ref.type}: ${ref.cartridgeName}`);
    }
  }

  if (options.json) {
    output(report, { format: "json" });
  }

  processUtils.exit(report.allResolved ? 0 : 1);
}

export async function launchCartridge(
  file: string,
  options: { dryRun?: boolean; lockedOnly?: boolean; output?: string } = {},
) {
  let cartridge;
  try {
    cartridge = parseCartridge(file);
  } catch (err) {
    outputError("Failed to parse cartridge", err);
  }

  if (options.lockedOnly && !cartridge.locked) {
    outputError(
      "Cartridge is not locked. Use 'cartridge validate' to check, or remove --locked-only.",
    );
  }

  console.log(`Resolving cartridge: ${cartridge.name}`);

  let report;
  try {
    report = await resolveCartridge(cartridge);
  } catch (err) {
    outputError("Failed to resolve cartridge references", err);
  }

  if (!report.allResolved) {
    console.error(
      `\n\u2717 ${report.missingReferences.length} reference(s) not found:\n`,
    );
    for (const ref of report.missingReferences) {
      console.error(`  \u2717 ${ref.type}: ${ref.cartridgeName}`);
      // Print hint commands
      switch (ref.type) {
        case "blueprint":
          console.error(`    hint: rli blueprint list`);
          break;
        case "snapshot":
          console.error(`    hint: rli snapshot list`);
          break;
        case "secret":
          console.error(`    hint: rli secret create <name>`);
          break;
        case "network_policy":
          console.error(`    hint: rli network-policy list`);
          break;
        case "gateway_config":
          console.error(`    hint: rli gateway-config list`);
          break;
      }
    }
    processUtils.exit(1);
  }

  // Dry run — print what would happen and exit
  if (options.dryRun) {
    console.log(`\n\u2713 All references resolved`);

    for (const ref of report.references) {
      const marker = ref.isInline ? (ref.found ? "\u2713" : "~") : "\u2713";
      console.log(`  ${marker} ${ref.type}: ${ref.cartridgeName}`);
    }

    if (report.inlineToCreate.length > 0) {
      console.log(`\nWould create:`);
      for (const ref of report.inlineToCreate) {
        console.log(`  + ${ref.type}: ${ref.cartridgeName}`);
      }
    }

    console.log(`\nWould create devbox: ${cartridge.name}`);
    processUtils.exit(0);
  }

  // Apply
  console.log("Launching devbox...");

  let result;
  try {
    result = await applyCartridge(cartridge, report);
  } catch (err) {
    outputError("Failed to launch devbox", err);
  }

  if (result.createdObjects.length > 0) {
    console.log("\nCreated:");
    for (const obj of result.createdObjects) {
      console.log(`  + ${obj.type}: ${obj.name} (${obj.id})`);
    }
  }

  console.log(`\n\u2713 Devbox created: ${result.devboxId}`);

  if (options.output === "json") {
    output(result, { format: "json" });
  }
}
