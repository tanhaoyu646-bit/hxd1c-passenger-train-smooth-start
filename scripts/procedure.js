import { TRAIN_DYNAMICS } from './scenario.js?rev=split-pages-mobile-v23';

const scenarioSignalReady = (s) => s.scenarioId === 'weather'
  ? s.locomotiveSignalObserved
  : s.signalObserved && s.locomotiveSignalObserved;

const departureBrakesReady = (s) => !s.parkingBrake
  && s.autoBrake === 0
  && s.independentBrake === 0
  && s.brakeCyl < 15;

const preDepartureCommunicationReady = (s) => {
  const tailReady = s.tailPressureQueried || s.trainingMode === 'assessment';
  if (s.scenarioId === 'normal') return tailReady && s.radioContacted;
  if (s.scenarioId === 'weather') return tailReady && s.orderSigned;
  const firstContactReady = s.scenarioId === 'greenPermit' ? s.radioContacted : s.orderSigned;
  const unlockReady = !s.lkjUnlockRequired || s.lkjUnlockCorrect || (s.trainingMode === 'assessment' && s.lkjUnlockAttempted);
  return tailReady && firstContactReady && s.credentialAttempted && unlockReady;
};

const departureAuthorizationReady = (s) => s.departureNoticeReceived
  && (!s.handSignalRequired || s.handSignalConfirmed)
  && (s.trainingMode === 'assessment' || s.scenarioId === 'weather' || s.departureResponseCorrect);

export const PROCEDURE = [
  ['选择K2026次训练场景', s => s.scenarioSelected, 2],
  ['确认驾驶台设备初始位置', s => s.initialConfirmed || (s.trainingMode === 'assessment' && s.initialAttempted), 4, s => s.initialConfirmed],
  ['输入并核对LKJ参数和运行揭示', s => s.lkjConfirmed || (s.trainingMode === 'assessment' && s.lkjAttempted), 6, s => s.lkjConfirmed],
  ['升受电弓、闭合主断并建立总风', s => s.panto && s.netVoltage >= 22.5 && s.mainBreaker && s.compressor && s.mainRes >= 750, 5],
  ['简略制动机试验：减压并确认制动', s => s.brakeTested, 4],
  ['大闸回运转位并确认列车缓解', s => s.releaseObserved, 4],
  ['查询列尾风压并完成发车前首次联控', preDepartureCommunicationReady, 6],
  ['按场景确认地面信号和机车信号', scenarioSignalReady, 4],
  ['接听发车联控并确认发车手信号', departureAuthorizationReady, 4],
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

export const SMOOTH_PROCEDURE = [
  ['选择平道或上坡道起动场景', s => s.terrainSelected, 5],
  ['按场景建立起动保持条件并缓解停放制动', s => !s.parkingBrake, 10],
  ['按坡道要求建立初始牵引并缓解单阀', s => s.terrainMode === 'uphill'
    ? s.hillHoldReleasedCorrectly && s.independentBrake === 0
    : s.independentBrake === 0, 10],
  ['牵引手柄由零位推至规定低级位', s => s.lowNotchApplied, 15],
  ['保持低级位，等待牵引力向全列传递', s => s.lowNotchHeld, 15],
  ['确认全列12辆车辆依次起动', s => s.wholeTrainStarted, 15],
  ['左后或右后瞭望确认全列移动', s => s.rearLookCompleted, 10],
  ['全列起动后逐级增加牵引', s => s.progressiveTraction, 10],
  ['速度5～15 km/h时保持平稳加速', s => s.smoothStartQualified, 10],
];

export function getProcedure(state) {
  return state?.trainingScope === 'smooth-only' ? SMOOTH_PROCEDURE : PROCEDURE;
}

export function procedureState(state) {
  const procedure = getProcedure(state);
  const complete = procedure.map(([, test]) => Boolean(test(state)));
  const current = complete.findIndex((done) => !done);
  return { complete, current: current < 0 ? procedure.length - 1 : current, done: complete.every(Boolean) };
}
function preDepartureStepEarned(state) {
  const locked = new Set(state.assessmentCredentialLocks || []);
  const tailEarned = state.tailPressureQueried && !locked.has('tail');
  if (state.scenarioId === 'normal') return (tailEarned ? 3 : 0) + (state.radioResponseCorrect && !locked.has('credential') && !locked.has('signalReadyCall') ? 3 : 0);
  if (state.scenarioId === 'weather') return (tailEarned ? 3 : 0) + (state.orderSigned && !locked.has('credential') ? 3 : 0);
  const firstContactCorrect = state.scenarioId === 'greenPermit' ? state.radioResponseCorrect : state.orderSigned;
  const unlockCorrect = !state.lkjUnlockRequired || (
    state.lkjUnlockMethodCorrect && !state.lkjUnlockMethodErrorRecorded && !locked.has('method')
    && state.lkjUnlockFieldsCorrect && !state.lkjUnlockFieldsErrorRecorded && !locked.has('fields')
    && state.lkjUnlockCombinationCorrect && !state.lkjUnlockCombinationErrorRecorded && !locked.has('combination')
  );
  return (tailEarned ? 2 : 0)
    + (firstContactCorrect && state.credentialCorrect && !locked.has('credential') ? 2 : 0)
    + (unlockCorrect ? 2 : 0);
}

function departureAuthorizationStepEarned(state) {
  const locked = new Set(state.assessmentCredentialLocks || []);
  const responseCorrect = state.scenarioId === 'weather' ? state.weatherReportSent : state.departureResponseCorrect;
  return (state.departureNoticeReceived && responseCorrect && !locked.has('notice') && !locked.has('departureCall') ? 2 : 0)
    + ((!state.handSignalRequired || state.handSignalConfirmed) && !locked.has('handSignal') ? 2 : 0);
}

export function scoreRun(state) {
  const p = procedureState(state);
  const procedure = getProcedure(state);
  const scoreLocks = new Set(state.assessmentScoreLocks || []);
  const itemScores = procedure.map(([label, workflowTest, weight, scoreTest = workflowTest], index) => {
    if (state.trainingScope === 'smooth-only') {
      const earned = scoreTest(state) ? weight : 0;
      return { label, weight, complete: Boolean(workflowTest(state)), correct: earned === weight, earned, locked: false };
    }
    const rawEarned = index === 6
      ? preDepartureStepEarned(state)
      : index === 8
        ? departureAuthorizationStepEarned(state)
        : scoreTest(state) ? weight : 0;
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
    + (state.rollbackRisk ? 8 : 0)
    + (state.maxAcceleration > TRAIN_DYNAMICS.comfort.severeAcceleration ? 4 : 0)
    + (state.maxJerk > TRAIN_DYNAMICS.comfort.severeJerk ? 4 : 0));
  return { score: Math.max(0, Math.min(100, base - deductions)), completed: p.complete.filter(Boolean).length, deductions, itemScores };
}

