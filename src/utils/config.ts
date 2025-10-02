import Conf from 'conf';

interface Config {
  apiKey?: string;
}

const config = new Conf<Config>({
  projectName: 'runloop-cli',
});

export function getConfig(): Config {
  // Check environment variable first, then fall back to stored config
  const apiKey = process.env.RUNLOOP_API_KEY || config.get('apiKey');

  return {
    apiKey,
  };
}

export function setApiKey(apiKey: string): void {
  config.set('apiKey', apiKey);
}

export function clearConfig(): void {
  config.clear();
}
