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
assert.equal(getProcedure(full.state).length, 20);

const level = new TrainSimulation();
assert.equal(level.command('terrain-select', 'level'), true);
assert.equal(level.state.trainingScope, 'smooth-only');
assert.equal(level.state.independentBrake, 0);
assert.equal(level.command('parking-release'), true);
assert.equal(level.command('traction', 1), true);
assert.equal(level.state.lowNotchApplied, true);
assert.equal(getProcedure(level.state).length, 9);

const uphill = new TrainSimulation();
assert.equal(uphill.command('terrain-select', 'uphill'), true);
assert.equal(uphill.state.independentBrake, 2);
assert.equal(uphill.command('parking-release'), true);
assert.equal(uphill.command('traction', 2), true, '上坡道应允许单阀保持时以2级建立牵引');
for (let i = 0; i < 40; i += 1) uphill.tick(.1);
assert.ok(uphill.state.actualTraction >= 1.5);
assert.equal(uphill.command('independent-brake', 0), true);
uphill.tick(.1);
assert.equal(uphill.state.hillHoldReleasedCorrectly, true);
assert.equal(uphill.state.rollbackRisk, false);

const unsafeUphill = new TrainSimulation();
unsafeUphill.command('terrain-select', 'uphill');
unsafeUphill.command('parking-release');
unsafeUphill.command('independent-brake', 0);
unsafeUphill.tick(.1);
assert.equal(unsafeUphill.state.rollbackRisk, true, '未建立牵引即解除上坡保持应记录后溜风险');

console.log('Split pages valid: complete departure has 20 items; smooth specialty has level/uphill only with differentiated hill-start logic.');

