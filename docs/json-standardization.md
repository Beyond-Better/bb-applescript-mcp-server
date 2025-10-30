# JSON Standardization for AppleScript Plugins

## Overview

This document describes the standardized approach for JSON parsing and encoding across all AppleScript plugins in the bb-mcp-applescript server.

## Implementation Date

2025-10-30

## Changes Made

### 1. Core Utilities

#### `server/src/utils/scriptLoader.ts`
- Added `prependJsonUtilities()` function that injects JSON parsing/encoding functions into every AppleScript
- JSON utilities are automatically prepended at runtime for both local and JSR modes
- Provides consistent JSON handling across all scripts without code duplication

#### `server/src/utils/templateRenderer.ts`
- Updated `script()` tagged template function to JSON.stringify ALL interpolated values
- Updated `renderTemplate()` function to JSON.stringify ALL template variables
- All values (including strings, numbers, arrays, objects) are now JSON strings that must be parsed in AppleScript

### 2. AppleScript Scripts Updated

**All scripts now use**:
- `parseValue(jsonString)` for input parsing
- `buildJSONObject(pairs)` for output encoding
- `buildJSONArray(items)` for array output encoding
- `jsonValue(val)` for individual value conversion

**Scripts modified** (11 total):

**standard.plugin**:
1. `scripts/check_permissions.applescript` - Argument parsing
2. `scripts/finder/set_file_label.applescript` - Argument parsing, output encoding
3. `scripts/finder/get_file_label.applescript` - Argument parsing, output encoding  
4. `scripts/finder/reveal_in_finder.applescript` - Argument parsing, output encoding
5. `scripts/finder/get_selection.applescript` - Output encoding
6. `scripts/finder/get_file_info_extended.applescript` - Argument parsing, output encoding

**bbedit.plugin**:
7. `scripts/create_notebook.applescript` - Template variable parsing, output encoding
8. `scripts/create_project.applescript` - Template variable parsing, output encoding

**mail.plugin**:
9. `scripts/read_mail.applescript` - Template variable parsing, removed custom JSON helpers, output encoding
10. `scripts/get_mailboxes.applescript` - Template variable parsing, removed custom JSON helpers, output encoding
11. `scripts/mark_mail.applescript` - Template variable parsing, removed custom JSON helpers, output encoding

### 3. Benefits

1. **Consistency**: All scripts use the same JSON approach
2. **Reliability**: Uses JavaScript's robust JSON.parse() for input
3. **Simplicity**: No custom string manipulation or array parsing
4. **Maintainability**: JSON utilities defined once, injected automatically
5. **Type Safety**: Proper handling of all JavaScript types (strings, numbers, booleans, arrays, objects, null)

## Usage Patterns

### For Plugin Developers

#### Template-Based Scripts (e.g., BBEdit, Mail plugins)

**In TypeScript tool**:
```typescript
// ⚠️ CRITICAL: Pass raw values - templateRenderer JSON.stringifies them automatically
// ❌ DO NOT: JSON.stringify() the values yourself - causes double-stringification!
const result = await findAndExecuteScript(
  pluginDir,
  'my_script',
  {
    name: "My Notebook",           // String - will become JSON "My Notebook"
    items: ["file1", "file2"],    // Array - will become JSON ["file1","file2"]
    settings: { theme: "dark" },   // Object - will become JSON {"theme":"dark"}
    enabled: true,                 // Boolean - will become JSON true
    count: 42,                     // Number - will become JSON 42
    optional: null                 // null - will become JSON null
  },
  undefined,  // No command-line args
  timeout,
  logger
);
```

**In AppleScript script**:
```applescript
-- ⚠️ CRITICAL: Parse ALL values OUTSIDE tell blocks
-- Parse JSON inputs FIRST
set notebookName to parseValue(${name})
set itemsList to parseValue(${items})
set settings to parseValue(${settings})
set enabled to parseValue(${enabled})
set itemCount to parseValue(${count})

-- THEN use the values in tell blocks
tell application "BBEdit"
  set newNotebook to make new notebook with properties {name:notebookName}
  -- Use other parsed values here
end tell

-- Return using buildJSONObject
return buildJSONObject({{"success", true}, {"name", notebookName}})
```

**⚠️ CRITICAL**: The `parseValue()` function (and `parseJSON()`) and `buildJSONObject()` MUST be called **OUTSIDE** of `tell application` blocks. When inside a `tell` block, AppleScript tries to send commands to that application, and your custom functions won't be accessible.

