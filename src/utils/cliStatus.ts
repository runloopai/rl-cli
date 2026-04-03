/**
 * Status / progress lines for the CLI. Uses stderr so stdout stays free for
 * data users redirect or pipe (e.g. SSH config snippets, JSON).
 *
 * Prefer this over console.error for non-failure messages—console.error reads
 * like a runtime error to humans and tools.
 */
export function cliStatus(message: string): void {
  process.stderr.write(`${message}\n`);
}
