/**
 * Template renderer for AppleScript with proper escaping
 * Provides a tagged template literal function for safe string interpolation
 */

/**
 * Escapes a string value for use in AppleScript
 * Handles quotes, backslashes, and special characters
 */
export function escapeAppleScriptString(value: string): string {
  // Escape backslashes first (must be done before quotes)
  let escaped = value.replace(/\\/g, '\\\\');
  // Escape double quotes
  escaped = escaped.replace(/"/g, '\\"');
  // Wrap in quotes
  return `"${escaped}"`;
}

/**
 * Converts a JavaScript array to an AppleScript list
 * Example: ["a", "b", "c"] => {"a", "b", "c"}
 */
export function toAppleScriptList(arr: any[]): string {
  const escaped = arr.map((item) => {
    if (typeof item === 'string') {
      return escapeAppleScriptString(item);
    } else if (typeof item === 'number' || typeof item === 'boolean') {
      return String(item);
    } else if (item === null || item === undefined) {
      return 'missing value';
    } else if (Array.isArray(item)) {
      return toAppleScriptList(item);
    } else {
      // For objects, convert to string and escape
      return escapeAppleScriptString(JSON.stringify(item));
    }
  });
  return `{${escaped.join(', ')}}`;
}

/**
 * Converts a JavaScript object to an AppleScript record
 * Example: {name: "test", value: 42} => {name:"test", value:42}
 */
export function toAppleScriptRecord(obj: Record<string, any>): string {
  const pairs = Object.entries(obj).map(([key, value]) => {
    let valueStr: string;
    if (typeof value === 'string') {
      valueStr = escapeAppleScriptString(value);
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      valueStr = String(value);
    } else if (value === null || value === undefined) {
      valueStr = 'missing value';
    } else if (Array.isArray(value)) {
      valueStr = toAppleScriptList(value);
    } else if (typeof value === 'object') {
      valueStr = toAppleScriptRecord(value);
    } else {
      valueStr = escapeAppleScriptString(String(value));
    }
    return `${key}:${valueStr}`;
  });
  return `{${pairs.join(', ')}}`;
}

/**
 * Tagged template literal function for AppleScript
 * All values are JSON-stringified for consistent parsing in AppleScript
 *
 * Usage:
 * const name = "My Notebook";
 * const items = ["file1.txt", "file2.txt"];
 * const code = script`
 *   tell application "BBEdit"
 *     set nameValue to parseValue(${name})
 *     set itemsValue to parseValue(${items})
 *     make new notebook with properties {name:nameValue}
 *     repeat with itemPath in itemsValue
 *       open itemPath
 *     end repeat
 *   end tell
 * `;
 *
 * Note: All interpolated values are JSON strings that must be parsed with parseValue() in AppleScript
 */
export function script(strings: TemplateStringsArray, ...values: any[]): string {
  return strings.reduce((result, str, i) => {
    const value = values[i];
    if (value === undefined) return result + str;

    // All values are JSON-stringified and escaped for AppleScript string literals
    const jsonString = JSON.stringify(value);
    return result + str + escapeAppleScriptString(jsonString);
  }, '');
}

/**
 * Renders a template string with variables
 * Alternative to tagged template literals for dynamic template loading
 * All values are JSON-stringified for consistent parsing in AppleScript
 *
 * @param template - Template string with ${variable} markers
 * @param variables - Object with variable values
 * @returns Rendered AppleScript code with JSON-stringified values
 *
 * Note: All interpolated values are JSON strings that must be parsed with parseValue() in AppleScript
 */
export function renderTemplate(template: string, variables: Record<string, any>): string {
  return template.replace(/\$\{([^}]+)\}/g, (match, varName) => {
    const value = variables[varName.trim()];
    if (value === undefined) {
      throw new Error(`Template variable '${varName}' is not defined`);
    }

    // All values are JSON-stringified and escaped for AppleScript string literals
    const jsonString = JSON.stringify(value);
    return escapeAppleScriptString(jsonString);
  });
}
