import { test } from 'node:test';
import assert from 'node:assert/strict';
import { XMLParser } from 'fast-xml-parser';

test('Testrunner und XML-Parser sind verfügbar', () => {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
  const result = parser.parse('<gpx><wpt lat="50.1" lon="7.2"><name>Test</name></wpt></gpx>');
  assert.equal(result.gpx.wpt['@_lat'], '50.1');
  assert.equal(result.gpx.wpt.name, 'Test');
});