### Common Pitfall: AppleScript Record Syntax

**❌ WRONG - Using AppleScript record syntax with colons:**
```applescript
-- This creates an AppleScript record, NOT compatible with buildJSONObject!
set info to {name:"Alice", age:30, active:true}
return buildJSONObject(info)  -- ERROR: "Can't make some data into the expected type" (-1700)
```

**✅ CORRECT - Using list of pairs:**
```applescript
-- This creates a list of pairs, compatible with buildJSONObject
set info to {{"name", "Alice"}, {"age", 30}, {"active", true}}
return buildJSONObject(info)  -- Works correctly!
```

**Why This Matters:**
- AppleScript records use colon syntax: `{key:value}`
- `buildJSONObject` expects list of pairs: `{{key, value}}`
- Using record syntax causes error -1700: "Can't make some data into the expected type"
- This is the **most common error** when creating new AppleScript tools

**When Building Nested Structures:**
```applescript
-- Build nested flags object
set msgFlags to {{"read", true}, {"flagged", false}, {"deleted", false}}

-- Use the nested structure in parent
set info to {{"id", "12345"}, {"sender", "alice@example.com"}, {"flags", msgFlags}}

-- Return outer structure only
return buildJSONObject(info)
```

#### Argument-Based Scripts (e.g., Finder tools)

**In TypeScript tool**:
```typescript
// Must JSON.stringify arguments (command-line args are always strings)
const scriptArgs = [
  JSON.stringify(args.paths),     // Array
  JSON.stringify(args.labelIndex) // Number
];

const result = await findAndExecuteScript(
  pluginDir,
  'my_script',
  undefined,
  scriptArgs,  // Args parameter, not variables
  timeout,
  logger
);
```

**In AppleScript script**:
```applescript
on run argv
  -- ⚠️ Parse command-line arguments OUTSIDE tell blocks
  set filePaths to parseValue(item 1 of argv)
  set labelIndex to parseValue(item 2 of argv)
  
  -- Initialize results
  set results to {}
  
  -- THEN process in tell block
  tell application "Finder"
    repeat with filePath in filePaths
      set fileItem to POSIX file filePath as alias
      set label index of fileItem to labelIndex
      -- ... process ...
    end repeat
  end tell
  
  -- Return using buildJSONArray or buildJSONObject
  return buildJSONArray(results)
end run
```

**⚠️ CRITICAL RULE**: Always parse arguments at the **TOP** of your script, before any `tell application` blocks.

### JSON Utility Functions (Auto-Injected)

These functions are automatically prepended to every AppleScript by scriptLoader:

```applescript
-- Parse JSON string to AppleScript data structures
parseValue(jsonString)
  -- Returns: AppleScript list, record, string, number, boolean, or missing value

-- Build JSON object from key-value pairs
buildJSONObject(pairs)
  -- pairs: List of {key, value} pairs
  -- Example: {{"name", "Alice"}, {"age", 30}, {"active", true}}
  -- Returns: JSON string

-- Build JSON array from list items
buildJSONArray(listItems)
  -- listItems: List of AppleScript values
  -- Example: {"item1", "item2", "item3"}
  -- Returns: JSON string

-- Convert AppleScript value to JSON value string
jsonValue(val)
  -- Handles: strings, numbers, booleans, lists, missing value
  -- Returns: JSON-encoded string representation
```

## Migration Guide

### Converting Old Scripts

**Before**:
```applescript
-- Manual JSON string construction
set resultJson to "{\"name\":\"" & userName & "\",\"age\":" & userAge & "}"
return resultJson

-- Custom array parsing
set AppleScript's text item delimiters to ","
set items to text items of jsonStr
-- ... manual cleanup ...
```

**After**:
```applescript
-- Use buildJSONObject for output
return buildJSONObject({{"name", userName}, {"age", userAge}})

-- Use parseValue for input
set items to parseValue(jsonStr)
```

### Best Practices

### Script Structure Pattern

Follow this structure for all AppleScript scripts:

```applescript
-- 1. PARSE ALL INPUTS FIRST (outside any tell blocks)
set param1 to parseValue(${variable1})
set param2 to parseValue(${variable2})
set param3 to parseValue(${variable3})

-- 2. INITIALIZE VARIABLES
set results to {}
set errorCount to 0

-- 3. PROCESS IN TELL BLOCKS
tell application "SomeApp"
  -- Use param1, param2, param3 here
  repeat with item in param1
    -- Do work
  end repeat
end tell

-- 4. RETURN USING buildJSONObject/buildJSONArray
return buildJSONObject({{"success", true}, {"results", results}})
```

