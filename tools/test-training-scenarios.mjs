import assert from 'node:assert/strict';
import { TrainSimulation } from '../scripts/dynamics.js';
import { LKJ_FIELD_DEFINITIONS, LKJ_TRAINING_PARAMETERS, TRAIN_DYNAMICS } from '../scripts/scenario.js';
import { ROUTE_CONTEXT, getScenario } from '../scripts/credentialScenario.js';
import { PROCEDURE, procedureState, scoreRun } from '../scripts/procedure.js';

const INITIAL_KEYS = ['traction', 'direction', 'autoBrake', 'independentBrake', 'parkingBrake', 'panto', 'mainBreaker', 'compressor'];

function prepare(id, mode = 'teaching') {
  const sim = new TrainSimulation();
  if (mode === 'assessment') assert.equal(sim.command('training-mode', mode), true);
  assert.equal(sim.command('scenario-select', id), true);
  for (const key of INITIAL_KEYS) assert.equal(sim.command('initial-inspect', key), true);
  assert.equal(sim.command('initial-confirm'), true);
  assert.equal(sim.command('lkj-confirm', LKJ_TRAINING_PARAMETERS), true);
  assert.equal(sim.command('panto', true), true);
  for (let index = 0; index < 300; index += 1) sim.tick(0.05);
  assert.equal(sim.command('main-breaker', true), true);
  assert.equal(sim.command('compressor', true), true);
  assert.equal(sim.command('auto-brake', 1), true);
  for (let index = 0; index < 100; index += 1) sim.tick(0.05);
  assert.equal(sim.command('auto-brake', 0), true);
  for (let index = 0; index < 400; index += 1) sim.tick(0.05);
  assert.equal(sim.command('parking-release'), true);
  return sim;
}

const earlyNormalCall = new TrainSimulation();
assert.equal(earlyNormalCall.command('scenario-select', 'normal'), true);
assert.equal(earlyNormalCall.command('station-contact', true), false, '简略试验完成前不应接通车站首次来电');
assert.equal(earlyNormalCall.state.radioContacted, false, '被拒绝的接听不得写入联控完成状态');

const earlyDepartureCall = prepare('normal');
assert.equal(earlyDepartureCall.command('station-contact', true), true);
assert.equal(earlyDepartureCall.command('departure-notice', true), false, '地面和机车信号确认前不应办理第二次发车联控');
assert.equal(earlyDepartureCall.state.departureNoticeReceived, false, '被拒绝的第二次来电不得写入完成状态');

function authorize(sim, id) {
  assert.equal(sim.command('tail-link', '123456'), true);
  assert.equal(sim.command('tail-query', sim.state.tailPipe), true);
  if (id === 'normal') {
    assert.equal(sim.command('station-contact'), true);
    assert.equal(sim.command('signal-answer', 'green'), true);
    assert.equal(sim.command('locomotive-signal-answer', 'green'), true);
    assert.equal(sim.command('departure-notice', true), true);
  } else if (id === 'weather') {
    assert.equal(sim.command('order-sign'), true);
    assert.equal(sim.command('locomotive-signal-answer', 'green'), true);
    assert.equal(sim.command('weather-report'), true);
  } else {
    if (id === 'greenPermit') assert.equal(sim.command('station-contact'), true);
    else assert.equal(sim.command('order-sign'), true);
    assert.equal(sim.command('credential-open'), true);
    assert.equal(sim.command('credential-submit', true), true);
    const scenario = getScenario(id);
    assert.equal(sim.command('lkj-special-method', scenario.lkjUnlockMethod), true);
    assert.equal(sim.command('lkj-special-input', Object.fromEntries(scenario.lkjUnlockFields.map(([key, , value]) => [key, value]))), true);
    assert.equal(sim.command('lkj-special-unlock', true), true);
    assert.equal(sim.state.lkjUnlockLimit, id === 'greenPermit' ? 60 : 45);
    assert.equal(sim.command('departure-notice'), true);
    assert.equal(sim.command('signal-answer', 'red'), true);
    assert.equal(sim.command('locomotive-signal-answer', 'red'), true);
  }
  assert.equal(sim.command('hand-signal-confirm'), true);
  assert.equal(sim.command('headlight'), true);
  assert.equal(sim.command('horn'), true);
  assert.equal(sim.command('direction', 'F'), true);
  assert.equal(sim.command('traction', 1), true);
}

