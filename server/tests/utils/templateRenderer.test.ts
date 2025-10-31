/**
 * Tests for templateRenderer.ts
 * Tests template rendering, escaping, and type conversions
 */

import { assertEquals, assertThrows } from '@std/assert';
import {
  escapeAppleScriptString,
  renderTemplate,
  script,
  toAppleScriptList,
  toAppleScriptRecord,
} from '../../src/utils/templateRenderer.ts';

Deno.test('escapeAppleScriptString - basic string', () => {
  const result = escapeAppleScriptString('hello');
  assertEquals(result, '"hello"');
});

Deno.test('escapeAppleScriptString - string with quotes', () => {
  const result = escapeAppleScriptString('hello "world"');
  assertEquals(result, '"hello \\"world\\""');
});

Deno.test('escapeAppleScriptString - string with backslashes', () => {
  const result = escapeAppleScriptString('path\\to\\file');
  assertEquals(result, '"path\\\\to\\\\file"');
});

Deno.test('escapeAppleScriptString - empty string', () => {
  const result = escapeAppleScriptString('');
  assertEquals(result, '""');
});

Deno.test('toAppleScriptList - string array', () => {
  const result = toAppleScriptList(['a', 'b', 'c']);
  assertEquals(result, '{"a", "b", "c"}');
});

Deno.test('toAppleScriptList - mixed types', () => {
  const result = toAppleScriptList(['text', 42, true, false]);
  assertEquals(result, '{"text", 42, true, false}');
});

Deno.test('toAppleScriptList - with null and undefined', () => {
  const result = toAppleScriptList(['a', null, undefined]);
  assertEquals(result, '{"a", missing value, missing value}');
});

Deno.test('toAppleScriptList - nested arrays', () => {
  const result = toAppleScriptList(['a', ['b', 'c'], 'd']);
  assertEquals(result, '{"a", {"b", "c"}, "d"}');
});

Deno.test('toAppleScriptList - empty array', () => {
  const result = toAppleScriptList([]);
  assertEquals(result, '{}');
});

Deno.test('toAppleScriptList - array with strings needing escaping', () => {
  const result = toAppleScriptList(['hello "world"', 'path\\file']);
  assertEquals(result, '{"hello \\"world\\"", "path\\\\file"}');
});

Deno.test('toAppleScriptRecord - simple object', () => {
  const result = toAppleScriptRecord({ name: 'test', value: 42 });
  assertEquals(result, '{name:"test", value:42}');
});

Deno.test('toAppleScriptRecord - object with boolean', () => {
  const result = toAppleScriptRecord({ enabled: true, visible: false });
  assertEquals(result, '{enabled:true, visible:false}');
});

Deno.test('toAppleScriptRecord - object with null', () => {
  const result = toAppleScriptRecord({ name: 'test', value: null });
  assertEquals(result, '{name:"test", value:missing value}');
});

Deno.test('toAppleScriptRecord - object with array', () => {
  const result = toAppleScriptRecord({ items: ['a', 'b', 'c'] });
  assertEquals(result, '{items:{"a", "b", "c"}}');
});

Deno.test('toAppleScriptRecord - nested object', () => {
  const result = toAppleScriptRecord({
    name: 'test',
    config: { enabled: true, count: 5 },
  });
  assertEquals(result, '{name:"test", config:{enabled:true, count:5}}');
});

Deno.test('toAppleScriptRecord - empty object', () => {
  const result = toAppleScriptRecord({});
  assertEquals(result, '{}');
});

Deno.test('script - tagged template with string', () => {
  const name = 'My Notebook';
  const result = script`set noteName to ${name}`;
  assertEquals(result, 'set noteName to "\\"My Notebook\\""');
});

Deno.test('script - tagged template with number', () => {
  const count = 42;
  const result = script`set itemCount to ${count}`;
  assertEquals(result, 'set itemCount to "42"');
});

Deno.test('script - tagged template with array', () => {
  const items = ['file1', 'file2'];
  const result = script`set fileList to ${items}`;
  assertEquals(result, 'set fileList to "[\\"file1\\",\\"file2\\"]"');
});

Deno.test('script - tagged template with object', () => {
  const props = { name: 'test', value: 10 };
  const result = script`make new item with properties ${props}`;
  assertEquals(result, 'make new item with properties "{\\"name\\":\\"test\\",\\"value\\":10}"');
});

Deno.test('script - tagged template with multiple values', () => {
  const name = 'Test';
  const count = 5;
  const items = ['a', 'b'];
  const result = script`set x to ${name} and y to ${count} and z to ${items}`;
  assertEquals(result, 'set x to "\\"Test\\"" and y to "5" and z to "[\\"a\\",\\"b\\"]"');
});

Deno.test('renderTemplate - simple variable', () => {
  const template = 'Hello ${name}!';
  const result = renderTemplate(template, { name: 'World' });
  assertEquals(result, 'Hello "\\"World\\""!');
});

Deno.test('renderTemplate - multiple variables', () => {
  const template = 'set ${varName} to ${value}';
  const result = renderTemplate(template, { varName: 'count', value: 42 });
  assertEquals(result, 'set "\\"count\\"" to "42"');
});

Deno.test('renderTemplate - with array', () => {
  const template = 'set items to ${list}';
  const result = renderTemplate(template, { list: ['a', 'b', 'c'] });
  assertEquals(result, 'set items to "[\\"a\\",\\"b\\",\\"c\\"]"');
});

Deno.test('renderTemplate - with object', () => {
  const template = 'make new item with properties ${props}';
  const result = renderTemplate(template, { props: { name: 'test', enabled: true } });
  assertEquals(result, 'make new item with properties "{\\"name\\":\\"test\\",\\"enabled\\":true}"');
});

Deno.test('renderTemplate - undefined variable throws', () => {
  const template = 'set x to ${missing}';
  assertThrows(
    () => renderTemplate(template, {}),
    Error,
    "Template variable 'missing' is not defined",
  );
});

Deno.test('renderTemplate - variable with whitespace', () => {
  const template = 'set x to ${ name }';
  const result = renderTemplate(template, { name: 'test' });
  assertEquals(result, 'set x to "\\"test\\""');
});

Deno.test('renderTemplate - complex template', () => {
  const template = `tell application "BBEdit"
		make new notebook with properties {name:$\{name\}}
		repeat with itemPath in $\{items\}
			open itemPath
		end repeat
	end tell`;
  const result = renderTemplate(template, {
    name: 'My Notebook',
    items: ['file1.txt', 'file2.txt'],
  });

  // Check that it contains expected JSON strings (escaped for AppleScript)
  assertEquals(result.includes('"\\"My Notebook\\""'), true);
  assertEquals(result.includes('"[\\"file1.txt\\",\\"file2.txt\\"]"'), true);
});
