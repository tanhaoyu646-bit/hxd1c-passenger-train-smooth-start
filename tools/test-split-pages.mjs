import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { TrainSimulation } from '../scripts/dynamics.js';
import { SMOOTH_START_TERRAINS } from '../scripts/scenario.js';
import { getProcedure } from '../scripts/procedure.js';

const departureHtml = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const smoothHtml = await readFile(new URL('../smooth-start/index.html', import.meta.url), 'utf8');
assert.match(departureHtml, /data-training-app="departure"/);
assert.match(smoothHtml, /data-training-app="smooth"/);
assert.match(smoothHtml, /<base href="\.\.\/">/);
assert.deepEqual(Object.keys(SMOOTH_START_TERRAINS), ['level', 'uphill']);

const full = new TrainSimulation();
assert.equal(getProcedure(full.state).length, 19);

const level = new TrainSimulation();
assert.equal(level.command('terrain-select', 'level'), true);
assert.equal(level.state.trainingScope, 'smooth-only');
assert.equal(level.state.independentBrake, 2);
assert.equal(level.command('parking-release'), true);
assert.equal(level.command('tail-query', level.state.tailPipe), true);
assert.equal(level.command('auto-brake', 0), true);
for (let i = 0; i < 120; i += 1) level.tick(.05);
assert.equal(level.command('tail-query', level.state.tailPipe), true);
assert.equal(level.command('independent-brake', 0), true);
assert.equal(level.command('traction', 1), true);
assert.equal(level.state.lowNotchApplied, true);
assert.equal(level.state.singleValveNotchSynchronized, true);
assert.equal(getProcedure(level.state).length, 8);

const uphill = new TrainSimulation();
assert.equal(uphill.command('terrain-select', 'uphill'), true);
assert.equal(uphill.state.independentBrake, 2);
assert.equal(uphill.command('parking-release'), true);
assert.equal(uphill.command('tail-query', uphill.state.tailPipe), true);
assert.equal(uphill.command('independent-brake', 0), true);
assert.equal(uphill.command('traction', 1), true, '上坡道应允许自阀保持时以1.0级建立牵引');
for (let i = 0; i < 24; i += 1) uphill.tick(.05);
assert.equal(uphill.state.tractionCurrentRising, true);
assert.equal(uphill.command('auto-brake', 0), true);
assert.equal(uphill.state.notchOneHoldCorrect, true);
assert.equal(uphill.state.rollbackRisk, false);

const unsafeUphill = new TrainSimulation();
unsafeUphill.command('terrain-select', 'uphill');
unsafeUphill.command('parking-release');
unsafeUphill.command('tail-query', unsafeUphill.state.tailPipe);
unsafeUphill.command('independent-brake', 0);
unsafeUphill.command('auto-brake', 0);
unsafeUphill.tick(.1);
assert.equal(unsafeUphill.state.rollbackRisk, true, '未建立牵引即解除上坡保持应记录后溜风险');

console.log('Split pages valid: complete departure has 19 items; specialty has 8 scored items and differentiated level/uphill start logic.');
