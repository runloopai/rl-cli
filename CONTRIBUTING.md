# Contributing to Runloop CLI

Thank you for your interest in contributing to the Runloop CLI! This document provides guidelines and instructions for contributing.

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- pnpm

### Development Setup

1. Fork and clone the repository:

```bash
git clone https://github.com/runloopai/rl-cli.git
cd rl-cli
```

2. Install dependencies:

```bash
pnpm install
```

3. Build the project:

```bash
pnpm run build
```

4. Link for local development:

```bash
pnpm link --global
```

Now you can use `rli` commands locally with your changes.

### Development Workflow

```bash
# Watch mode - rebuilds on file changes
pnpm run dev

# Run the CLI
pnpm start -- <command>

# Or after linking
rli <command>
```

## Code Style

This project uses Prettier and ESLint to maintain code quality.

### Formatting

```bash
# Check formatting
pnpm run format:check

# Auto-fix formatting
pnpm run format
```

### Linting

```bash
# Run linter
pnpm run lint

# Auto-fix lint issues
pnpm run lint:fix
```

## Testing

```bash
# Run all tests
pnpm test

# Run component tests with coverage
pnpm run test:components

# Watch mode
pnpm run test:watch
```

Please ensure all tests pass before submitting a pull request.

## Commit Messages

This project uses [Conventional Commits](https://www.conventionalcommits.org/) for commit messages. This enables automatic changelog generation and semantic versioning.

### Format

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code changes that neither fix bugs nor add features
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### Examples

```
feat(devbox): add support for custom environment variables
fix(snapshot): resolve pagination issue in list command
docs: update installation instructions
```

## Pull Request Process

1. Create a new branch from `main`:

```bash
git checkout -b feat/my-feature
```

2. Make your changes and commit using conventional commits.

3. Push to your fork and open a pull request.

4. Ensure CI checks pass:
   - Formatting (Prettier)
   - Linting (ESLint)
   - Build (TypeScript)
   - Tests

5. Request review from maintainers.

### PR Title

PR titles should follow the conventional commit format as they are used for release notes.

## Project Structure

```
src/
├── cli.ts              # Main CLI entry point
├── commands/           # Command implementations
│   ├── devbox/        # Devbox commands
│   ├── snapshot/      # Snapshot commands
│   ├── blueprint/     # Blueprint commands
│   └── object/        # Object storage commands
├── components/        # React/Ink UI components
├── hooks/             # Custom React hooks
├── mcp/               # MCP server implementation
├── router/            # Navigation router
├── screens/           # Full-screen views
├── services/          # API service wrappers
├── store/             # Zustand state management
└── utils/             # Utility functions
```

## Questions?

If you have questions, feel free to:

- Open an issue for discussion
- Check existing issues and pull requests

Thank you for contributing!
