import test from 'node:test';
import assert from 'node:assert/strict';
import {administratorKey} from './admin-key.js';
test('administrator keys rotate every five minutes and depend on the server secret',()=>{
  assert.equal(administratorKey('secret',0),administratorKey('secret',299999));
  assert.notEqual(administratorKey('secret',299999),administratorKey('secret',300000));
  assert.notEqual(administratorKey('secret',0),administratorKey('other',0));
});
