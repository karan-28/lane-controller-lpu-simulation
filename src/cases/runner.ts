import { DEMO_START_MS } from '../domain/clock';
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
  FusionConfig,
  LaneId,
} from '../domain/types';
import { type EmitterSeqCounters, type ScheduledRawEvent, emitScriptEvents } from '../sim/devices';
import { cloneRequestTagState, registerTagCandidateInState } from '../sim/requestTag';

export interface CaseBaselineCounts {
  txnCount: number;
  orphanCount: number;
  lateCount: number;
  dupCount: number;
  rawCount: number;
  healthLogCounts: Record<string, number>;
}

export function captureBaselineCounts(state: FusionEngineState): CaseBaselineCounts {
  const healthLogCounts: Record<string, number> = {};
  for (const [k, dev] of Object.entries(state.deviceHealth)) {
    healthLogCounts[k] = dev.state_log.length;
  }
  return {
    txnCount: state.transactions.length,
    orphanCount: state.orphans.length,
    lateCount: state.latePackets.length,
    dupCount: state.duplicates.length,
    rawCount: state.rawEvents.length,
    healthLogCounts,
  };
}

export function evaluateCaseResult(
  caseDef: CaseDefinition,
  laneId: LaneId,
  baseline: CaseBaselineCounts,
  finalState: FusionEngineState,
  ranAt: number,
  liveScope?: { targetLanes: LaneId[]; excludedEventIds: Set<string> }
): CaseRunResult {
  const newTxns = finalState.transactions.slice(baseline.txnCount).filter((t) => {
    if (!liveScope) return true;
    if (!liveScope.targetLanes.includes(t.lane_id)) return false;
    return !t.raw_event_ids.some((id) => liveScope.excludedEventIds.has(id));
  });
  const newOrphans = finalState.orphans.slice(baseline.orphanCount).filter((o) => {
    if (!liveScope) return true;
    return (
      liveScope.targetLanes.includes(o.event.lane_id) &&
      !liveScope.excludedEventIds.has(o.event.event_id)
    );
  });
  const newLate = finalState.latePackets.slice(baseline.lateCount).filter((l) => {
    if (!liveScope) return true;
    return (
      liveScope.targetLanes.includes(l.event.lane_id) &&
      !liveScope.excludedEventIds.has(l.event.event_id)
    );
  });
  const newDups = finalState.duplicates.slice(baseline.dupCount).filter((d) => {
    if (!liveScope) return true;
    return liveScope.targetLanes.includes(d.lane_id);
  });
  const newRaw = finalState.rawEvents.slice(baseline.rawCount).filter((e) => {
    if (!liveScope) return true;
    return (
      liveScope.targetLanes.includes(e.lane_id) &&
      !liveScope.excludedEventIds.has(e.event_id)
    );
  });

  const failures: string[] = [];
  const exp = caseDef.expected;

  if (exp.exact_transactions !== undefined && newTxns.length !== exp.exact_transactions) {
    failures.push(`Expected ${exp.exact_transactions} txn(s), got ${newTxns.length}`);
  }
  if (exp.min_transactions !== undefined && newTxns.length < exp.min_transactions) {
    failures.push(`Expected >= ${exp.min_transactions} txn(s), got ${newTxns.length}`);
  }
  if (exp.route !== undefined) {
    if (newTxns.length === 0) {
      failures.push(`Expected route ${exp.route}, but 0 transactions were emitted`);
    } else if (newTxns[0].route !== exp.route) {
      failures.push(`Expected route ${exp.route}, got ${newTxns[0].route}`);
    }
  }
  if (exp.expected_routes !== undefined) {
    const actualRoutes = newTxns.map((t) => t.route);
    if (
      actualRoutes.length !== exp.expected_routes.length ||
      exp.expected_routes.some((r, idx) => actualRoutes[idx] !== r)
    ) {
      failures.push(
        `Expected routes [${exp.expected_routes.join(', ')}], got [${actualRoutes.join(', ')}]`
      );
    }
  }
  if (exp.required_flags) {
    const allFlags = new Set(newTxns.flatMap((t) => t.flags));
    for (const flag of exp.required_flags) {
      if (!allFlags.has(flag)) {
        failures.push(`Missing required flag ${flag}`);
      }
    }
  }
  if (exp.reason_includes) {
    const corpus = [
      ...newTxns.map((t) => t.audit_reason ?? ''),
      ...newTxns.flatMap((t) => t.decision_log),
      ...newOrphans.map((o) => o.reason),
      ...newLate.map((l) => l.reason),
    ]
      .join(' | ')
      .toLowerCase();
    for (const sub of exp.reason_includes) {
      if (!corpus.includes(sub.toLowerCase())) {
        failures.push(`Expected reason containing "${sub}"`);
      }
    }
  }
  if (exp.decision_log_includes) {
    const logCorpus = newTxns.flatMap((t) => t.decision_log).join(' | ').toLowerCase();
    for (const sub of exp.decision_log_includes) {
      if (!logCorpus.includes(sub.toLowerCase())) {
        failures.push(`Expected decision_log containing "${sub}"`);
      }
    }
  }
  if (exp.min_orphans !== undefined && newOrphans.length < exp.min_orphans) {
    failures.push(`Expected >= ${exp.min_orphans} orphan(s), got ${newOrphans.length}`);
  }
  if (exp.min_late_packets !== undefined && newLate.length < exp.min_late_packets) {
    failures.push(`Expected >= ${exp.min_late_packets} late packet(s), got ${newLate.length}`);
  }
  if (exp.min_duplicates !== undefined && newDups.length < exp.min_duplicates) {
    failures.push(`Expected >= ${exp.min_duplicates} duplicate(s), got ${newDups.length}`);
  }
  if (exp.expect_cache_hit_on_last) {
    const lastTxn = newTxns[newTxns.length - 1];
    if (!lastTxn?.request_tag_lookup?.cache_hit) {
      failures.push('Expected cache_hit=true on final transaction Request Tag lookup');
    }
  }
  if (exp.expect_buffer_depth_min !== undefined) {
    if (finalState.linkState.buffer_depth < exp.expect_buffer_depth_min) {
      failures.push(
        `Expected buffer_depth >= ${exp.expect_buffer_depth_min}, got ${finalState.linkState.buffer_depth}`
      );
    }
  }
  if (exp.expect_buffer_drained) {
    if (finalState.linkState.buffer_depth !== 0 || finalState.linkState.replay_in_progress) {
      failures.push(
        `Expected buffer drained (0), got depth=${finalState.linkState.buffer_depth}`
      );
    }
  }
  if (exp.expect_replayed_events) {
    if (!newRaw.some((e) => e.is_replay)) {
      failures.push('Expected replayed raw events (is_replay=true)');
    }
  }
  if (exp.expect_health_log_contains) {
    const newStates: string[] = [];
    for (const [k, dev] of Object.entries(finalState.deviceHealth)) {
      if (dev.lane_id !== laneId) continue;
      const prevLen = baseline.healthLogCounts[k] ?? 0;
      for (const entry of dev.state_log.slice(prevLen)) {
        newStates.push(entry.to);
      }
    }
    for (const expectedState of exp.expect_health_log_contains) {
      if (!newStates.includes(expectedState)) {
        failures.push(`Expected health state change to ${expectedState} in log`);
      }
    }
  }

  const parts: string[] = [];
  if (newTxns.length > 0) {
    const routes = newTxns.map((t) => t.route).join(', ');
    const flags = Array.from(new Set(newTxns.flatMap((t) => t.flags)));
    parts.push(`${newTxns.length} txn [${routes}]${flags.length ? ` (${flags.join(', ')})` : ''}`);
  }
  if (newOrphans.length > 0) parts.push(`${newOrphans.length} orphan(s)`);
  if (newLate.length > 0) parts.push(`${newLate.length} late`);
  if (newDups.length > 0) parts.push(`${newDups.length} dup(s)`);
  if (finalState.linkState.buffer_depth > 0) parts.push(`buf=${finalState.linkState.buffer_depth}`);
  if (newRaw.some((e) => e.is_replay)) parts.push('replayed');

  const actualSummary = parts.length > 0 ? parts.join(' · ') : 'No outputs emitted';

  return {
    case_id: caseDef.id,
    lane_id: laneId,
    status: failures.length === 0 ? 'PASS' : 'FAIL',
    expected_summary: caseDef.expected_summary,
    actual_summary: actualSummary,
    details: failures.length === 0 ? ['All expected assertions matched engine output.'] : failures,
    primary_txn_id: newTxns[0]?.txn_id ?? null,
    txn_ids: newTxns.map((t) => t.txn_id),
    orphan_ids: newOrphans.map((o) => o.id),
    late_ids: newLate.map((l) => l.id),
    ran_at: ranAt,
  };
}

