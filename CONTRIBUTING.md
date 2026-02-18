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

**Standard (Node.js + pnpm):**

```bash
# Watch mode - rebuilds on file changes
pnpm run dev

# Run the CLI
pnpm start -- <command>

# Or after linking
rli <command>
```

**Alternative: Using Bun (Faster):**

For faster development iteration, you can use [Bun](https://bun.sh) instead:

```bash
# Install Bun (one-time setup)
curl -fsSL https://bun.sh/install | bash

# Install dependencies
bun install

# Run in watch mode (auto-restarts on changes)
bun run dev:bun

# Or run directly
bun run start:bun -- <command>

# Run tests
bun test
```

**Note:** Both TUI and CLI modes work with Bun thanks to the stdin workaround in `src/commands/menu.tsx`. All features are supported.

### Building Standalone Executables (Experimental)

Bun can compile the CLI into a single executable file, though this is currently experimental:

```bash
# Build for your current platform (creates ./rli)
bun run build:exe

# Build for specific platforms
bun run build:exe:macos       # macOS Apple Silicon (dist/rli-macos-arm64)
bun run build:exe:macos-x64   # macOS Intel (dist/rli-macos-x64)
bun run build:exe:linux       # Linux x64 (dist/rli-linux-x64)
bun run build:exe:linux-arm   # Linux ARM64 (dist/rli-linux-arm64)
bun run build:exe:windows     # Windows x64 (dist/rli-windows-x64.exe)

# Build all platforms at once
bun run build:exe:all
```

**Known Limitations (Bun 1.3.9):**
- Executable builds currently fail due to Ink's yoga-layout dependency
- This is a Bun bundler limitation being tracked upstream
- The runtime version (`bun run src/cli.ts`) works perfectly
- Use runtime version for development and testing

If executables build successfully:
- They are 50-100MB in size (includes Bun runtime)
- Both TUI and CLI modes should work
- They work on machines without Node.js or Bun installed
- They can be distributed as standalone binaries

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
