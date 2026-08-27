import { completeBenchmarkRun } from "../../services/benchmarkService.js";
import { output, outputError } from "../../utils/output.js";

export async function completeBenchmarkRunCommand(
  id: string,
  options: { output?: string },
) {
  try {
    const result = await completeBenchmarkRun(id);
    output(result, { format: options.output, defaultFormat: "json" });
  } catch (error) {
    outputError("Failed to complete benchmark run", error);
  }
}
