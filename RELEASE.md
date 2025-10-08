# Release Process

This document outlines the manual release process for `@runloop/rl-cli`.

## Prerequisites

1. Ensure you have npm access to publish to the `@runloop` organization
2. Ensure your local repository is clean and up to date with `main`
3. Ensure all tests pass and the build succeeds

## Release Steps

### 1. Update Version

Choose the appropriate version bump based on your changes:

```bash
# For bug fixes and minor changes
npm run version:patch

# For new features (backward compatible)
npm run version:minor

# For breaking changes
npm run version:major
```

This will:
- Update the version in `package.json`
- Create a git commit with the version bump
- Create a git tag for the new version

### 2. Push Changes

Push the version commit and tag to GitHub:

```bash
git push origin improvements --follow-tags
```

### 3. Build and Publish

Build and publish the package to npm:

```bash
npm run release
```

This will:
- Run the TypeScript compiler to build the project
- Publish the package to npm

### 4. Verify Publication

Verify the package was published successfully:

```bash
npm view @runloop/rl-cli version
```

### 5. Create GitHub Release (Optional)

Create a GitHub release for the new version:

1. Go to https://github.com/runloop/rl-cli-node/releases
2. Click "Draft a new release"
3. Select the tag you just pushed
4. Add release notes describing the changes
5. Publish the release

## Version Commands Reference

- `npm run version:patch` - Bump patch version (e.g., 0.0.2 → 0.0.3)
- `npm run version:minor` - Bump minor version (e.g., 0.0.2 → 0.1.0)
- `npm run version:major` - Bump major version (e.g., 0.0.2 → 1.0.0)
- `npm run release` - Build and publish to npm

## Troubleshooting

### Authentication Issues

If you get authentication errors when publishing:

```bash
npm login
```

Follow the prompts to log in to your npm account.

### Build Errors

If the build fails, fix the errors and run:

```bash
npm run build
```

### Reverting a Release

If you need to revert a release:

```bash
# Deprecate the version on npm (doesn't unpublish)
npm deprecate @runloop/rl-cli@<version> "Reason for deprecation"

# Revert the git commit and tag locally
git reset --hard HEAD~1
git tag -d v<version>
git push origin :refs/tags/v<version>
```

Note: You cannot unpublish a package version after 72 hours. Use deprecation instead.

## Notes

- The `prepublishOnly` script automatically runs `npm run build` before publishing
- The version is automatically read from `package.json` and displayed in the CLI
- Make sure to update the changelog or release notes with each version
