import { TRAIN_DYNAMICS } from './scenario.js?rev=smooth-start-v14-lkj-integration';

const scenarioSignalReady = (s) => s.scenarioId === 'weather'
  ? s.locomotiveSignalObserved
  : s.signalObserved && s.locomotiveSignalObserved;

const departureBrakesReady = (s) => !s.parkingBrake
  && s.autoBrake === 0
  && s.independentBrake === 0
  && s.brakeCyl < 15;

const credentialWorkflowReady = (s) => (s.tailPressureQueried || s.trainingMode === 'assessment')
  && s.credentialConfirmed
  && (!s.lkjUnlockRequired || s.lkjUnlockCorrect || (s.trainingMode === 'assessment' && s.lkjUnlockAttempted))
  && (!s.handSignalRequired || s.handSignalConfirmed)
  && (s.credentialCorrect || s.trainingMode === 'assessment');

export const PROCEDURE = [
  ['选择K2026次训练场景', s => s.scenarioSelected, 2],
  ['确认驾驶台设备初始位置', s => s.initialConfirmed || (s.trainingMode === 'assessment' && s.initialAttempted), 4, s => s.initialConfirmed],
  ['输入并核对LKJ参数和运行揭示', s => s.lkjConfirmed || (s.trainingMode === 'assessment' && s.lkjAttempted), 6, s => s.lkjConfirmed],
  ['升受电弓、闭合主断并建立总风', s => s.panto && s.netVoltage >= 22.5 && s.mainBreaker && s.compressor && s.mainRes >= 750, 5],
  ['简略制动机试验：减压并确认制动', s => s.brakeTested, 4],
  ['大闸回运转位并确认列车缓解', s => s.releaseObserved, 4],
  ['查询列尾风压并完成行车凭证、发车通知和手信号', credentialWorkflowReady, 10],
  ['按场景确认地面信号和机车信号', scenarioSignalReady, 4],
  ['开启前照灯并鸣笛', s => s.headlight && s.horn, 3],
  ['方向手柄置前进位', s => s.direction === 'F', 3],
  ['确认大小闸缓解并缓解停放制动', departureBrakesReady, 5],
  ['牵引手柄由零位推至1～2级', s => s.lowNotchApplied, 7],
  ['保持低级位，等待牵引力向全列传递', s => s.lowNotchHeld, 7],
  ['确认全列12辆车辆依次起动', s => s.wholeTrainStarted, 8],
  ['左后或右后瞭望确认全列移动', s => s.rearLookCompleted, 6],
  ['全列起动后逐级增加牵引', s => s.progressiveTraction, 7],
  ['速度5～15 km/h时保持平稳加速', s => s.smoothStartQualified, 6],
  ['接近出站信号机按压LKJ开车／7键', s => s.lkjStartCorrect || (s.trainingMode === 'assessment' && s.lkjStartAttempted), 5, s => s.lkjStartCorrect],
  ['越过出站信号机后稳定运行300 m', s => s.completed, 4],
];

export function procedureState(state) {
  const complete = PROCEDURE.map(([, test]) => Boolean(test(state)));
  const current = complete.findIndex((done) => !done);
  return { complete, current: current < 0 ? PROCEDURE.length - 1 : current, done: complete.every(Boolean) };
}
function credentialStepEarned(state) {
  const locked = new Set(state.assessmentCredentialLocks || []);
  if (!state.lkjUnlockRequired) {
    return (state.credentialCorrect && !locked.has('credential') ? 4 : 0)
      + (state.tailPressureQueried && !locked.has('tail') ? 3 : 0)
      + ((!state.handSignalRequired || state.handSignalConfirmed) && !locked.has('handSignal') ? 3 : 0);
  }
  let earned = 0;
  if (state.credentialCorrect && !locked.has('credential')) earned += 2;
  if (state.departureNoticeReceived && !locked.has('notice')) earned += 1;
  if ((!state.handSignalRequired || state.handSignalConfirmed) && !locked.has('handSignal')) earned += 1;
  if (state.tailPressureQueried && !locked.has('tail')) earned += 2;
  if (state.lkjUnlockMethodCorrect && !state.lkjUnlockMethodErrorRecorded && !locked.has('method')) earned += 1;
  if (state.lkjUnlockFieldsCorrect && !state.lkjUnlockFieldsErrorRecorded && !locked.has('fields')) earned += 1;
  if (state.lkjUnlockCombinationCorrect && !state.lkjUnlockCombinationErrorRecorded && !locked.has('combination')) earned += 2;
  return earned;
}

export function scoreRun(state) {
  const p = procedureState(state);
  const scoreLocks = new Set(state.assessmentScoreLocks || []);
  const itemScores = PROCEDURE.map(([label, workflowTest, weight, scoreTest = workflowTest], index) => {
    const rawEarned = index === 6 ? credentialStepEarned(state) : scoreTest(state) ? weight : 0;
    const earned = scoreLocks.has(index) ? 0 : rawEarned;
    return {
      label,
      weight,
      complete: Boolean(workflowTest(state)),
      correct: earned === weight,
      earned,
      locked: scoreLocks.has(index),
    };
  });
  const base = itemScores.reduce((sum, item) => sum + item.earned, 0);
  const deductions = Math.min(24,
    state.rejected * 2
    + state.abrupt * 2
    + (state.prematureAcceleration ? 6 : 0)
    + (state.maxAcceleration > TRAIN_DYNAMICS.comfort.severeAcceleration ? 4 : 0)
    + (state.maxJerk > TRAIN_DYNAMICS.comfort.severeJerk ? 4 : 0));
  return { score: Math.max(0, Math.min(100, base - deductions)), completed: p.complete.filter(Boolean).length, deductions, itemScores };
}
