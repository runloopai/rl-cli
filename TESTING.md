# Testing Guide

This document explains how to run tests for the Runloop CLI Node.js implementation.

## Test Structure

The test suite is organized into two main categories:

- **Unit Tests** (`tests/__tests__/unit/`) - Fast, isolated tests with mocked dependencies
- **Integration Tests** (`tests/__tests__/integration/`) - End-to-end tests with real API calls

## Environment Setup

### 1. Create Environment File

Copy the example environment file and configure it:

```bash
cp env.example .env
```

Edit `.env` with your actual values:

```bash
# API Configuration
RUNLOOP_API_KEY=your-actual-api-key-here
RUNLOOP_ENV=dev

# Test Configuration
RUN_E2E=false
NODE_ENV=test
```

### 2. Install Dependencies

```bash
npm install
```

## Running Tests

### Unit Tests (Fast, No API Calls)

```bash
# Run all unit tests
npm run test:unit

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch
```

### Integration Tests (Requires API Key)

```bash
# Run integration tests (requires RUNLOOP_API_KEY)
npm run test:integration

# Run E2E tests with real API calls
npm run test:e2e
```

### All Tests

```bash
# Run all tests
npm test
```

## Test Categories

### Unit Tests

- **Utils Tests** (`utils.test.ts`) - Test utility functions and configuration
- **Command Tests** - Test individual command implementations with mocked API calls
  - `devbox.test.ts` - Devbox command tests
  - `blueprint.test.ts` - Blueprint command tests  
  - `object.test.ts` - Object storage command tests

### Integration Tests

- **Devbox E2E** (`devbox.e2e.test.ts`) - Full devbox lifecycle testing
- **Blueprint E2E** (`blueprint.e2e.test.ts`) - Blueprint creation and management
- **Object E2E** (`object.e2e.test.ts`) - Object storage operations

## Environment Variables

| Variable | Description | Default | Required for E2E |
|----------|-------------|---------|------------------|
| `RUNLOOP_API_KEY` | Your Runloop API key | `test-api-key` | ✅ Yes |
| `RUNLOOP_ENV` | API environment (dev/prod) | `dev` | No |
| `RUN_E2E` | Enable E2E test mode | `false` | No |
| `NODE_ENV` | Node environment | `test` | No |

## Test Configuration

### Jest Configuration

The project uses Jest with TypeScript support:

- **Preset**: `ts-jest` for TypeScript compilation
- **Environment**: Node.js
- **Coverage**: 80% threshold for all metrics
- **Timeout**: 30 seconds for integration tests

### Coverage Requirements

- **Branches**: 80%
- **Functions**: 80%  
- **Lines**: 80%
- **Statements**: 80%

## Troubleshooting

### Common Issues

1. **Missing API Key**: Integration tests will be skipped if `RUNLOOP_API_KEY` is not set
2. **Network Issues**: E2E tests require internet connectivity
3. **SSH Tools**: Some tests require local SSH/OpenSSL tools
4. **File Permissions**: Ensure write access to temp directories

### Debug Mode

Run tests with verbose output:

```bash
npm test -- --verbose
```

### Skip Integration Tests

To run only unit tests:

```bash
npm run test:unit
```

## Test Development

### Adding New Tests

1. **Unit Tests**: Add to appropriate test file in `tests/__tests__/unit/`
2. **Integration Tests**: Add to appropriate E2E test file in `tests/__tests__/integration/`
3. **Fixtures**: Add mock data to `tests/fixtures/mocks.ts`
4. **Helpers**: Add utilities to `tests/helpers.ts`

### Test Patterns

- Use `describe()` for grouping related tests
- Use `it()` for individual test cases
- Use `beforeEach()` and `afterEach()` for setup/cleanup
- Use `pending()` to skip tests conditionally
- Mock external dependencies with `jest.fn()`

### Mock Data

The test suite includes comprehensive mock data:

- **Devbox Mocks**: `mockDevbox()`, `mockExecution()`, `mockLogEntry()`
- **Blueprint Mocks**: `mockBlueprint()`
- **Object Mocks**: `mockObject()`
- **API Client Mocks**: `mockAPIClient()`

## CI/CD Integration

Tests are designed to work in CI environments:

- Unit tests run without external dependencies
- Integration tests are skipped if API key is not available
- Coverage reports are generated for all test runs
- Tests have appropriate timeouts for CI environments


