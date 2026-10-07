import { TRAIN_DYNAMICS } from './scenario.js?rev=start-scoring-v25';

const scenarioSignalReady = (s) => s.scenarioId === 'weather'
  ? s.locomotiveSignalObserved
  : s.signalObserved && s.locomotiveSignalObserved;

const parkingBrakeReleased = (s) => !s.parkingBrake;
const assessmentOr = (s, attempted, correct) => s.trainingMode === 'assessment' ? attempted : correct;
const baselineCorrect = (s) => s.tailBaselinePressure != null;
const baselineReady = (s) => assessmentOr(s, s.tailBaselineQueryAttempted, baselineCorrect(s));
const releaseRiseCorrect = (s) => s.autoBrakeReleaseAttempted
  && s.tailReleaseQueryAttempted
  && s.tailPressureRiseCorrect;
const releaseRiseReady = (s) => assessmentOr(s, s.autoBrakeReleaseAttempted && s.tailReleaseQueryAttempted, releaseRiseCorrect(s));
const notchOneCorrect = (s) => s.singleValveNotchSynchronized
  && s.notchOneHoldCorrect
  && s.tractionCurrentRising;
const notchOneReady = (s) => assessmentOr(s, s.notchOneHoldAttempted, notchOneCorrect(s));
const notchTwoRearCorrect = (s) => s.notchTwoSequenceCorrect && s.wholeTrainStarted && s.rearLookCompleted;
const notchTwoRearReady = (s) => assessmentOr(s, s.notchTwoApplied && s.rearLookCompleted, notchTwoRearCorrect(s));
const progressiveCorrect = (s) => s.progressiveToFourCorrect && s.smoothStartQualified;
const progressiveReady = (s) => assessmentOr(s, s.notchFourApplied, progressiveCorrect(s));
const lkjStartReady = (s) => assessmentOr(s, s.lkjStartAttempted, s.lkjStartCorrect);

const preDepartureCommunicationReady = (s) => {
  if (s.scenarioId === 'normal') return s.radioContacted;
  if (s.scenarioId === 'weather') return s.orderSigned;
  const firstContactReady = s.scenarioId === 'greenPermit' ? s.radioContacted : s.orderSigned;
  const unlockReady = !s.lkjUnlockRequired || s.lkjUnlockCorrect || (s.trainingMode === 'assessment' && s.lkjUnlockAttempted);
  return firstContactReady && s.credentialAttempted && unlockReady;
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
  ['完成发车前联控、凭证及LKJ非正常确认', preDepartureCommunicationReady, 6],
  ['按场景确认地面信号和机车信号', scenarioSignalReady, 4],
  ['接听发车联控并确认发车手信号', departureAuthorizationReady, 4],
  ['开启前照灯并鸣笛', s => s.headlight && s.horn, 3],
  ['方向手柄置前进位', s => s.direction === 'F', 3],
  ['缓解停放制动', parkingBrakeReleased, 5],
  ['制动保压状态首次查询并确认尾部风压', baselineReady, 5, baselineCorrect],
  ['缓解自阀，再次查询确认尾部风压上升高于20 kPa', releaseRiseReady, 9, releaseRiseCorrect],
  ['2秒内完成单阀缓解与1.0级，保持1～2秒确认电流上升', notchOneReady, 9, notchOneCorrect],
  ['置2.0级，待全列起动并完成后部瞭望', notchTwoRearReady, 10, notchTwoRearCorrect],
  ['全列起动后按2.0→3.0→4.0级平稳加速', progressiveReady, 7, progressiveCorrect],
  ['到出站信号机位置按压LKJ开车／7键', lkjStartReady, 5, s => s.lkjStartCorrect],
  ['越过出站信号机后稳定运行300 m', s => s.completed, 5],
];