export function applyCaseAction(
  state: FusionEngineState,
  action: CaseAction,
  laneId: LaneId,
  demoNowMs: number,
  seqCounters: EmitterSeqCounters,
  scheduledEvents: ScheduledRawEvent[],
  config: FusionConfig
): { state: FusionEngineState; seqCounters: EmitterSeqCounters } {
  switch (action.type) {
    case 'SET_DEVICE_STATE':
      return {
        state: setDeviceHealthState(
          state,
          action.lane_id ?? laneId,
          action.source,
          action.state,
          demoNowMs,
          action.reason
        ),
        seqCounters,
      };
    case 'SET_DEVICE_DRIFT':
      return {
        state: setDeviceDrift(state, action.lane_id ?? laneId, action.source, action.drift_ms),
        seqCounters,
      };
    case 'SET_REQUEST_TAG_OVERRIDE': {
      const nextRt = cloneRequestTagState(state.requestTag);
      nextRt.override = action.override;
      return {
        state: { ...state, requestTag: nextRt },
        seqCounters,
      };
    }
    case 'REGISTER_TAG': {
      const nextRt = cloneRequestTagState(state.requestTag);
      registerTagCandidateInState(nextRt, action.plate, action.candidates);
      return {
        state: { ...state, requestTag: nextRt },
        seqCounters,
      };
    }
    case 'SET_LINK_STATUS':
      return {
        state: setLinkStatus(state, action.status, demoNowMs, action.reason),
        seqCounters,
      };
    case 'VEHICLE_SCRIPT': {
      const emitted = emitScriptEvents(
        action.script,
        demoNowMs,
        seqCounters,
        state.deviceHealth,
        config
      );
      scheduledEvents.push(...emitted.scheduled);
      return { state, seqCounters: emitted.nextSeqCounters };
    }
    case 'REPLAY_BUFFERED_NOW':
      return { state, seqCounters };
  }
}

