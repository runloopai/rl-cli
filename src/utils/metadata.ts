export function parseMetadata(metadata: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const item of metadata) {
    const eqIndex = item.indexOf("=");
    if (eqIndex === -1) {
      throw new Error(`Invalid metadata format: ${item}. Expected key=value`);
    }
    const key = item.substring(0, eqIndex);
    const value = item.substring(eqIndex + 1);
    result[key] = value;
  }
  return result;
}