export const SMOOTH_LEVEL_PROCEDURE = [
  ['选择平道或上坡道起动场景', s => s.terrainSelected, 5],
  ['缓解停放制动', parkingBrakeReleased, 5],
  ['制动保压状态首次查询并确认尾部风压', baselineReady, 10, baselineCorrect],
  ['缓解自阀，再次查询确认尾部风压上升高于20 kPa', releaseRiseReady, 20, releaseRiseCorrect],
  ['2秒内完成单阀缓解与1.0级，保持1～2秒确认电流上升', notchOneReady, 15, notchOneCorrect],
  ['置2.0级，待全列起动并完成后部瞭望', notchTwoRearReady, 20, notchTwoRearCorrect],
  ['全列起动后按2.0→3.0→4.0级平稳加速', progressiveReady, 15, progressiveCorrect],
  ['到出站信号机位置按压LKJ开车／7键', lkjStartReady, 10, s => s.lkjStartCorrect],
];

export const SMOOTH_UPHILL_PROCEDURE = [
  ['选择平道或上坡道起动场景', s => s.terrainSelected, 5],
  ['缓解停放制动', parkingBrakeReleased, 5],
  ['制动保压状态首次查询并确认尾部风压', baselineReady, 10, baselineCorrect],
  ['2秒内完成单阀缓解与不高于1.0级，保持1～2秒确认电流上升', notchOneReady, 15, notchOneCorrect],
  ['缓解自阀，再次查询确认尾部风压上升高于20 kPa', releaseRiseReady, 20, releaseRiseCorrect],
  ['置2.0级，待全列起动并完成后部瞭望', notchTwoRearReady, 20, notchTwoRearCorrect],
  ['全列起动后按2.0→3.0→4.0级平稳加速', progressiveReady, 15, progressiveCorrect],
  ['到出站信号机位置按压LKJ开车／7键', lkjStartReady, 10, s => s.lkjStartCorrect],
];

export const SMOOTH_PROCEDURE = SMOOTH_LEVEL_PROCEDURE;

export function getProcedure(state) {
  if (state?.trainingScope !== 'smooth-only') return PROCEDURE;
  return state.terrainMode === 'uphill' ? SMOOTH_UPHILL_PROCEDURE : SMOOTH_LEVEL_PROCEDURE;
}

export function procedureState(state) {
  const procedure = getProcedure(state);
  const complete = procedure.map(([, test]) => Boolean(test(state)));
  const current = complete.findIndex((done) => !done);
  return { complete, current: current < 0 ? procedure.length - 1 : current, done: complete.every(Boolean) };
}
function preDepartureStepEarned(state) {
  const locked = new Set(state.assessmentCredentialLocks || []);
  if (state.scenarioId === 'normal') return state.radioResponseCorrect && !locked.has('credential') && !locked.has('signalReadyCall') ? 6 : 0;
  if (state.scenarioId === 'weather') return state.orderSigned && !locked.has('credential') ? 6 : 0;
  const firstContactCorrect = state.scenarioId === 'greenPermit' ? state.radioResponseCorrect : state.orderSigned;
  const unlockCorrect = !state.lkjUnlockRequired || (
    state.lkjUnlockMethodCorrect && !state.lkjUnlockMethodErrorRecorded && !locked.has('method')
    && state.lkjUnlockFieldsCorrect && !state.lkjUnlockFieldsErrorRecorded && !locked.has('fields')
    && state.lkjUnlockCombinationCorrect && !state.lkjUnlockCombinationErrorRecorded && !locked.has('combination')
  );
  return (firstContactCorrect && state.credentialCorrect && !locked.has('credential') ? 3 : 0)
    + (unlockCorrect ? 3 : 0);
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
    const rawEarned = state.trainingScope !== 'smooth-only' && index === 6
      ? preDepartureStepEarned(state)
      : state.trainingScope !== 'smooth-only' && index === 8
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
    + (state.tractionDelayExceeded ? 5 : 0)
    + (state.maxAcceleration > TRAIN_DYNAMICS.comfort.severeAcceleration ? 4 : 0)
    + (state.maxJerk > TRAIN_DYNAMICS.comfort.severeJerk ? 4 : 0));
  return { score: Math.max(0, Math.min(100, base - deductions)), completed: p.complete.filter(Boolean).length, deductions, itemScores };
}

