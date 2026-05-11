/**
 * Summary benchmark job command
 */

import { getBenchmarkJob } from "../../services/benchmarkJobService.js";
import { output, outputError } from "../../utils/output.js";

interface SummaryOptions {
  output?: string;
  extended?: boolean;
}

export async function summaryBenchmarkJob(
  id: string,
  options: SummaryOptions = {},
) {
  try {
    const job = await getBenchmarkJob(id);
    output(job, { format: options.output, defaultFormat: "json" });
  } catch (error) {
    outputError("Failed to get benchmark job summary", error);
  }
}
