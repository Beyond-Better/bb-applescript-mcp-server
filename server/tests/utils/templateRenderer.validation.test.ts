/**
 * Validation tests to verify the new JSON-based template rendering
 * Tests that values are properly JSON-stringified and escaped for AppleScript
 */

import { assertEquals } from '@std/assert';
import { script, renderTemplate } from '../../src/utils/templateRenderer.ts';

Deno.test('JSON approach - string produces escaped JSON string', () => {
  const name = 'My Notebook';
  const result = script`set noteName to ${name}`;
  
  // The value should be a JSON string ("My Notebook") escaped for AppleScript
  // JSON.stringify('My Notebook') = '"My Notebook"'
  // Escaped for AppleScript: '\\"My Notebook\\"'
  assertEquals(result, 'set noteName to "\\"My Notebook\\""');
});

Deno.test('JSON approach - number produces JSON number string', () => {
  const count = 42;
  const result = script`set itemCount to ${count}`;
  
  // JSON.stringify(42) = '42'
  // Escaped for AppleScript: '"42"' (just quoted, no escaping needed)
  assertEquals(result, 'set itemCount to "42"');
});

Deno.test('JSON approach - boolean produces JSON boolean string', () => {
  const flag = true;
  const result = script`set enabled to ${flag}`;
  
  // JSON.stringify(true) = 'true'
  // Escaped for AppleScript: '"true"'
  assertEquals(result, 'set enabled to "true"');
});

Deno.test('JSON approach - null produces JSON null string', () => {
  const value = null;
  const result = script`set value to ${value}`;
  
  // JSON.stringify(null) = 'null'
  // Escaped for AppleScript: '"null"'
  assertEquals(result, 'set value to "null"');
});

Deno.test('JSON approach - array produces escaped JSON array string', () => {
  const items = ['file1', 'file2'];
  const result = script`set fileList to ${items}`;
  
  // JSON.stringify(['file1', 'file2']) = '["file1","file2"]'
  // Escaped for AppleScript with quotes and backslashes
  assertEquals(result, 'set fileList to "[\\"file1\\",\\"file2\\"]"');
});

Deno.test('JSON approach - object produces escaped JSON object string', () => {
  const props = { name: 'test', value: 10 };
  const result = script`make new item with properties ${props}`;
  
  // JSON.stringify({name: 'test', value: 10}) = '{"name":"test","value":10}'
  // Escaped for AppleScript
  assertEquals(result, 'make new item with properties "{\\"name\\":\\"test\\",\\"value\\":10}"');
});

Deno.test('JSON approach - string with special characters', () => {
  const text = 'Hello "world" with\\backslash';
  const result = script`set text to ${text}`;
  
  // JSON.stringify() will escape the quotes and backslash
  // Then we escape for AppleScript
  assertEquals(result, 'set text to "\\"Hello \\\\\\"world\\\\\\" with\\\\\\\\backslash\\""');
});

Deno.test('JSON approach - renderTemplate with string', () => {
  const template = 'set name to ${name}';
  const result = renderTemplate(template, { name: 'Test' });
  
  // Should produce same format as script tagged template
  assertEquals(result, 'set name to "\\"Test\\""');
});

Deno.test('JSON approach - renderTemplate with number', () => {
  const template = 'set count to ${count}';
  const result = renderTemplate(template, { count: 5 });
  
  assertEquals(result, 'set count to "5"');
});

Deno.test('JSON approach - renderTemplate with array', () => {
  const template = 'set items to ${items}';
  const result = renderTemplate(template, { items: ['a', 'b'] });
  
  assertEquals(result, 'set items to "[\\"a\\",\\"b\\"]"');
});

Deno.test('JSON approach - renderTemplate with multiple values', () => {
  const template = 'set x to ${name} and y to ${count}';
  const result = renderTemplate(template, { name: 'Test', count: 5 });
  
  assertEquals(result, 'set x to "\\"Test\\"" and y to "5"');
});

Deno.test('JSON approach - multiple values in script template', () => {
  const name = 'Test';
  const count = 5;
  const items = ['a', 'b'];
  const result = script`set x to ${name} and y to ${count} and z to ${items}`;
  
  assertEquals(
    result,
    'set x to "\\"Test\\"" and y to "5" and z to "[\\"a\\",\\"b\\"]"'
  );
});