### Why This Order Matters

1. **Parse first**: `parseValue()` and other custom functions are only accessible at global scope
2. **Tell blocks change context**: Inside `tell application`, commands go to that application
3. **Return last**: `buildJSONObject()` works at any scope since it's also globally defined

### Common Pattern: Argument-Based Scripts

```applescript
on run argv
  -- Parse command-line arguments FIRST
  set paths to parseValue(item 1 of argv)
  set option to parseValue(item 2 of argv)
  
  -- Initialize
  set results to {}
  
  -- Process
  tell application "Finder"
    repeat with p in paths
      -- Use p and option
    end repeat
  end tell
  
  -- Return
  return buildJSONArray(results)
end run
```

## Testing

After updating scripts:

1. Test with various input types:
   - Strings with special characters (quotes, backslashes, newlines)
   - Arrays (empty, single item, multiple items)
   - Objects with nested structures
   - Edge cases (null, empty strings, zero, false)

2. Verify output is valid JSON:
   ```bash
   osascript your_script.applescript | jq .
   ```

3. Test in actual plugin context through MCP client

## Backwards Compatibility

### Breaking Changes

**Template-based scripts**:
- Scripts now MUST use `parseValue()` on all template variables
- Old scripts expecting native AppleScript syntax will break

**Argument-based scripts**:
- Scripts now MUST use `parseValue()` on argv items
- Tools MUST continue to JSON.stringify arguments

### Migration Path

All existing scripts have been updated. No user action required.

## Performance Notes

- `parseValue()` uses JavaScript runtime (~50ms overhead per call)
- `buildJSONObject()` is native AppleScript (<5ms)
- Runtime injection adds ~500 bytes to each script
- Tradeoff: Slight performance cost for significantly improved reliability

## Common Mistakes to Avoid

### ❌ Calling parseValue() Inside tell Blocks

**WRONG** - Don't parse inside tell blocks:
```applescript
tell application "Mail"
  set recipient to parseValue(${to})  -- ❌ WRONG! Function not accessible here
  -- ...
end tell
```

**CORRECT** - Parse BEFORE tell blocks:
```applescript
-- Parse at the top of the script
set recipient to parseValue(${to})  -- ✅ Correct
set subject to parseValue(${subject})  -- ✅ Correct

-- THEN use in tell block
tell application "Mail"
  -- Use recipient and subject here
end tell
```

**Why**: When inside a `tell application` block, AppleScript sends all commands to that application. Your custom `parseValue()` function is defined globally and isn't accessible from within the application's context.

### ❌ Double-Stringification

**WRONG** - Don't JSON.stringify when passing to findAndExecuteScript:
```typescript
const variables = {
  items: JSON.stringify(args.items),  // ❌ WRONG!
  name: JSON.stringify(args.name)      // ❌ WRONG!
};
await findAndExecuteScript(pluginDir, 'script', variables, ...);
```

**CORRECT** - Pass raw values:
```typescript
const variables = {
  items: args.items,  // ✅ Correct - templateRenderer handles it
  name: args.name     // ✅ Correct
};
await findAndExecuteScript(pluginDir, 'script', variables, ...);
```

### ✅ When to JSON.stringify

You SHOULD JSON.stringify when:
1. Passing command-line arguments (args, not variables)
2. Using runAppleScript with inline scripts (no template renderer)

```typescript
// Command-line args - YES, stringify
const scriptArgs = [
  JSON.stringify(args.paths),  // ✅ Correct for args
  JSON.stringify(args.value)   // ✅ Correct for args
];
await findAndExecuteScript(pluginDir, 'script', undefined, scriptArgs, ...);

// Inline script - YES, stringify
const script = `set myData to parseValue("${JSON.stringify(data).replace(/"/g, '\\"')}")`;
await runAppleScript({ script, inline: true });
```

## Future Enhancements

1. Consider caching parsed JSON within scripts if values used multiple times
2. Add error handling utilities for better JSON parse error messages
3. Explore compiled script format to pre-bundle JSON utilities

## References

- Original JSON.applescript: `server/src/utils/JSON.applescript`
- Template renderer: `server/src/utils/templateRenderer.ts`
- Script loader: `server/src/utils/scriptLoader.ts`
- Plugin creation guide: `docs/creating-plugins.md`
