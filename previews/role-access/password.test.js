import test from 'node:test';
import assert from 'node:assert/strict';
import {passwordChecks,validPassword} from './src/password.js';
test('new passwords require eight characters and all four criteria',()=>{
  for(const value of [null,undefined,12345678,'','Abc1234','abcdefgh','ABCDEFG1','abcdefg1','Abcdefgh','Aa1'+'x'.repeat(198)]) assert.equal(validPassword(value),false);
  assert.equal(validPassword('Abcdefg1'),true);
  assert.equal(validPassword('Aa1'+'x'.repeat(197)),true);
  assert.deepEqual(passwordChecks('Abcdefg1'),[true,true,true,true]);
});
