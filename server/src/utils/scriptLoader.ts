/**
 * Script loader for managing AppleScript files
 * Supports both compiled scripts and template-based scripts
 *
 * Hybrid loading strategy:
 * 1. Try to load from inlined scripts (scripts/index.ts) for JSR compatibility
 * 2. Fall back to file-based loading for local development
 */

import { join } from '@std/path';
import { decodeBase64 } from '@std/encoding/base64';
import type { Logger } from '@beyondbetter/bb-mcp-server';
import { toError } from '@beyondbetter/bb-mcp-server';
import { renderTemplate } from './templateRenderer.ts';
import { compileAndRun, runAppleScript } from './scriptRunner.ts';
import type { AppleScriptResult } from './errorHandler.ts';

export interface InlinedScript {
  type: 'text' | 'binary';
  content: string;
}

export type InlinedScriptsMap = Record<string, InlinedScript>;

export interface LoadedScript {
  /** Path to the script file */
  path: string;
  /** Whether the script is compiled (.scpt) */
  compiled: boolean;
  /** Whether the script uses templates */
  hasTemplates: boolean;
  /** Script content (only for non-compiled scripts) */
  content?: string;
}

/**
 * Loads a script file and determines its type
 */
export async function loadScript(scriptPath: string, logger?: Logger): Promise<LoadedScript> {
  try {
    const stat = await Deno.stat(scriptPath);

    if (!stat.isFile) {
      throw new Error(`Script path is not a file: ${scriptPath}`);
    }

    const isCompiled = scriptPath.endsWith('.scpt');

    if (isCompiled) {
      // Compiled script - no need to read content
      logger?.debug(`Loaded compiled script: ${scriptPath}`);
      return {
        path: scriptPath,
        compiled: true,
        hasTemplates: false,
      };
    } else {
      // Source script - read and check for templates
      const content = await Deno.readTextFile(scriptPath);
      const hasTemplates = /\$\{[^}]+\}/.test(content);

      logger?.debug(`Loaded source script: ${scriptPath}`, {
        hasTemplates,
        lines: content.split('\n').length,
      });

      return {
        path: scriptPath,
        compiled: false,
        hasTemplates,
        content,
      };
    }
  } catch (error) {
    logger?.error(`Failed to load script: ${scriptPath}`, toError(error), { error });
    throw new Error(
      `Failed to load script ${scriptPath}: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

/**
 * Finds a script file in a plugin's scripts directory
 * Supports both .scpt and .applescript extensions
 */
export async function findScriptInPlugin(
  pluginDir: string,
  scriptName: string,
  logger?: Logger,
): Promise<string | null> {
  const scriptsDir = join(pluginDir, 'scripts');

  // Try different extensions and subdirectories
  const candidates = [
    join(scriptsDir, `${scriptName}.scpt`),
    join(scriptsDir, `${scriptName}.applescript`),
    join(scriptsDir, scriptName, `${scriptName}.scpt`),
    join(scriptsDir, scriptName, `${scriptName}.applescript`),
  ];

  for (const candidate of candidates) {
    try {
      const stat = await Deno.stat(candidate);
      if (stat.isFile) {
        logger?.debug(`Found script: ${candidate}`);
        return candidate;
      }
    } catch {
      // File doesn't exist, continue
    }
  }

  logger?.warn(`Script not found: ${scriptName} in ${scriptsDir}`);
  return null;
}

/**
 * Executes a loaded script with optional template variables
 */
export async function executeScript(
  script: LoadedScript,
  variables?: Record<string, any>,
  args?: string[],
  timeout?: number,
  logger?: Logger,
): Promise<AppleScriptResult> {
  if (script.compiled) {
    // Run compiled script directly with args
    const options: any = { script: script.path };
    if (args !== undefined) options.args = args;
    if (timeout !== undefined) options.timeout = timeout;
    if (logger !== undefined) options.logger = logger;
    return runAppleScript(options);
  } else if (script.hasTemplates && script.content) {
    // Render template and compile/run
    if (!variables) {
      throw new Error('Template variables required for template-based script');
    }

    // Prepend JSON utilities before rendering
    const contentWithJson = appendJsonUtilities(script.content);
    const rendered = renderTemplate(contentWithJson, variables);
    logger?.debug('Rendered template script', {
      variables: Object.keys(variables),
      lines: rendered.split('\n').length,
    });

    return compileAndRun(rendered, timeout, logger);
  } else if (script.content) {
    // Non-template source script - compile with JSON utilities and run
    const contentWithJson = appendJsonUtilities(script.content);
    logger?.debug('Compiling script with JSON utilities', {
      lines: contentWithJson.split('\n').length,
    });
    return compileAndRun(contentWithJson, timeout, logger);
  } else {
    // Fallback: run source script directly from file (shouldn't normally reach here)
    const options: any = { script: script.path };
    if (args !== undefined) options.args = args;
    if (timeout !== undefined) options.timeout = timeout;
    if (logger !== undefined) options.logger = logger;
    return runAppleScript(options);
  }
}

/**
 * Helper to load and execute a script in one call
 */
export async function loadAndExecuteScript(
  scriptPath: string,
  variables?: Record<string, any>,
  args?: string[],
  timeout?: number,
  logger?: Logger,
): Promise<AppleScriptResult> {
  const script = await loadScript(scriptPath, logger);
  return executeScript(script, variables, args, timeout, logger);
}

/**
 * Try to load inlined scripts from a plugin's scripts/index.ts
 * Returns null if not available (no index.ts or not running from JSR)
 */
async function tryLoadInlinedScripts(pluginDir: string, logger?: Logger): Promise<InlinedScriptsMap | null> {
  try {
    // Attempt to dynamically import the inlined scripts module
    // This will only succeed if scripts/index.ts exists (generated by build:jsr)
    const indexPath = `${pluginDir}/scripts/index.ts`;
    const scriptsModule = await import(indexPath);
    logger?.debug('Loaded inlined scripts', {
      pluginDir,
      count: Object.keys(scriptsModule.INLINED_SCRIPTS || {}).length,
    });
    return scriptsModule.INLINED_SCRIPTS;
  } catch {
    // Index doesn't exist or import failed - fall back to file-based loading
    logger?.debug('Inlined scripts not available, using file-based loading', { pluginDir });
    return null;
  }
}

/**
 * Execute a script from inlined scripts map
 */
async function executeFromInlinedScripts(
  scriptName: string,
  inlinedScripts: InlinedScriptsMap,
  variables?: Record<string, any>,
  args?: string[],
  timeout?: number,
  logger?: Logger,
): Promise<AppleScriptResult> {
  // Try to find script with exact name first
  let script = inlinedScripts[scriptName];
  let fullScriptName = scriptName;

  // If not found and no extension, try adding extensions
  if (!script && !scriptName.includes('.')) {
    const candidates = [
      `${scriptName}.applescript`,
      `${scriptName}.scpt`,
    ];

    for (const candidate of candidates) {
      if (inlinedScripts[candidate]) {
        script = inlinedScripts[candidate];
        fullScriptName = candidate;
        break;
      }
    }
  }

  // Try looking in subdirectories (e.g., 'finder/reveal_in_finder.applescript')
  if (!script) {
    for (const [key, value] of Object.entries(inlinedScripts)) {
      if (
        key.endsWith(`/${scriptName}`) ||
        key.endsWith(`/${scriptName}.applescript`) ||
        key.endsWith(`/${scriptName}.scpt`)
      ) {
        script = value;
        fullScriptName = key;
        break;
      }
    }
  }

  if (!script) {
    throw new Error(`Inlined script not found: ${scriptName}`);
  }

  logger?.debug(`Executing inlined script: ${fullScriptName}`, {
    type: script.type,
    hasVariables: !!variables,
    hasArgs: !!args,
  });

  if (script.type === 'binary') {
    // Compiled .scpt file - decode base64 and write to temp file
    return executeCompiledInlinedScript(script.content, args, timeout, logger);
  } else {
    // Text .applescript file - check for templates and execute
    return executeTextInlinedScript(script.content, variables, args, timeout, logger);
  }
}

/**
 * Execute a compiled script from base64-encoded binary data
 */
async function executeCompiledInlinedScript(
  base64Content: string,
  args?: string[],
  timeout?: number,
  logger?: Logger,
): Promise<AppleScriptResult> {
  // Decode base64 to binary
  const binaryContent = decodeBase64(base64Content);

  // Create a temporary file for the compiled script
  const tempFile = await Deno.makeTempFile({ suffix: '.scpt' });

  try {
    // Write binary content to temp file
    await Deno.writeFile(tempFile, binaryContent);

    // Execute the compiled script
    const options: any = { script: tempFile };
    if (args !== undefined) options.args = args;
    if (timeout !== undefined) options.timeout = timeout;
    if (logger !== undefined) options.logger = logger;

    return await runAppleScript(options);
  } finally {
    // Clean up temp file
    try {
      await Deno.remove(tempFile);
    } catch (error) {
      logger?.warn('Failed to remove temporary script file', { tempFile, error });
    }
  }
}

/**
 * Prepend JSON utility functions to a script
 */
function appendJsonUtilities(content: string): string {
  const jsonUtilities = `
-- JSON Utilities (auto-injected)
(*
================================================================================
JSON Parser for AppleScript
================================================================================

Description:
    Reliable JSON parsing and construction for AppleScript using JavaScript
    runtime for parsing and manual construction for stringification. Avoids
    AppleScript record iteration limitations with explicit key-value pairs.

Functions:
    • parseValue(jsonString) - Parse JSON string to AppleScript data structures
    • buildJSONObject(pairs) - Build JSON object from list of {key, value} pairs
    • buildJSONArray(items) - Build JSON array from list of items
    • jsonValue(val) - Convert AppleScript value to JSON string representation

Requirements:
    • macOS 10.10+ (for JavaScript runtime support)
    • osascript compatible

Usage Examples:
    -- Parse JSON
    set data to parseValue("[\\"a\\",\\"b\\",\\"c\\"]")
    
    -- Build JSON object
    set json to buildJSONObject({{"name", "Alice"}, {"age", 30}, {"active", true}})
    
    -- Build JSON array
    set json to buildJSONArray({"item1", "item2", "item3"})
    
    -- Nested structures
    set json to buildJSONObject({{"items", {"a", "b"}}, {"count", 2}})

Implementation Notes:
    - parseValue uses JavaScript runtime (~50ms overhead, handles all edge cases)
    - JSON construction is manual to avoid AppleScript record iteration issues
    - Properly escapes special characters (backslashes (\\), quotes (""), newlines, tabs)
    - Handles nested arrays and null values
    - Type-safe conversions for strings, numbers, booleans, lists

Author: Beyond Better (CNG)
Created: 2024
Version: 1.0

Performance:
    - Parse: ~50-100ms per call (JavaScript overhead)
    - Build: <5ms for typical structures (native AppleScript)

================================================================================

Examples:

set jsonStr to buildJSONObject({{"itemCount", 3}, {"enabled", true}, {"items", {"a", "b"}}})
-- Result: {"itemCount":3,"enabled":true,"items":["a","b"]}

-- Build JSON array
set jsonArr to buildJSONArray({"id1", "id2", "id3"})
-- Result: ["id1","id2","id3"]

-- Parse JSON
set jsonData to parseValue("[\\"x\\",\\"y\\",\\"z\\"]")
-- Result: {"x", "y", "z"}

-- Nested structures
set complex to buildJSONObject({{"user", "alice"}, {"roles", {"admin", "user"}}, {"active", true}})
-- Result: {"user":"alice","roles":["admin","user"],"active":true}


*)

use scripting additions

-- Parse JSON string to AppleScript data structures
on parseJSON(jsonString)
	try
		return run script "JSON.parse(" & quoted form of jsonString & ");" in "JavaScript"
	on error errorMessage
		error "JSON parse failed: " & errorMessage
	end try
end parseJSON
-- Generic parse function (recommended for template variables)
-- Handles null, scalars, arrays, and objects gracefully
on parseValue(value)
	-- Handle missing/empty
	if value is missing value or value is "" then
		return missing value
	end if
	
	-- Special case: the literal string "null" should become missing value
	if value is "null" then
		return missing value
	end if
	
	-- Special case: the literal strings "true" and "false"
	if value is "true" then
		return true
	end if
	if value is "false" then
		return false
	end if
	
	-- Try JSON parse first
	try
		set result to parseJSON(value)
		-- JavaScript null becomes missing value in AppleScript automatically
		return result
	on error parseError
		-- JSON parse failed or returned unexpected result
		-- Try to handle as a simple type
		
		-- Check if it's a JSON string (starts and ends with quotes)
		if value starts with "\\"" and value ends with "\\"" and (length of value) ≥ 2 then
			-- Strip the outer quotes and unescape
			if (length of value) is 2 then
				-- Empty string case: ""
				return ""
			else
				set unquoted to text 2 thru -2 of value
				-- Unescape common JSON escapes
				set unquoted to replaceText(unquoted, "\\\\\\\\", "\\\\")
				set unquoted to replaceText(unquoted, "\\\\\\"", "\\"")
				set unquoted to replaceText(unquoted, "\\\\n", return)
				set unquoted to replaceText(unquoted, "\\\\t", tab)
				return unquoted
			end if
		end if
		
		-- Check if it's a number
		try
			set numValue to value as number
			return numValue
		on error
			-- Not a number, continue
		end try
		
		-- If all else fails, return as-is
		return value
	end try
end parseValue

-- Build JSON object from key-value pairs
on buildJSONObject(pairs)
	set jsonParts to {}
	repeat with pair in pairs
		set {keyName, val} to pair
		set end of jsonParts to "\\"" & keyName & "\\":" & jsonValue(val)
	end repeat
	return "{" & joinList(jsonParts, ",") & "}"
end buildJSONObject

-- Build JSON array
on buildJSONArray(listItems)
	set jsonItems to {}
	repeat with listItem in listItems
		set end of jsonItems to jsonValue(listItem)
	end repeat
	return "[" & joinList(jsonItems, ",") & "]"
end buildJSONArray

-- Convert AppleScript value to JSON value string
on jsonValue(val)
	if val is missing value then
		return "null"
	else if class of val is boolean then
		if val then
			return "true"
		else
			return "false"
		end if
	else if class of val is number then
		return val as string
	else if class of val is string then
		-- Escape special characters
		set escaped to val
		set escaped to replaceText(escaped, "\\\\", "\\\\\\\\")
		set escaped to replaceText(escaped, "\\"", "\\\\\\"")
		set escaped to replaceText(escaped, return, "\\\\n")
		set escaped to replaceText(escaped, tab, "\\\\t")
		return "\\"" & escaped & "\\""
	else if class of val is list then
		return buildJSONArray(val)
	else
		-- Fallback for unknown types
		return "\\"" & (val as string) & "\\""
	end if
end jsonValue

-- Helper: Join list with delimiter
on joinList(theList, delimiter)
	set oldDelimiters to AppleScript's text item delimiters
	set AppleScript's text item delimiters to delimiter
	set resultText to theList as string
	set AppleScript's text item delimiters to oldDelimiters
	return resultText
end joinList

-- Helper: Replace text
on replaceText(sourceText, findText, replaceWith)
	set oldDelimiters to AppleScript's text item delimiters
	set AppleScript's text item delimiters to findText
	set textItems to text items of sourceText
	set AppleScript's text item delimiters to replaceWith
	set resultText to textItems as string
	set AppleScript's text item delimiters to oldDelimiters
	return resultText
end replaceText
-- End JSON Utilities

`;
  return content + jsonUtilities;
}

/**
 * Execute a text AppleScript with optional template rendering
 */
async function executeTextInlinedScript(
  content: string,
  variables?: Record<string, any>,
  args?: string[],
  timeout?: number,
  logger?: Logger,
): Promise<AppleScriptResult> {
  const hasTemplates = /\$\{[^}]+\}/.test(content);

  // Always prepend JSON utilities at runtime
  const contentWithJson = appendJsonUtilities(content);

  if (hasTemplates && variables) {
    // Render template and compile/run
    const rendered = renderTemplate(contentWithJson, variables);
    logger?.debug('Rendered inlined template script', {
      variables: Object.keys(variables),
      lines: rendered.split('\n').length,
    });

    return compileAndRun(rendered, timeout, logger);
  } else if (hasTemplates && !variables) {
    throw new Error('Template variables required for template-based script');
  } else {
    // No templates - compile and run directly
    return compileAndRun(contentWithJson, timeout, logger);
  }
}

/**
 * Helper to find and execute a script from a plugin
 *
 * Hybrid loading strategy:
 * 1. Try to load from inlined scripts (scripts/index.ts) - for JSR compatibility
 * 2. Fall back to file-based loading - for local development
 */
export async function findAndExecuteScript(
  pluginDir: string,
  scriptName: string,
  variables?: Record<string, any>,
  args?: string[],
  timeout?: number,
  logger?: Logger,
): Promise<AppleScriptResult> {
  // Try inlined scripts first (JSR mode)
  const inlinedScripts = await tryLoadInlinedScripts(pluginDir, logger);

  if (inlinedScripts) {
    logger?.debug('Using inlined scripts for execution');
    return executeFromInlinedScripts(scriptName, inlinedScripts, variables, args, timeout, logger);
  }

  // Fall back to file-based loading (local dev mode)
  logger?.debug('Using file-based scripts for execution');
  const scriptPath = await findScriptInPlugin(pluginDir, scriptName, logger);

  if (!scriptPath) {
    throw new Error(`Script not found: ${scriptName} in plugin ${pluginDir}`);
  }

  return loadAndExecuteScript(scriptPath, variables, args, timeout, logger);
}
