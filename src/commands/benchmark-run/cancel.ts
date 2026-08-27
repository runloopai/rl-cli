import { cancelBenchmarkRun } from "../../services/benchmarkService.js";
import { output, outputError } from "../../utils/output.js";

export async function cancelBenchmarkRunCommand(
  id: string,
  options: { output?: string },
) {
  try {
    const result = await cancelBenchmarkRun(id);
    output(result, { format: options.output, defaultFormat: "json" });
  } catch (error) {
    outputError("Failed to cancel benchmark run", error);
  }
}
