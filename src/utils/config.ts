import Conf from 'conf';

interface Config {
  apiKey?: string;
}

const config = new Conf<Config>({
  projectName: 'runloop-cli',
});

export function getConfig(): Config {
  return {
    apiKey: config.get('apiKey'),
  };
}

export function setApiKey(apiKey: string): void {
  config.set('apiKey', apiKey);
}

export function clearConfig(): void {
  config.clear();
}
