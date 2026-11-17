import { create } from 'zustand';
import {
  type CaseBaselineCounts,
  applyCaseAction,
  captureBaselineCounts,
  evaluateCaseResult,
  runCaseIsolated,
} from '../cases/runner';
import { ALL_CASES, getCaseById } from '../cases';
import { DEMO_START_MS, type DemoClockState, createInitialClock } from '../domain/clock';
import { DEFAULT_FUSION_CONFIG } from '../domain/config';
import {
  type FusionEngineState,
  createInitialEngineState,
  ingestRawEvent,
  recordDeviceHeartbeats,
  setDeviceDrift,
  setDeviceHealthState,
  setLinkStatus,
  stepEngine,
} from '../domain/fusion';
import type {
  CaseAction,
  CaseDefinition,
  CaseRunResult,
  ClockSpeed,
  DeviceSource,
  DeviceState,
  FusedTransaction,
  FusionConfig,
  LaneId,
  RawEvent,
  RequestTagOverride,
  WindowPresetId,
} from '../domain/types';
import { type EmitterSeqCounters, type ScheduledRawEvent, emitScriptEvents } from '../sim/devices';
import { cloneRequestTagState, registerTagCandidateInState } from '../sim/requestTag';
import { generateBackgroundVehicle } from '../sim/traffic';

interface ActiveCaseExecution {
  caseDef: CaseDefinition;
  laneId: LaneId;
  pausedLanes: LaneId[];
  startedAtMs: number;
  endsAtMs: number;
  baseline: CaseBaselineCounts;
  preExistingEventIds: Set<string>;
  actions: { action: CaseAction; dueAt: number; done: boolean }[];
}

export interface ToastMessage {
  id: string;
  text: string;
  createdAt: number;
}

export interface LpuStoreState {
  config: FusionConfig;
  clock: DemoClockState;
  engine: FusionEngineState;
  emitterSeq: EmitterSeqCounters;
  scheduledEvents: ScheduledRawEvent[];
  lastHeartbeatAtMs: number;

  // Background traffic state
  backgroundTrafficEnabled: boolean;
  rushHour: boolean;
  trafficSeed: number;
  trafficSeq: number;
  laneNextDueMs: Record<LaneId, number>;
  pausedTrafficLanes: Record<LaneId, boolean>;

  // Case runs
  activeCases: ActiveCaseExecution[];
  caseResults: Record<string, CaseRunResult>;
  runAllResults: CaseRunResult[];
  archivedCaseTxns: Record<string, { txn: FusedTransaction; events: RawEvent[] }>;
  caseRunSeq: number;

  // UI overlays & highlights
  demoPanelOpen: boolean;
  guidedModeOpen: boolean;
  guidedStepIndex: number;
  rulesDrawerOpen: boolean;
  highlightedIds: Record<string, number>; // id -> demoMs when highlight expires (or real-time fallback)
  toasts: ToastMessage[];

  // Actions
  tick: (realDeltaMs: number) => void;
  setClockSpeed: (speed: ClockSpeed) => void;
  toggleClockPause: () => void;
  setClockPaused: (paused: boolean) => void;
  setActivePreset: (presetId: WindowPresetId) => void;
  setDemoPanelOpen: (open: boolean) => void;
  setGuidedModeOpen: (open: boolean) => void;
  setGuidedStepIndex: (idx: number) => void;
  setRulesDrawerOpen: (open: boolean) => void;
  addToast: (text: string) => void;
  dismissToast: (id: string) => void;
  highlightId: (id: string) => void;

  // Control panel / simulator actions
  setDeviceStateAction: (laneId: LaneId, source: DeviceSource, state: DeviceState, reason?: string) => void;
  setDeviceDriftAction: (laneId: LaneId, source: DeviceSource, driftMs: number) => void;
  flapDeviceAction: (laneId: LaneId, source: DeviceSource) => void;
  setLinkStatusAction: (status: 'UP' | 'DOWN', reason?: string) => void;
  setRequestTagOverrideAction: (override: RequestTagOverride) => void;
  toggleRushHour: () => void;
  toggleBackgroundTraffic: () => void;
  sendSingleCleanVehicle: (laneId: LaneId) => void;

  // Case execution
  runLibraryCaseLive: (caseId: string, laneId: LaneId) => void;
  runAllCasesSuite: () => void;

  // Reset
  resetDemo: () => void;
}

function initialLaneDueTimes(startMs: number): Record<LaneId, number> {
  return {
    L01: startMs + 1200,
    L02: startMs + 2400,
    L03: startMs + 4200,
    L04: startMs + 6000,
  };
}