function runScenario(id) {
  const sim = prepare(id);
  authorize(sim, id);
  let lkjStartPressed = false;
  let weatherSignalConfirmed = false;
  let progressiveTractionApplied = false;
  for (let index = 0; index < 200000 && !sim.state.completed; index += 1) {
    sim.tick(0.05, 'rearLeft');
    if (!progressiveTractionApplied && sim.state.wholeTrainStarted) {
      assert.equal(sim.command('traction', 2), true);
      progressiveTractionApplied = true;
    }
    if (id === 'weather' && !weatherSignalConfirmed && sim.state.credentialStage === 'confirm-ground-signal') {
      assert.equal(sim.command('signal-answer', 'green'), true);
      weatherSignalConfirmed = true;
    }
    if (!lkjStartPressed && sim.state.speed >= 1 && Math.abs(sim.state.distance - ROUTE_CONTEXT.departureSignalDistance) < 5) {
      assert.equal(sim.command('lkj-start'), true);
      lkjStartPressed = true;
    }
  }
  assert.equal(sim.state.completed, true, `${id}未完成训练终点`);
  assert.equal(sim.state.lkjStartCorrect, true, `${id}未完成LKJ开车对标`);
  assert(sim.state.distance >= ROUTE_CONTEXT.trainingEndDistance);
  const procedure = procedureState(sim.state);
  const result = scoreRun(sim.state);
  assert.equal(procedure.done, true, `${id}仍有未完成评分项`);
  assert.deepEqual(procedure.complete, Array(PROCEDURE.length).fill(true), `${id}评分项完成状态异常`);
  assert.equal(result.completed, PROCEDURE.length, `${id}完成项数量异常`);
  assert.equal(result.deductions, 0, `${id}规范流程不应产生操作扣分`);
  assert.equal(result.score, 100, `${id}规范流程未获得100分`);
  assert.equal(result.itemScores.reduce((sum, item) => sum + item.earned, 0), 100, `${id}逐项得分合计异常`);
  return sim;
}

for (const id of ['normal', 'weather', 'greenPermit', 'routeTicket']) runScenario(id);

for (const [id, limit] of [['greenPermit', 60], ['routeTicket', 45]]) {
  const limited = prepare(id);
  authorize(limited, id);
  limited.state.speed = 100;
  limited.tick(0.05);
  assert(limited.state.speed <= limit, `${id}解锁后的LKJ限速应为${limit}km/h`);
}

for (const id of ['greenPermit', 'routeTicket']) {
  const blocked = prepare(id);
  if (id === 'greenPermit') assert.equal(blocked.command('station-contact'), true);
  else assert.equal(blocked.command('order-sign'), true);
  assert.equal(blocked.command('credential-open'), true);
  assert.equal(blocked.command('credential-submit', true), true);
  const scenario = getScenario(id);
  assert.equal(blocked.command('lkj-special-method', scenario.lkjUnlockMethod), true);
  assert.equal(blocked.command('lkj-special-input', Object.fromEntries(scenario.lkjUnlockFields.map(([key, , value]) => [key, value]))), true);
  assert.equal(blocked.command('departure-notice'), false, `${id}未解锁时错误放行`);
  assert.equal(blocked.state.departureNoticeReceived, false, `${id}未解锁时错误记录发车通知`);
  assert.equal(blocked.state.authority, false, `${id}未解锁时错误取得行车授权`);
}

const assessedWrong = prepare('greenPermit', 'assessment');
assert.equal(assessedWrong.command('station-contact'), true);
assert.equal(assessedWrong.command('credential-open'), true);
assert.equal(assessedWrong.command('credential-submit', false), true);
assert.equal(assessedWrong.command('lkj-special-method', 'routeTicket'), true);
assert.equal(assessedWrong.command('lkj-special-input', { permitNumber: '000000' }), true);
assert.equal(assessedWrong.command('lkj-special-unlock', false), true);
assert.equal(assessedWrong.command('departure-notice'), true);
assert.equal(assessedWrong.command('hand-signal-confirm'), true);
assert.equal(procedureState(assessedWrong.state).complete[6], true, '考评模式错误操作应记录后继续流程');
assert.equal(scoreRun(assessedWrong.state).itemScores[6].earned, 0, '凭证和LKJ解锁错误后，发车前联控项不得分');
assert.equal(scoreRun(assessedWrong.state).itemScores[8].earned, 4, '发车通知和手信号规范完成应单独得分');

