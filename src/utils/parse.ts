/**
 * Parse KEY=value format strings into a Record
 */
export function parseEnvVars(envVars: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const envVar of envVars) {
    const eqIndex = envVar.indexOf("=");
    if (eqIndex === -1) {
      throw new Error(
        `Invalid environment variable format: ${envVar}. Expected KEY=value`,
      );
    }
    const key = envVar.substring(0, eqIndex);
    const value = envVar.substring(eqIndex + 1);
    result[key] = value;
  }
  return result;
}

/**
 * Parse ENV_VAR=SECRET_NAME format strings into a Record
 */
export function parseSecrets(secrets: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const secret of secrets) {
    const eqIndex = secret.indexOf("=");
    if (eqIndex === -1) {
      throw new Error(
        `Invalid secret format: ${secret}. Expected ENV_VAR=SECRET_NAME`,
      );
    }
    const envVarName = secret.substring(0, eqIndex);
    const secretName = secret.substring(eqIndex + 1);
    result[envVarName] = secretName;
  }
  return result;
}