/**
 * Deterministic isolated execution of a single CaseDefinition against the real Fusion Engine.
 * Used by both Vitest unit tests and the Case Library "Run all" audit suite.
 */
export function runCaseIsolated(
  caseDef: CaseDefinition,
  laneId: LaneId = 'L01',
  config: FusionConfig = DEFAULT_FUSION_CONFIG,
  suffix = '001'
): { result: CaseRunResult; finalState: FusionEngineState } {
  // Cases are authored with Demo pacing windows; preserve caller config unless testing preset
  const t0 = DEMO_START_MS;
  let state = createInitialEngineState(t0, config);
  let seqCounters: EmitterSeqCounters = {};
  const baseline = captureBaselineCounts(state);

  const actions = caseDef
    .buildActions(laneId, suffix)
    .map((a, idx) => ({ action: a, dueAt: t0 + a.delay_ms, idx, done: false }));

  const scheduledEvents: ScheduledRawEvent[] = [];
  const endMs = t0 + caseDef.duration_ms + 1200;
  let lastHeartbeat = t0;

  for (let now = t0; now <= endMs; now += 50) {
    if (now - lastHeartbeat >= config.heartbeatIntervalMs) {
      state = recordDeviceHeartbeats(state, now);
      lastHeartbeat = now;
    }

    for (const item of actions) {
      if (!item.done && now >= item.dueAt) {
        item.done = true;
        const applied = applyCaseAction(
          state,
          item.action,
          laneId,
          now,
          seqCounters,
          scheduledEvents,
          config
        );
        state = applied.state;
        seqCounters = applied.seqCounters;
      }
    }

    // Deliver any scheduled raw events due at or before `now`
    const dueEvents = scheduledEvents
      .filter((s) => s.deliverAtMs <= now)
      .sort((a, b) => a.deliverAtMs - b.deliverAtMs);

    if (dueEvents.length > 0) {
      // Remove delivered
      for (let i = scheduledEvents.length - 1; i >= 0; i--) {
        if (scheduledEvents[i].deliverAtMs <= now) {
          scheduledEvents.splice(i, 1);
        }
      }
      for (const item of dueEvents) {
        state = ingestRawEvent(state, item.event, now, config);
      }
    }

    state = stepEngine(state, now, config);
  }

  const result = evaluateCaseResult(caseDef, laneId, baseline, state, endMs);
  return { result, finalState: state };
}