const assessmentSoftGate = new TrainSimulation();
assert.equal(assessmentSoftGate.command('training-mode', 'assessment'), true);
assert.equal(assessmentSoftGate.command('scenario-select', 'normal'), true);
assert.equal(assessmentSoftGate.command('panto', true), true);
for (let index = 0; index < 300; index += 1) assessmentSoftGate.tick(0.05);
assert.equal(assessmentSoftGate.command('main-breaker', true), true);
assert.equal(assessmentSoftGate.command('parking-release'), true);
assert.equal(assessmentSoftGate.command('direction', 'F'), true);
assert.equal(assessmentSoftGate.command('traction', 1), true, '考评模式满足物理条件后不应被流程门禁阻断');
for (let index = 0; index < 1000; index += 1) assessmentSoftGate.tick(0.05);
assert(assessmentSoftGate.state.distance > 0, '考评模式列车应实际移动');
assert(assessmentSoftGate.state.assessmentScoreLocks.includes(1), '动车时未完成的评分项应锁定失分');
assert(assessmentSoftGate.state.assessmentCredentialLocks.includes('credential'), '动车时未确认凭证应锁定对应子项失分');
assessmentSoftGate.command('headlight');
assessmentSoftGate.command('horn');
assert.equal(scoreRun(assessmentSoftGate.state).itemScores[9].earned, 0, '动车后补做不得恢复已锁定的顺序分');
for (let index = 0; index < 200000 && !assessmentSoftGate.state.completed; index += 1) assessmentSoftGate.tick(0.05);
assert.equal(assessmentSoftGate.state.completed, true, '考评模式流程不完整时仍应能到达训练终点并结算');

const mismatch = prepare('weather');
mismatch.command('tail-link', '123456');
mismatch.command('tail-query', mismatch.state.tailPipe);
mismatch.command('order-sign');
mismatch.command('locomotive-signal-answer', 'green');
mismatch.command('weather-report');
mismatch.command('hand-signal-confirm');
mismatch.command('headlight');
mismatch.command('horn');
mismatch.command('direction', 'F');
mismatch.command('traction', 1);
for (let index = 0; index < 12000 && mismatch.state.credentialStage !== 'confirm-ground-signal'; index += 1) mismatch.tick(0.05);
assert.equal(mismatch.command('signal-answer', 'red'), false);
assert.equal(mismatch.state.signalMismatch, true);
assert.equal(mismatch.state.authority, true, '信号核对错误应扣分提示，但不由系统撤销既有发车授权或强切牵引');
assert.equal(mismatch.state.traction, 1, '信号不一致只提示司机处置，不替学生自动切除牵引');
assert.equal(mismatch.state.autoBrake, 0, '信号不一致只提示司机处置，不替学生自动投入制动');
assert.equal(mismatch.command('signal-answer', 'green'), true);
assert.equal(mismatch.state.signalMismatch, false, '重新正确确认后应解除不一致记录');

const assessmentMismatch = prepare('weather', 'assessment');
assessmentMismatch.command('order-sign');
assessmentMismatch.command('locomotive-signal-answer', 'green');
assessmentMismatch.command('weather-report');
assessmentMismatch.command('hand-signal-confirm');
assessmentMismatch.command('direction', 'F');
assessmentMismatch.command('traction', 1);
for (let index = 0; index < 12000 && assessmentMismatch.state.credentialStage !== 'confirm-ground-signal'; index += 1) assessmentMismatch.tick(0.05);
assert.equal(assessmentMismatch.command('signal-answer', 'red'), false);
assert.equal(assessmentMismatch.state.signalMismatch, true, '考评模式应记录信号不一致，由学生完成减速或停车处置');
assert.equal(assessmentMismatch.state.authority, true);
assert.equal(assessmentMismatch.state.traction, 1);
assert.equal(assessmentMismatch.state.autoBrake, 0);

assert.equal(LKJ_FIELD_DEFINITIONS.length, 16, 'LKJ参数设定应覆盖本任务所需16项字段');
assert.equal(TRAIN_DYNAMICS.totalMassKg, 850000);
assert.equal(TRAIN_DYNAMICS.tractionForcePerNotchN * TRAIN_DYNAMICS.tractionNotches >= 510000, true, '七级牵引应接近HXD1C最大起动牵引力');

const specialty = new TrainSimulation();
assert.equal(specialty.command('training-scope', 'smooth-only'), true);
assert.equal(specialty.command('scenario-select', 'normal'), true);
assert.equal(specialty.state.initialConfirmed, true);
assert.equal(specialty.state.lkjConfirmed, true);
assert.equal(specialty.state.brakeTested, true);
assert.equal(specialty.state.releaseObserved, true);
assert.equal(specialty.state.authority, true);
assert.equal(specialty.state.direction, 'F');
assert.equal(specialty.state.parkingBrake, true, '专项训练仍应要求学生亲自缓解停放制动');
assert.equal(specialty.command('parking-release'), true);
assert.equal(specialty.command('traction', 1), true);
for (let index = 0; index < 600; index += 1) specialty.tick(0.05, 'rearLeft');
assert(specialty.state.distance > 0, '专项训练应能实际起动列车');

assert.equal(PROCEDURE.reduce((sum, [, , weight]) => sum + weight, 0), 100);
console.log('Training scenarios valid: four scenarios, expanded LKJ data, 60/45 unlock, assessment soft gates, and driver-handled signal mismatch passed.');
