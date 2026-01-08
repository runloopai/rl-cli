/**
 * Mock for signal-exit module to avoid ESM teardown issues in Jest
 */

const noop = () => () => {};

export default noop;
export const onExit = noop;