function createFreshStoreData(config: FusionConfig = DEFAULT_FUSION_CONFIG) {
  const clock = createInitialClock();
  const engine = createInitialEngineState(clock.nowMs, config);
  return {
    config,
    clock,
    engine,
    emitterSeq: {} as EmitterSeqCounters,
    scheduledEvents: [] as ScheduledRawEvent[],
    lastHeartbeatAtMs: clock.nowMs,
    backgroundTrafficEnabled: true,
    rushHour: false,
    trafficSeed: 104729,
    trafficSeq: 0,
    laneNextDueMs: initialLaneDueTimes(clock.nowMs),
    pausedTrafficLanes: { L01: false, L02: false, L03: false, L04: false },
    activeCases: [] as ActiveCaseExecution[],
    caseResults: {} as Record<string, CaseRunResult>,
    runAllResults: [] as CaseRunResult[],
    archivedCaseTxns: {} as Record<string, { txn: FusedTransaction; events: RawEvent[] }>,
    caseRunSeq: 0,
    highlightedIds: {} as Record<string, number>,
  };
}

let toastSeq = 0;

export const useLpuStore = create<LpuStoreState>((set, get) => ({
  ...createFreshStoreData(),
  demoPanelOpen: false,
  guidedModeOpen: false,
  guidedStepIndex: 0,
  rulesDrawerOpen: false,
  toasts: [],

  addToast: (text: string) => {
    toastSeq += 1;
    const id = `TST-${toastSeq}`;
    const createdAt = get().clock.nowMs;
    set((s) => ({
      toasts: [...s.toasts.slice(-4), { id, text, createdAt }],
    }));
  },

  dismissToast: (id: string) => {
    set((s) => ({
      toasts: s.toasts.filter((t) => t.id !== id),
    }));
  },

  highlightId: (id: string) => {
    const expires = typeof performance !== 'undefined' ? performance.now() + 3000 : 3000;
    set((s) => ({
      highlightedIds: { ...s.highlightedIds, [id]: expires },
    }));
  },

  setClockSpeed: (speed) => {
    set((s) => ({ clock: { ...s.clock, speed } }));
    get().addToast(`Demo clock speed set to ${speed}x.`);
  },

  toggleClockPause: () => {
    const nextPaused = !get().clock.paused;
    set((s) => ({ clock: { ...s.clock, paused: nextPaused } }));
    get().addToast(nextPaused ? 'Demo clock paused.' : 'Demo clock resumed.');
  },

  setClockPaused: (paused) => {
    set((s) => ({ clock: { ...s.clock, paused } }));
  },

  setActivePreset: (presetId) => {
    const presets = get().config.presets;
    const resolvedId: WindowPresetId = presets[presetId] ? presetId : 'demo_pacing';
    const presetName = presets[resolvedId].name;
    set((s) => ({
      config: { ...s.config, activePresetId: resolvedId },
    }));
    get().addToast(`Window preset switched to "${presetName}" (provisional).`);
  },

  setDemoPanelOpen: (open) => set({ demoPanelOpen: open }),
  setGuidedModeOpen: (open) => set({ guidedModeOpen: open }),
  setGuidedStepIndex: (idx) => set({ guidedStepIndex: idx }),
  setRulesDrawerOpen: (open) => set({ rulesDrawerOpen: open }),

  setDeviceStateAction: (laneId, source, targetState, reason) => {
    const now = get().clock.nowMs;
    const msg = reason ?? `Operator changed ${laneId} ${source} to ${targetState}`;
    set((s) => ({
      engine: setDeviceHealthState(s.engine, laneId, source, targetState, now, msg),
    }));
    get().addToast(`${laneId} ${source} set to ${targetState}.`);
  },

  setDeviceDriftAction: (laneId, source, driftMs) => {
    set((s) => ({
      engine: setDeviceDrift(s.engine, laneId, source, driftMs),
    }));
    get().addToast(`${laneId} ${source} clock drift set to ${driftMs} ms.`);
  },

  flapDeviceAction: (laneId, source) => {
    const now = get().clock.nowMs;
    const current = get().engine.deviceHealth[`${laneId}:${source}`]?.state ?? 'UP';
    const next: DeviceState = current === 'DOWN' ? 'UP' : 'DOWN';
    set((s) => ({
      engine: setDeviceHealthState(
        s.engine,
        laneId,
        source,
        next,
        now,
        `Simulated flap (${current} -> ${next})`
      ),
    }));
    get().addToast(`${laneId} ${source} flapped ${current} -> ${next}.`);
  },

  setLinkStatusAction: (status, reason) => {
    const now = get().clock.nowMs;
    const msg = reason ?? `Simulated plaza link set ${status}`;
    set((s) => ({
      engine: setLinkStatus(s.engine, status, now, msg),
    }));
    get().addToast(
      status === 'DOWN'
        ? 'Plaza link dropped (DOWN). Lanes continue fusing into local buffer.'
        : 'Plaza link restored (UP). Buffered items replaying in sequence.'
    );
  },

  setRequestTagOverrideAction: (override) => {
    set((s) => {
      const nextRt = cloneRequestTagState(s.engine.requestTag);
      nextRt.override = override;
      return {
        engine: { ...s.engine, requestTag: nextRt },
      };
    });
    get().addToast(`Simulated Request Tag behaviour set to "${override}".`);
  },

  toggleRushHour: () => {
    const next = !get().rushHour;
    set({ rushHour: next });
    get().addToast(next ? 'Rush hour enabled (~2x traffic cadence).' : 'Rush hour disabled (normal cadence).');
  },

  toggleBackgroundTraffic: () => {
    const next = !get().backgroundTrafficEnabled;
    set({ backgroundTrafficEnabled: next });
    get().addToast(next ? 'Background traffic resumed.' : 'Background traffic paused.');
  },

  sendSingleCleanVehicle: (laneId) => {
    const s = get();
    const nextSeq = s.trafficSeq + 1;
    const plan = generateBackgroundVehicle(
      laneId,
      s.clock.nowMs,
      nextSeq,
      s.trafficSeed,
      s.rushHour,
      s.config
    );
    const nextRt = cloneRequestTagState(s.engine.requestTag);
    registerTagCandidateInState(nextRt, plan.tagCandidate.plate, [plan.tagCandidate]);

    const emitted = emitScriptEvents(
      plan.script,
      s.clock.nowMs + 400,
      s.emitterSeq,
      s.engine.deviceHealth,
      s.config
    );

    set({
      trafficSeq: nextSeq,
      trafficSeed: plan.nextSeed,
      emitterSeq: emitted.nextSeqCounters,
      scheduledEvents: [...s.scheduledEvents, ...emitted.scheduled],
      engine: { ...s.engine, requestTag: nextRt },
    });
    get().addToast(`Dispatched vehicle ${plan.script.true_plate} on ${laneId}.`);
  },

  runLibraryCaseLive: (caseId, laneId) => {
    const caseDef = getCaseById(caseId);
    if (!caseDef) return;

    const s = get();
    const now = s.clock.nowMs;
    const nextRunSeq = s.caseRunSeq + 1;
    const sfx = String(100 + (nextRunSeq % 899));
    const actions = caseDef.buildActions(laneId, sfx).map((a) => ({
      action: a,
      dueAt: now + a.delay_ms,
      done: false,
    }));

    const pausedLanes: LaneId[] = [laneId];
    if (caseId === 'D2') {
      const adj: LaneId =
        laneId === 'L01' ? 'L02' : laneId === 'L02' ? 'L01' : laneId === 'L03' ? 'L04' : 'L03';
      pausedLanes.push(adj);
    }

    // Recovery has gantry-wide buffer assertions. Pause fresh dispatch on all lanes
    // during H2 so unrelated arrivals cannot refill its completion condition.
    if (caseId === 'H2') for (const lane of s.config.lanes) {
      if (!pausedLanes.includes(lane.lane_id)) pausedLanes.push(lane.lane_id);
    }
    const nextPaused = { ...s.pausedTrafficLanes };
    for (const l of pausedLanes) nextPaused[l] = true;

    // Pause new background dispatch now, but let already emitted vehicles finish.
    // Otherwise their pre-anchor/front reads can attach to a library passage.
    const occupiedUntil = Math.max(now,
      ...s.engine.passages.filter(p => pausedLanes.includes(p.lane_id) && p.status === 'OPEN').map(p => p.closes_at + 1000),
      ...s.scheduledEvents.filter(e => pausedLanes.includes(e.event.lane_id)).map(e => e.deliverAtMs + 10000),
      ...s.engine.pendingEvents.filter(e => pausedLanes.includes(e.event.lane_id)).map(e => e.event.lpu_ts + 15000)
    );
    const startAt = occupiedUntil > now ? occupiedUntil + 1000 : now;
    for (const item of actions) item.dueAt += startAt - now;

    const preExistingEventIds = new Set<string>([
      ...s.engine.rawEvents.map((e) => e.event_id),
      ...s.scheduledEvents.map((se) => se.event.event_id),
    ]);

    const exec: ActiveCaseExecution = {
      caseDef,
      laneId,
      pausedLanes,
      startedAtMs: startAt,
      endsAtMs: startAt + caseDef.duration_ms + (caseId === 'H2' ? (s.engine.linkState.buffer_depth + 8) * 400 : 0),
      baseline: captureBaselineCounts(s.engine),
      preExistingEventIds,
      actions,
    };

    set({
      caseRunSeq: nextRunSeq,
      pausedTrafficLanes: nextPaused,
      activeCases: [...s.activeCases, exec],
      clock: { ...s.clock, paused: false },
    });

    get().addToast(startAt > now
      ? `Case ${caseDef.id} queued on ${laneId}: draining in-flight traffic for ${Math.ceil((startAt - now) / 1000)} demo seconds, then live playback.`
      : `Running case ${caseDef.id} (${caseDef.name}) on ${laneId}.`);
  },

  runAllCasesSuite: () => {
    const results: CaseRunResult[] = [];
    const archived: Record<string, { txn: FusedTransaction; events: RawEvent[] }> = {};
    const now = get().clock.nowMs;
    const suiteId = `SUITE-${get().caseRunSeq + 1}`;
    // Run every case in order on L01 against the real fusion engine (with Demo pacing windows)
    const evalConfig: FusionConfig = {
      ...get().config,
      activePresetId: 'demo_pacing',
    };

    ALL_CASES.forEach((caseDef, idx) => {
      const sfx = String(200 + idx);
      const { result, finalState } = runCaseIsolated(caseDef, 'L01', evalConfig, sfx);
      // Isolated engines restart their transaction counter. Namespace every archived
      // transaction to its suite and case, so links cannot select live or other-case data.
      const archiveId = (id: string) => `${suiteId}-${caseDef.id}-${id}`;
      const taggedResult: CaseRunResult = {
        ...result,
        primary_txn_id: result.primary_txn_id ? archiveId(result.primary_txn_id) : null,
        txn_ids: result.txn_ids.map(archiveId),
        ran_at: now,
      };
      results.push(taggedResult);

      for (const txn of finalState.transactions) {
        const ids = new Set([...txn.raw_event_ids, ...txn.rejected_event_ids]);
        const events = finalState.rawEvents.filter((e) => ids.has(e.event_id));
        const archivedTxn = { ...txn, txn_id: archiveId(txn.txn_id) };
        archived[archivedTxn.txn_id] = { txn: archivedTxn, events };
      }
    });

    const passCount = results.filter((r) => r.status === 'PASS').length;
    set((s) => ({
      caseRunSeq: s.caseRunSeq + 1,
      runAllResults: results,
      archivedCaseTxns: { ...s.archivedCaseTxns, ...archived },
      caseResults: results.reduce(
        (acc, r) => {
          acc[r.case_id] = r;
          return acc;
        },
        { ...s.caseResults }
      ),
    }));
    get().addToast(`Run all complete on L01: ${passCount}/${results.length} PASS.`);
  },

  resetDemo: () => {
    const fresh = createFreshStoreData(DEFAULT_FUSION_CONFIG);
    set((s) => ({
      ...fresh,
      demoPanelOpen: s.demoPanelOpen,
      guidedModeOpen: s.guidedModeOpen,
      guidedStepIndex: 0,
      rulesDrawerOpen: false,
    }));
    get().addToast('Demo reset to 17 Nov 2026 09:00:00 IST (all devices UP, link UP, buffer empty).');
  },

  tick: (realDeltaMs: number) => {
    const s = get();
    if (s.clock.paused) return;

    const totalDemoDelta = Math.min(realDeltaMs, 250) * s.clock.speed;
    if (totalDemoDelta <= 0) return;

    // Step in sub-increments <= 50ms so 5x and 20x preserve window/timeout accuracy
    const stepSize = 50;
    let remaining = totalDemoDelta;
    let nowMs = s.clock.nowMs;
    let engine = s.engine;
    let emitterSeq = s.emitterSeq;
    let scheduled = [...s.scheduledEvents];
    let lastHb = s.lastHeartbeatAtMs;
    let trafficSeed = s.trafficSeed;
    let trafficSeq = s.trafficSeq;
    const laneNextDue = { ...s.laneNextDueMs };
    const pausedTraffic = { ...s.pausedTrafficLanes };
    let activeCases = s.activeCases.map((c) => ({ ...c, actions: c.actions.map((a) => ({ ...a })) }));
    const caseResults = { ...s.caseResults };
    const highlighted = { ...s.highlightedIds };

    while (remaining > 0) {
      const dt = Math.min(stepSize, remaining);
      remaining -= dt;
      nowMs += dt;

      // 1. Heartbeat emission every 10s of demo time
      if (nowMs - lastHb >= s.config.heartbeatIntervalMs) {
        engine = recordDeviceHeartbeats(engine, nowMs);
        lastHb = nowMs;
      }

      // 2. Background traffic per lane (unless paused globally or by a case run)
      if (s.backgroundTrafficEnabled) {
        for (const lane of s.config.lanes) {
          const lid = lane.lane_id;
          if (pausedTraffic[lid]) continue;
          if (nowMs >= laneNextDue[lid]) {
            trafficSeq += 1;
            const plan = generateBackgroundVehicle(
              lid,
              nowMs,
              trafficSeq,
              trafficSeed,
              s.rushHour,
              s.config
            );
            trafficSeed = plan.nextSeed;
            laneNextDue[lid] = plan.nextLaneDueMs;

            const nextRt = cloneRequestTagState(engine.requestTag);
            registerTagCandidateInState(nextRt, plan.tagCandidate.plate, [plan.tagCandidate]);
            engine = { ...engine, requestTag: nextRt };

            const emitted = emitScriptEvents(
              plan.script,
              nowMs + 400,
              emitterSeq,
              engine.deviceHealth,
              s.config
            );
            emitterSeq = emitted.nextSeqCounters;
            scheduled.push(...emitted.scheduled);
          }
        }
      }

      // 3. Active live case actions
      for (const ac of activeCases) {
        for (const item of ac.actions) {
          if (!item.done && nowMs >= item.dueAt) {
            item.done = true;
            const res = applyCaseAction(
              engine,
              item.action,
              ac.laneId,
              nowMs,
              emitterSeq,
              scheduled,
              s.config
            );
            engine = res.state;
            emitterSeq = res.seqCounters;
          }
        }
      }

      // 4. Deliver due raw events sorted by lpu_ts
      const due = scheduled
        .filter((ev) => ev.deliverAtMs <= nowMs)
        .sort((a, b) => a.deliverAtMs - b.deliverAtMs);

      if (due.length > 0) {
        scheduled = scheduled.filter((ev) => ev.deliverAtMs > nowMs);
        for (const item of due) {
          engine = ingestRawEvent(engine, item.event, nowMs, s.config);
        }
      }

      // 5. Step fusion engine
      const prevTxnCount = engine.transactions.length;
      const prevOrphanCount = engine.orphans.length;
      const prevLateCount = engine.latePackets.length;
      engine = stepEngine(engine, nowMs, s.config);

      // Highlight newly emitted rows when active cases ran
      const perfNow = typeof performance !== 'undefined' ? performance.now() : 0;
      if (activeCases.length > 0) {
        for (const txn of engine.transactions.slice(prevTxnCount)) {
          highlighted[txn.txn_id] = perfNow + 3000;
        }
        for (const orp of engine.orphans.slice(prevOrphanCount)) {
          highlighted[orp.id] = perfNow + 3000;
        }
        for (const lt of engine.latePackets.slice(prevLateCount)) {
          highlighted[lt.id] = perfNow + 3000;
        }
      }

      // 6. Complete finished active cases
      const stillActive: ActiveCaseExecution[] = [];
      for (const ac of activeCases) {
        if (nowMs >= ac.endsAtMs) {
          const result = evaluateCaseResult(ac.caseDef, ac.laneId, ac.baseline, engine, nowMs, {
            targetLanes: ac.pausedLanes,
            excludedEventIds: ac.preExistingEventIds,
          });
          caseResults[ac.caseDef.id] = result;
          for (const l of ac.pausedLanes) {
            pausedTraffic[l] = false;
            laneNextDue[l] = Math.max(laneNextDue[l], nowMs + 2500);
          }
        } else {
          stillActive.push(ac);
        }
      }
      activeCases = stillActive;
    }

    // Prune expired highlights
    const perfPrune = typeof performance !== 'undefined' ? performance.now() : 0;
    for (const [id, exp] of Object.entries(highlighted)) {
      if (perfPrune > exp) delete highlighted[id];
    }

    set({
      clock: { ...s.clock, nowMs },
      engine,
      emitterSeq,
      scheduledEvents: scheduled,
      lastHeartbeatAtMs: lastHb,
      trafficSeed,
      trafficSeq,
      laneNextDueMs: laneNextDue,
      pausedTrafficLanes: pausedTraffic,
      activeCases,
      caseResults,
      highlightedIds: highlighted,
    });
  },
}));
