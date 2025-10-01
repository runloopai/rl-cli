# Output Format Support - Implementation Summary

All CLI commands now support `-o` or `--output` flags for controlling output format.

## Supported Formats

- **`text`** (default): Interactive UI with tables, colors, and navigation
- **`json`**: Non-interactive JSON output for scripting and automation
- **`yaml`**: Non-interactive YAML output for configuration files and readability

## Reusable Output Utility

Created `/src/utils/output.ts` with the following functions:

- `shouldUseNonInteractiveOutput(options)` - Check if non-interactive mode
- `outputList(items, options)` - Output array of items
- `outputResult(result, options)` - Output single result
- `outputError(error, options)` - Handle errors consistently
- `validateOutputFormat(format)` - Validate format option

## Commands Updated

### List Commands (with `-o json`)
- ✅ `rln devbox list [-s <status>] -o json`
- ✅ `rln blueprint list -o json`
- ✅ `rln snapshot list [-d <devbox-id>] -o json`

### Create Commands (with `-o json`)
- ✅ `rln devbox create [-n <name>] [-t <template>] -o json`
- ✅ `rln snapshot create <devbox-id> [-n <name>] -o json`

### Delete Commands (with `-o json`)
- ✅ `rln devbox delete <id> -o json`
- ✅ `rln snapshot delete <id> -o json`

### Other Commands (NOT YET IMPLEMENTED)
- ⏸️ `rln devbox exec <id> <command...> -o json`
- ⏸️ `rln devbox upload <id> <file> -o json`

## Usage Examples

### Interactive Mode (Default)
```bash
# Shows full UI with table, navigation, operations
rln devbox list
rln blueprint list
```

### JSON Output for Scripting
```bash
# Get all devboxes as JSON
rln devbox list -o json

# Filter and format with jq
rln devbox list -s running -o json | jq '.[] | {id, name, status}'

# Create devbox and capture ID
DEVBOX_ID=$(rln devbox create -n my-box -o json | jq -r '.id')

# List snapshots for specific devbox
rln snapshot list -d <devbox-id> -o json

# Delete and get confirmation
rln devbox delete <id> -o json
```

### YAML Output for Readability
```bash
# Get all devboxes as YAML
rln devbox list -o yaml

# Create devbox with YAML output
rln devbox create -n my-box -o yaml

# List blueprints as YAML
rln blueprint list -o yaml

# Output to file for configuration
rln devbox list -o yaml > devboxes.yaml
```

### Integration with CI/CD
```bash
#!/bin/bash
# Create devbox, wait for running status, execute command

# Create
DEVBOX=$(rln devbox create -n ci-box -o json)
DEVBOX_ID=$(echo "$DEVBOX" | jq -r '.id')

# Poll until running
while [ "$(rln devbox list -o json | jq -r ".[] | select(.id==\"$DEVBOX_ID\") | .status")" != "running" ]; do
  sleep 5
done

# Execute commands (needs -o json implementation)
rln devbox exec "$DEVBOX_ID" npm test

# Cleanup
rln devbox delete "$DEVBOX_ID" -o json
```

## Implementation Pattern

All commands follow this pattern:

```typescript
export async function commandName(args, options: OutputOptions = {}) {
  // Handle non-interactive output formats
  if (shouldUseNonInteractiveOutput(options)) {
    try {
      const client = getClient();
      const result = await client.someOperation(args);
      outputResult(result, options); // or outputList for arrays
    } catch (err) {
      console.error(JSON.stringify({ error: (err as Error).message }, null, 2));
      process.exit(1);
    }
    return;
  }

  // Interactive mode
  console.clear();
  const { waitUntilExit } = render(<SomeUI {...args} />);
  await waitUntilExit();
}
```

## Benefits

1. **Scriptable**: All commands can be used in scripts and automation
2. **Composable**: JSON output works perfectly with `jq`, `jc`, and other tools
3. **Consistent**: All commands use the same output utility
4. **Backwards Compatible**: Default behavior unchanged (interactive UI)
5. **Extensible**: Easy to add new output formats (yaml, table, etc)

## Future Enhancements

- ✅ ~~Add `-o yaml` support~~ (DONE)
- Add `-o table` for formatted text tables without UI
- Implement for `exec` and `upload` commands
- Add `--quiet` flag for minimal output
- Add `--filter` flag for client-side filtering in JSON mode
- Add `--limit` flag to control number of results returned
