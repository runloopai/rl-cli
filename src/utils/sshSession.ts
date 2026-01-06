/**
 * SSH Session types - kept for compatibility and type references
 * Actual SSH session handling is now done via ink-spawn in SSHSessionScreen
 */

export interface SSHSessionConfig {
  keyPath: string;
  proxyCommand: string;
  sshUser: string;
  url: string;
  devboxId: string;
  devboxName: string;
}
