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
- ✅ `rli devbox list [-s <status>] -o json`
- ✅ `rli blueprint list -o json`
- ✅ `rli snapshot list [-d <devbox-id>] -o json`

### Create Commands (with `-o json`)
- ✅ `rli devbox create [-n <name>] [-t <template>] -o json`
- ✅ `rli snapshot create <devbox-id> [-n <name>] -o json`

### Delete Commands (with `-o json`)
- ✅ `rli devbox delete <id> -o json`
- ✅ `rli snapshot delete <id> -o json`

### Other Commands (NOT YET IMPLEMENTED)
- ⏸️ `rli devbox exec <id> <command...> -o json`
- ⏸️ `rli devbox upload <id> <file> -o json`

## Usage Examples

### Interactive Mode (Default)
```bash
# Shows full UI with table, navigation, operations
rli devbox list
rli blueprint list
```

### JSON Output for Scripting
```bash
# Get all devboxes as JSON
rli devbox list -o json

# Filter and format with jq
rli devbox list -s running -o json | jq '.[] | {id, name, status}'

# Create devbox and capture ID
DEVBOX_ID=$(rli devbox create -n my-box -o json | jq -r '.id')

# List snapshots for specific devbox
rli snapshot list -d <devbox-id> -o json

# Delete and get confirmation
rli devbox delete <id> -o json
```

### YAML Output for Readability
```bash
# Get all devboxes as YAML
rli devbox list -o yaml

# Create devbox with YAML output
rli devbox create -n my-box -o yaml

# List blueprints as YAML
rli blueprint list -o yaml

# Output to file for configuration
rli devbox list -o yaml > devboxes.yaml
```

### Integration with CI/CD
```bash
#!/bin/bash
# Create devbox, wait for running status, execute command

# Create
DEVBOX=$(rli devbox create -n ci-box -o json)
DEVBOX_ID=$(echo "$DEVBOX" | jq -r '.id')

# Poll until running
while [ "$(rli devbox list -o json | jq -r ".[] | select(.id==\"$DEVBOX_ID\") | .status")" != "running" ]; do
  sleep 5
done

# Execute commands (needs -o json implementation)
rli devbox exec "$DEVBOX_ID" npm test

# Cleanup
rli devbox delete "$DEVBOX_ID" -o json
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
