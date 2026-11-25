import assert from 'node:assert/strict';
import {test} from 'node:test';
import {heightPreview} from '../src/native/heightPreview.ts';
test('explicit metric and imperial heights convert without changing input',()=>{
 assert.equal(heightPreview('193 cm','imperial'),'6 ft 4 in');
 assert.equal(heightPreview('1.93 m','metric'),'193 cm');
 assert.equal(heightPreview('6 ft 4 in','metric'),'193 cm');
 assert.equal(heightPreview("6'4\"",'metric'),'193 cm');
 assert.equal(heightPreview('6′4″','imperial'),'6 ft 4 in');
 assert.equal(heightPreview('182.87 cm','imperial'),'6 ft 0 in');
});
test('ambiguous, missing and invalid heights remain unavailable',()=>{
 for(const value of ['193','6-4','', 'unknown','6 ft 12 in','0 cm','301 cm','-193 cm','Infinity cm']) assert.equal(heightPreview(value,'metric'),null,value);
});
