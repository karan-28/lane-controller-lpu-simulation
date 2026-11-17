import {
  DEFAULT_FUSION_CONFIG,
  VEHICLE_CLASS_ORDER,
  comparePlates,
  computePassageWindows,
  getActivePreset,
  normalisePlate,
} from './config';
import { formatDemoTime } from './clock';
import type {
  BufferedItem,
  DeviceHealth,
  DeviceSource,
  DeviceState,
  DuplicateDeliveryRecord,
  FusedTransaction,
  FusionConfig,
  LaneId,
  LatePacket,
  LinkState,
  MissingSourceNote,
  OrphanEvent,
  Passage,
  RawEvent,
  RouteDecision,
  VehicleClass,
} from './types';
import {
  type RequestTagServiceState,
  cloneRequestTagState,
  createInitialRequestTagState,
  resolveRequestTagLookupStep,
  startRequestTagLookup,
} from '../sim/requestTag';

export interface PendingEventEntry {
  event: RawEvent;
  expiresAt: number;
}

export interface EngineCounters {
  passageSeq: number;
  txnSeq: number;
  orphanSeq: number;
  lateSeq: number;
  dupSeq: number;
  bufferSeq: number;
}

export interface FusionEngineState {
  rawEvents: RawEvent[];
  seenEventIds: Record<string, true>;
  pendingEvents: PendingEventEntry[];
  passages: Passage[];
  transactions: FusedTransaction[];
  orphans: OrphanEvent[];
  latePackets: LatePacket[];
  duplicates: DuplicateDeliveryRecord[];
  deviceHealth: Record<string, DeviceHealth>;
  linkState: LinkState;
  requestTag: RequestTagServiceState;
  recentPlates: Record<string, number[]>;
  counters: EngineCounters;
  nextReplayTickAt: number | null;
}

export const DEVICE_FIRMWARE: Record<DeviceSource, string> = {
  RFID: 'UHF-RDR-4.2.1',
  FANPR: 'CAM-ANPR-F-3.8.0',
  RANPR: 'CAM-ANPR-R-3.8.0',
  LIDAR: 'AGNI-VE1-1.0.4',
};

export function healthKey(laneId: LaneId, source: DeviceSource): string {
  return `${laneId}:${source}`;
}

export function deviceIdFor(laneId: LaneId, source: DeviceSource): string {
  const code =
    source === 'RFID'
      ? 'RFID-01'
      : source === 'FANPR'
        ? 'CAM-F1'
        : source === 'RANPR'
          ? 'CAM-R1'
          : 'LIDAR-01';
  return `${laneId}-${code}`;
}

export function createInitialEngineState(
  demoStartMs: number,
  config: FusionConfig = DEFAULT_FUSION_CONFIG
): FusionEngineState {
  const deviceHealth: Record<string, DeviceHealth> = {};
  const sources: DeviceSource[] = ['RFID', 'FANPR', 'RANPR', 'LIDAR'];

  for (const lane of config.lanes) {
    for (const source of sources) {
      deviceHealth[healthKey(lane.lane_id, source)] = {
        device_id: deviceIdFor(lane.lane_id, source),
        lane_id: lane.lane_id,
        source,
        state: 'UP',
        last_heartbeat_ts: demoStartMs,
        drift_ms: 0,
        firmware: DEVICE_FIRMWARE[source],
        state_log: [
          {
            ts: demoStartMs,
            from: 'UP',
            to: 'UP',
            reason: 'Initial device online at demo epoch',
          },
        ],
      };
    }
  }

  return {
    rawEvents: [],
    seenEventIds: {},
    pendingEvents: [],
    passages: [],
    transactions: [],
    orphans: [],
    latePackets: [],
    duplicates: [],
    deviceHealth,
    linkState: {
      status: 'UP',
      buffer_depth: 0,
      buffered_items: [],
      replay_in_progress: false,
      replay_total: 0,
      replay_completed: 0,
      history: [{ ts: demoStartMs, status: 'UP', reason: 'Plaza link initialized UP' }],
      buffer_history: [{ ts: demoStartMs, depth: 0 }],
    },
    requestTag: createInitialRequestTagState(),
    recentPlates: {},
    counters: {
      passageSeq: 0,
      txnSeq: 0,
      orphanSeq: 0,
      lateSeq: 0,
      dupSeq: 0,
      bufferSeq: 0,
    },
    nextReplayTickAt: null,
  };
}

function getPreAnchorWaitMs(config: FusionConfig): number {
  const preset = getActivePreset(config);
  const minStart = Math.min(
    preset.windows.FANPR.startMs,
    preset.windows.RFID.startMs,
    preset.windows.RANPR.startMs
  );
  return Math.max(2500, Math.abs(minStart) + 600);
}

function nominalSourceOffsetMs(source: DeviceSource): number {
  switch (source) {
    case 'FANPR':
      return -300;
    case 'RFID':
      return 0;
    case 'RANPR':
      return 900;
    case 'LIDAR':
      return 0;
  }
}

function triggerPassageRequestTag(
  passage: Passage,
  event: RawEvent,
  rtState: RequestTagServiceState,
  demoNowMs: number,
  config: FusionConfig,
  rawById?: Map<string, RawEvent>
): { passage: Passage; rtState: RequestTagServiceState } {
  const nextRt = cloneRequestTagState(rtState);

  if (event.source === 'RFID' && event.rfid?.tag_id) {
    let isStrongerThanQueried = false;
    if (
      passage.request_tag_lookup?.query_type === 'TAG_TO_PLATE' &&
      passage.request_tag_lookup.query_value !== event.rfid.tag_id &&
      rawById
    ) {
      const prevRfidMaxRssi = passage.attached_event_ids.RFID.reduce((max, id) => {
        if (id === event.event_id) return max;
        const r = rawById.get(id)?.rfid?.rssi ?? -999;
        return Math.max(max, r);
      }, -999);
      if (event.rfid.rssi > prevRfidMaxRssi) {
        isStrongerThanQueried = true;
      }
    }

    const shouldIssueTagLookup =
      passage.request_tag_lookup === null ||
      passage.request_tag_lookup.query_type === 'PLATE_TO_TAG' ||
      isStrongerThanQueried;

    if (shouldIssueTagLookup) {
      const { lookup, nextSeq } = startRequestTagLookup(
        nextRt,
        'TAG_TO_PLATE',
        event.rfid.tag_id,
        demoNowMs,
        config
      );
      nextRt.seq = nextSeq;
      return {
        passage: { ...passage, request_tag_lookup: lookup },
        rtState: nextRt,
      };
    }
  }

  if ((event.source === 'FANPR' || event.source === 'RANPR') && event.anpr?.plate_text) {
    if (passage.request_tag_lookup === null) {
      const { lookup, nextSeq } = startRequestTagLookup(
        nextRt,
        'PLATE_TO_TAG',
        event.anpr.plate_text,
        demoNowMs,
        config
      );
      nextRt.seq = nextSeq;
      return {
        passage: { ...passage, request_tag_lookup: lookup },
        rtState: nextRt,
      };
    }
  }

  return { passage, rtState: nextRt };
}

function findMatchingClosedPassageForLate(
  passages: Passage[],
  event: RawEvent
): Passage | null {
  // Look backwards for the most recent closed passage on this lane within 30s
  for (let i = passages.length - 1; i >= 0; i--) {
    const p = passages[i];
    if (p.lane_id !== event.lane_id || p.status !== 'CLOSED') continue;
    const closedAt = p.closed_at ?? p.closes_at;
    const withinArrivalLimit =
      event.lpu_ts >= closedAt - 5000 && event.lpu_ts <= closedAt + 35_000;
    const nearAnchor =
      event.device_ts >= p.anchor_ts - 5000 && event.device_ts <= p.anchor_ts + 30_000;
    const missingThisSource = p.attached_event_ids[event.source].length === 0;
    const arrivedAfterClose = event.lpu_ts > p.closes_at;
    const afterWindowEnd = event.device_ts > p.windows[event.source].end_ms;

    if (withinArrivalLimit && nearAnchor && missingThisSource && (arrivedAfterClose || afterWindowEnd)) {
      return p;
    }
  }
  return null;
}

function findMatchingOpenPassage(
  passages: Passage[],
  rawEventsById: Map<string, RawEvent>,
  event: RawEvent,
  config: FusionConfig
): Passage | null {
  const candidates = passages.filter((p) => {
    if (p.lane_id !== event.lane_id || p.status !== 'OPEN') return false;
    const bounds = p.windows[event.source];
    return event.device_ts >= bounds.start_ms && event.device_ts <= bounds.end_ms;
  });

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  // Multiple open passages on the same lane (e.g. Tailgating Case D1).
  // Score deterministically by:
  // 1) Does this passage already have a primary event of this source? (Strongly prefer empty slot)
  // 2) Identity consistency with already-attached events on the passage
  // 3) Temporal distance to expected offset from anchor
  const nominalOffset = nominalSourceOffsetMs(event.source);
  const scored = candidates.map((p) => {
    const alreadyHasSource = p.attached_event_ids[event.source].length > 0;
    let identityPenalty = 0;

    if (event.anpr?.plate_text) {
      const otherAnprIds = [
        ...p.attached_event_ids.FANPR,
        ...p.attached_event_ids.RANPR,
      ];
      for (const id of otherAnprIds) {
        const other = rawEventsById.get(id);
        if (other?.anpr?.plate_text) {
          const cmp = comparePlates(event.anpr.plate_text, other.anpr.plate_text, config);
          if (cmp.match === 'MISMATCH') {
            identityPenalty += 10_000;
          } else {
            identityPenalty -= 2_000;
          }
        }
      }
    }

    const timeDist = Math.abs(event.device_ts - (p.anchor_ts + nominalOffset));
    const slotPenalty = alreadyHasSource ? 50_000 : 0;
    return {
      passage: p,
      score: slotPenalty + identityPenalty + timeDist,
    };
  });

  scored.sort((a, b) => a.score - b.score);
  return scored[0].passage;
}

function createPassageFromAnchor(
  state: FusionEngineState,
  anchorEvent: RawEvent,
  isFallbackAnchor: boolean,
  demoNowMs: number,
  config: FusionConfig
): { passage: Passage; nextPassageSeq: number } {
  const nextPassageSeq = state.counters.passageSeq + 1;
  const passageId = `PSG-${anchorEvent.lane_id}-${String(nextPassageSeq).padStart(5, '0')}`;
  const speed = anchorEvent.lidar?.speed_kmph ?? null;
  const { windows, closesAt } = computePassageWindows(anchorEvent.device_ts, config, speed);

  const sources: DeviceSource[] = ['RFID', 'FANPR', 'RANPR', 'LIDAR'];
  const degradedSources: DeviceSource[] = [];
  const driftWarnings: string[] = [];

  for (const s of sources) {
    const h = state.deviceHealth[healthKey(anchorEvent.lane_id, s)];
    if (h && (h.state === 'DOWN' || h.state === 'DEGRADED')) {
      degradedSources.push(s);
    }
    if (h && Math.abs(h.drift_ms) > config.driftWarningMs) {
      driftWarnings.push(`${h.device_id} drift ${h.drift_ms} ms`);
    }
  }

  const passage: Passage = {
    passage_id: passageId,
    lane_id: anchorEvent.lane_id,
    status: 'OPEN',
    anchor_event_id: anchorEvent.event_id,
    anchor_source: anchorEvent.source,
    anchor_ts: anchorEvent.device_ts,
    is_fallback_anchor: isFallbackAnchor,
    opened_at: demoNowMs,
    closes_at: Math.max(closesAt, demoNowMs + 200),
    closed_at: null,
    windows,
    attached_event_ids: {
      RFID: anchorEvent.source === 'RFID' ? [anchorEvent.event_id] : [],
      FANPR: anchorEvent.source === 'FANPR' ? [anchorEvent.event_id] : [],
      RANPR: anchorEvent.source === 'RANPR' ? [anchorEvent.event_id] : [],
      LIDAR: anchorEvent.source === 'LIDAR' ? [anchorEvent.event_id] : [],
    },
    rejected_event_ids: [],
    request_tag_lookup: null,
    degraded_sources: degradedSources,
    drift_warnings: driftWarnings,
    colour_index: nextPassageSeq % 8,
  };

  return { passage, nextPassageSeq };
}

/**
 * Pure ingestion of one RawEvent into the Fusion Engine.
 * Never inspects case IDs or expected outcomes.
 */
export function ingestRawEvent(
  state: FusionEngineState,
  event: RawEvent,
  demoNowMs: number,
  config: FusionConfig = DEFAULT_FUSION_CONFIG
): FusionEngineState {
  // 1. Idempotency check on event_id
  if (state.seenEventIds[event.event_id]) {
    const nextDupSeq = state.counters.dupSeq + 1;
    const dupRecord: DuplicateDeliveryRecord = {
      id: `DUP-${String(nextDupSeq).padStart(5, '0')}`,
      event_id: event.event_id,
      source: event.source,
      lane_id: event.lane_id,
      received_at: demoNowMs,
      reason: `Duplicate delivery of event_id ${event.event_id}; ignored idempotently.`,
    };
    return {
      ...state,
      duplicates: [...state.duplicates, dupRecord],
      counters: { ...state.counters, dupSeq: nextDupSeq },
    };
  }

  const nextSeen = { ...state.seenEventIds, [event.event_id]: true as const };
  const nextRawEvents = [...state.rawEvents, event];

  // 2. Replayed events are stored and shown, never re-fused
  if (event.is_replay) {
    return {
      ...state,
      rawEvents: nextRawEvents,
      seenEventIds: nextSeen,
    };
  }

  // Build quick lookup map for existing raw events
  const rawById = new Map<string, RawEvent>();
  for (const r of nextRawEvents) {
    rawById.set(r.event_id, r);
  }

  const lidarHealth = state.deviceHealth[healthKey(event.lane_id, 'LIDAR')];
  const isLidarDown = lidarHealth?.state === 'DOWN';

  let nextPassages = [...state.passages];
  let nextPending = [...state.pendingEvents];
  let nextCounters = { ...state.counters };
  let nextRt = state.requestTag;
  const nextLate = [...state.latePackets];

  // Check device drift for warning tracking on attached passages
  const srcHealth = state.deviceHealth[healthKey(event.lane_id, event.source)];
  const driftNote =
    srcHealth && Math.abs(srcHealth.drift_ms) > config.driftWarningMs
      ? `${srcHealth.device_id} drift ${srcHealth.drift_ms} ms`
      : null;

  // 3. LiDAR event opens a new passage and sweeps pending events
  if (event.source === 'LIDAR') {
    const { passage: created, nextPassageSeq } = createPassageFromAnchor(
      state,
      event,
      false,
      demoNowMs,
      config
    );
    nextCounters.passageSeq = nextPassageSeq;
    let updatedPassage = created;

    const remainingPending: PendingEventEntry[] = [];
    for (const pEntry of nextPending) {
      if (pEntry.event.lane_id !== event.lane_id) {
        remainingPending.push(pEntry);
        continue;
      }
      const bounds = updatedPassage.windows[pEntry.event.source];
      if (pEntry.event.device_ts >= bounds.start_ms && pEntry.event.device_ts <= bounds.end_ms) {
        updatedPassage = {
          ...updatedPassage,
          attached_event_ids: {
            ...updatedPassage.attached_event_ids,
            [pEntry.event.source]: [
              ...updatedPassage.attached_event_ids[pEntry.event.source],
              pEntry.event.event_id,
            ],
          },
        };
        const rtRes = triggerPassageRequestTag(updatedPassage, pEntry.event, nextRt, demoNowMs, config, rawById);
        updatedPassage = rtRes.passage;
        nextRt = rtRes.rtState;
      } else {
        remainingPending.push(pEntry);
      }
    }

    nextPending = remainingPending;
    nextPassages.push(updatedPassage);

    return {
      ...state,
      rawEvents: nextRawEvents,
      seenEventIds: nextSeen,
      pendingEvents: nextPending,
      passages: nextPassages,
      counters: nextCounters,
      requestTag: nextRt,
    };
  }

  // 4. Non-LiDAR event: try attaching to an OPEN passage on this lane
  const targetOpen = findMatchingOpenPassage(nextPassages, rawById, event, config);
  if (targetOpen) {
    const updatedDrift =
      driftNote && !targetOpen.drift_warnings.includes(driftNote)
        ? [...targetOpen.drift_warnings, driftNote]
        : targetOpen.drift_warnings;

    let updatedPassage: Passage = {
      ...targetOpen,
      attached_event_ids: {
        ...targetOpen.attached_event_ids,
        [event.source]: [...targetOpen.attached_event_ids[event.source], event.event_id],
      },
      drift_warnings: updatedDrift,
    };

    const rtRes = triggerPassageRequestTag(updatedPassage, event, nextRt, demoNowMs, config, rawById);
    updatedPassage = rtRes.passage;
    nextRt = rtRes.rtState;

    nextPassages = nextPassages.map((p) =>
      p.passage_id === updatedPassage.passage_id ? updatedPassage : p
    );

    return {
      ...state,
      rawEvents: nextRawEvents,
      seenEventIds: nextSeen,
      passages: nextPassages,
      requestTag: nextRt,
    };
  }

  // 5. No OPEN passage matched. Check if it arrived late for a recently CLOSED passage
  const missedClosed = findMatchingClosedPassageForLate(nextPassages, event);
  if (missedClosed) {
    nextCounters.lateSeq += 1;
    const late: LatePacket = {
      id: `LATE-${String(nextCounters.lateSeq).padStart(5, '0')}`,
      event,
      missed_passage_id: missedClosed.passage_id,
      detected_at: demoNowMs,
      reason:
        event.lpu_ts > missedClosed.closes_at
          ? `${event.source} arrived at ${formatDemoTime(event.lpu_ts)} after passage ${missedClosed.passage_id} closed at ${formatDemoTime(missedClosed.closes_at)}.`
          : `${event.source} timestamp fell outside matching window for passage ${missedClosed.passage_id}.`,
    };
    nextLate.push(late);
    return {
      ...state,
      rawEvents: nextRawEvents,
      seenEventIds: nextSeen,
      latePackets: nextLate,
      counters: nextCounters,
    };
  }

  // 6. If LiDAR is DOWN, open a fallback-anchor passage immediately
  if (isLidarDown) {
    const { passage: created, nextPassageSeq } = createPassageFromAnchor(
      state,
      event,
      true,
      demoNowMs,
      config
    );
    nextCounters.passageSeq = nextPassageSeq;
    const rtRes = triggerPassageRequestTag(created, event, nextRt, demoNowMs, config);
    nextRt = rtRes.rtState;
    nextPassages.push(rtRes.passage);

    return {
      ...state,
      rawEvents: nextRawEvents,
      seenEventIds: nextSeen,
      passages: nextPassages,
      counters: nextCounters,
      requestTag: nextRt,
    };
  }

  // 7. LiDAR is UP/DEGRADED and no passage yet (event may be arriving ahead of LiDAR anchor).
  // Buffer briefly in pendingEvents until preAnchorWaitMs expires.
  const waitMs = getPreAnchorWaitMs(config);
  nextPending.push({
    event,
    expiresAt: Math.max(demoNowMs, event.device_ts) + waitMs,
  });

  return {
    ...state,
    rawEvents: nextRawEvents,
    seenEventIds: nextSeen,
    pendingEvents: nextPending,
  };
}

/**
 * Pure decision function for a closing passage.
 * Applies all provisional rules from config and emits a FusedTransaction.
 */
export function decidePassage(
  passage: Passage,
  state: FusionEngineState,
  demoNowMs: number,
  config: FusionConfig = DEFAULT_FUSION_CONFIG
): {
  transaction: FusedTransaction;
  updatedPassage: Passage;
  updatedRecentPlates: Record<string, number[]>;
  nextTxnSeq: number;
} {
  const rawById = new Map<string, RawEvent>();
  for (const r of state.rawEvents) {
    rawById.set(r.event_id, r);
  }

  const lidarEvents = passage.attached_event_ids.LIDAR.map((id) => rawById.get(id)!).filter(Boolean);
  const fanprEvents = passage.attached_event_ids.FANPR.map((id) => rawById.get(id)!).filter(Boolean);
  const ranprEvents = passage.attached_event_ids.RANPR.map((id) => rawById.get(id)!).filter(Boolean);
  const rfidEvents = passage.attached_event_ids.RFID.map((id) => rawById.get(id)!).filter(Boolean);

  const decisionLog: string[] = [];
  const flags: string[] = [];
  const missingSources: MissingSourceNote[] = [];
  const rejectedEventIds: string[] = [...passage.rejected_event_ids];

  // Record missing sources with real health reasons
  const allSources: DeviceSource[] = ['RFID', 'FANPR', 'RANPR', 'LIDAR'];
  for (const s of allSources) {
    if (passage.attached_event_ids[s].length === 0) {
      const h = state.deviceHealth[healthKey(passage.lane_id, s)];
      if (h && h.state === 'DOWN') {
        const lastDown = [...h.state_log].reverse().find((l) => l.to === 'DOWN');
        const sinceStr = lastDown ? formatDemoTime(lastDown.ts) : 'unknown time';
        missingSources.push({ source: s, reason: `${s} DOWN since ${sinceStr}` });
      } else {
        missingSources.push({ source: s, reason: `No ${s} read within matching window` });
      }
    }
  }

  // Fallback anchor / health degradation flags
  if (passage.is_fallback_anchor) {
    flags.push('FALLBACK_ANCHOR');
    flags.push('DEGRADED_FUSION');
    decisionLog.push(
      `LiDAR unavailable on ${passage.lane_id}; passage opened on fallback anchor (${passage.anchor_source}).`
    );
  } else if (passage.degraded_sources.length > 0) {
    flags.push('DEGRADED_FUSION');
    decisionLog.push(
      `Degraded device state during passage: ${passage.degraded_sources.join(', ')}.`
    );
  }

  // Drift check
  let confidencePenalty = 0;
  if (passage.drift_warnings.length > 0) {
    flags.push('CLOCK_DRIFT');
    confidencePenalty += config.driftConfidencePenalty;
    decisionLog.push(
      `Clock drift > ${config.driftWarningMs} ms detected (${passage.drift_warnings.join('; ')}); confidence lowered by ${config.driftConfidencePenalty.toFixed(2)}.`
    );
  }
  if (flags.includes('DEGRADED_FUSION')) {
    confidencePenalty += config.degradedConfidencePenalty;
  }

  // RFID selection (Strongest RSSI if multiple tags on windshield)
  let selectedRfid: RawEvent | null = null;
  if (rfidEvents.length === 1) {
    selectedRfid = rfidEvents[0];
  } else if (rfidEvents.length > 1) {
    const sortedRfid = [...rfidEvents].sort(
      (a, b) => (b.rfid?.rssi ?? -999) - (a.rfid?.rssi ?? -999)
    );
    selectedRfid = sortedRfid[0];
    for (const rej of sortedRfid.slice(1)) {
      rejectedEventIds.push(rej.event_id);
    }
    flags.push('MULTI_TAG_READ');
    decisionLog.push(
      `Multiple RFID reads in passage (${sortedRfid
        .map((e) => `${e.rfid?.tag_id} @ ${e.rfid?.rssi} dBm`)
        .join(', ')}); selected strongest RSSI: ${selectedRfid.rfid?.tag_id} (rejected read retained).`
    );
  }

  const lidarEvent = lidarEvents[0] ?? null;
  const fanprEvent = fanprEvents[0] ?? null;
  const ranprEvent = ranprEvents[0] ?? null;

  // Check ambiguous multiple non-RFID events in same source slot
  const hasAmbiguousEvidence = fanprEvents.length > 1 || ranprEvents.length > 1;

  const readerTagId = selectedRfid?.rfid?.tag_id ?? null;
  const frontPlate = fanprEvent?.anpr?.plate_text ?? null;
  const frontConf = fanprEvent?.anpr?.plate_confidence ?? null;
  const rearPlate = ranprEvent?.anpr?.plate_text ?? null;
  const rearConf = ranprEvent?.anpr?.plate_confidence ?? null;

  const rtLookup = passage.request_tag_lookup;
  const rtCandidate = rtLookup?.selected ?? null;
  if (rtLookup?.status === 'MULTI_TAG' && rtLookup.rejected_candidates.length > 0) {
    flags.push('MULTI_TAG_ON_PLATE');
    decisionLog.push(rtLookup.rule_note);
  }

  // Determine match mode label
  const presentSources: DeviceSource[] = [];
  if (selectedRfid) presentSources.push('RFID');
  if (fanprEvent) presentSources.push('FANPR');
  if (ranprEvent) presentSources.push('RANPR');
  if (lidarEvent) presentSources.push('LIDAR');
  const matchMode = presentSources.join('+');

  // Core decision evaluation
  let route: RouteDecision = 'AUDIT_REQUIRED';
  let auditReason: string | null = null;
  let baseConfidence = 0.6;
  let resolvedPlate: string | null = null;
  let tagId: string | null = readerTagId;
  let tagSource: 'READER' | 'REQUEST_TAG' | null = readerTagId ? 'READER' : null;
  let tagClass: VehicleClass | null = rtCandidate?.tag_class ?? null;
  const lidarClass: VehicleClass | null = lidarEvent?.lidar?.mapped_class ?? null;
  const speedKmph: number | null = lidarEvent?.lidar?.speed_kmph ?? null;

  // Check low-confidence ANPR reads
  const lowConfSources: string[] = [];
  if (frontConf !== null && frontConf < config.lowPlateConfidenceThreshold) {
    lowConfSources.push(`Front ANPR (${frontConf.toFixed(2)})`);
  }
  if (rearConf !== null && rearConf < config.lowPlateConfidenceThreshold) {
    lowConfSources.push(`Rear ANPR (${rearConf.toFixed(2)})`);
  }

  // Front/Rear comparison
  let frontRearCmp: ReturnType<typeof comparePlates> | null = null;
  if (frontPlate && rearPlate) {
    frontRearCmp = comparePlates(frontPlate, rearPlate, config);
    if (frontRearCmp.match === 'EDIT_1') {
      flags.push('EDIT_DISTANCE_1');
      confidencePenalty += config.plateNormalisation.editDistancePenalty;
      decisionLog.push(
        `Front (${frontPlate}) and rear (${rearPlate}) plates match with normalised edit distance 1; fused with confidence penalty -${config.plateNormalisation.editDistancePenalty.toFixed(2)} (provisional rule).`
      );
    }
  }

  // Determine route in order of definitive checks
  if (lidarEvent?.lidar?.direction === 'REVERSE') {
    route = 'AUDIT_REQUIRED';
    auditReason = 'Wrong-way vehicle detected by LiDAR direction flag.';
    flags.push('WRONG_WAY');
    baseConfidence = 0.5;
    resolvedPlate = frontPlate ?? rearPlate ?? rtCandidate?.plate ?? null;
    decisionLog.push(auditReason);
  } else if (hasAmbiguousEvidence) {
    route = 'AUDIT_REQUIRED';
    auditReason = 'Ambiguous multiple ANPR reads on same source slot inside passage.';
    baseConfidence = 0.55;
    resolvedPlate = frontPlate ?? rearPlate ?? null;
    decisionLog.push(auditReason);
  } else if (lowConfSources.length > 0) {
    route = 'AUDIT_REQUIRED';
    auditReason = `Low-confidence ANPR plate read below threshold (${config.lowPlateConfidenceThreshold.toFixed(2)}): ${lowConfSources.join(', ')}.`;
    flags.push('LOW_CONFIDENCE_ANPR');
    baseConfidence = Math.min(frontConf ?? 1, rearConf ?? 1);
    resolvedPlate = frontPlate ?? rearPlate ?? rtCandidate?.plate ?? null;
    decisionLog.push(auditReason);
  } else if (frontRearCmp && frontRearCmp.match === 'MISMATCH') {
    route = 'AUDIT_REQUIRED';
    auditReason = `Front (${frontPlate}) and rear (${rearPlate}) plates disagree beyond edit distance 1 (possible tailgating or misread).`;
    baseConfidence = 0.45;
    resolvedPlate = frontPlate;
    decisionLog.push(auditReason);
  } else if (selectedRfid && (frontPlate || rearPlate)) {
    // RFID + at least one ANPR read
    const anprRef = frontPlate ?? rearPlate!;
    if (rtLookup?.status === 'TIMEOUT') {
      route = 'AUDIT_REQUIRED';
      auditReason = 'Request Tag lookup timed out after 1 retry; cannot verify tag against plate.';
      baseConfidence = 0.65;
      resolvedPlate = anprRef;
      decisionLog.push(auditReason);
    } else if (rtLookup?.status === 'EMPTY' || !rtCandidate) {
      route = 'AUDIT_REQUIRED';
      auditReason = `RFID tag ${readerTagId} returned empty result in Request Tag (unknown tag).`;
      baseConfidence = 0.6;
      resolvedPlate = anprRef;
      decisionLog.push(auditReason);
    } else {
      const tagPlateCmp = comparePlates(rtCandidate.plate, anprRef, config);
      if (tagPlateCmp.match === 'MISMATCH') {
        route = 'AUDIT_REQUIRED';
        auditReason = `RFID tag ${readerTagId} is registered to ${rtCandidate.plate}, which does not match ANPR plate ${anprRef}.`;
        flags.push('TAG_PLATE_MISMATCH');
        baseConfidence = 0.4;
        resolvedPlate = anprRef;
        decisionLog.push(auditReason);
      } else {
        // RFID + ANPR agree!
        route = 'STT';
        resolvedPlate = frontPlate ?? rearPlate ?? rtCandidate.plate;
        tagClass = rtCandidate.tag_class;
        if (frontPlate && rearPlate) {
          baseConfidence = 0.99;
          decisionLog.push(
            `All three sources (RFID ${readerTagId}, front ANPR, rear ANPR) agree on ${resolvedPlate}${rtLookup?.cache_hit ? ' (Request Tag cache hit)' : ''}; routed straight-through.`
          );
        } else if (frontPlate) {
          baseConfidence = 0.96;
          decisionLog.push(
            `Two of three agree (RFID ${readerTagId} and front ANPR ${frontPlate}); routed straight-through.`
          );
        } else {
          baseConfidence = 0.96;
          decisionLog.push(
            `Two of three agree (RFID ${readerTagId} and rear ANPR ${rearPlate}); routed straight-through.`
          );
        }
      }
    }
  } else if (!selectedRfid && frontPlate && rearPlate) {
    // RFID missed, front and rear plates agree (since mismatch already handled above)
    resolvedPlate = frontPlate;
    if (rtLookup?.status === 'TIMEOUT') {
      route = 'AUDIT_REQUIRED';
      auditReason = 'RFID missed and Request Tag lookup timed out after 1 retry; cannot confirm tag.';
      baseConfidence = 0.68;
      decisionLog.push(auditReason);
    } else if (rtLookup?.status === 'EMPTY' || !rtCandidate) {
      route = 'AUDIT_REQUIRED';
      auditReason = `Front and rear plates agree (${frontPlate}), but no tag found in Request Tag.`;
      baseConfidence = 0.7;
      decisionLog.push(auditReason);
    } else {
      route = 'STT';
      tagId = rtCandidate.tag_id;
      tagSource = 'REQUEST_TAG';
      tagClass = rtCandidate.tag_class;
      baseConfidence = 0.96;
      decisionLog.push(
        `Front and rear plates agree (${frontPlate}); tag ${tagId} confirmed by Request Tag lookup${rtLookup?.cache_hit ? ' (cache hit)' : ''}.`
      );
    }
  } else if (selectedRfid && !frontPlate && !rearPlate) {
    // RFID only (e.g. covered/tampered plates)
    if (rtLookup?.status === 'TIMEOUT') {
      route = 'AUDIT_REQUIRED';
      auditReason = `RFID only (${readerTagId}) and Request Tag timed out after 1 retry.`;
      baseConfidence = 0.55;
      decisionLog.push(auditReason);
    } else if (rtLookup?.status === 'EMPTY' || !rtCandidate) {
      route = 'AUDIT_REQUIRED';
      auditReason = `RFID only (${readerTagId}) with no plate on record in Request Tag.`;
      baseConfidence = 0.55;
      decisionLog.push(auditReason);
    } else {
      route = 'STT';
      resolvedPlate = rtCandidate.plate;
      tagClass = rtCandidate.tag_class;
      baseConfidence = 0.93;
      flags.push('EVIDENCE_CHECK');
      decisionLog.push(
        `RFID only (no ANPR reads); plate ${resolvedPlate} resolved via Request Tag, routed straight-through and flagged evidence check.`
      );
    }
  } else if (!selectedRfid && (frontPlate || rearPlate)) {
    // Single ANPR only (no RFID, no other ANPR)
    const singlePlate = frontPlate ?? rearPlate!;
    resolvedPlate = singlePlate;
    if (rtLookup?.status === 'TIMEOUT') {
      route = 'AUDIT_REQUIRED';
      auditReason = `Single ANPR read (${singlePlate}); Request Tag timed out after 1 retry.`;
      baseConfidence = 0.6;
      decisionLog.push(auditReason);
    } else if (rtLookup?.status === 'EMPTY' || !rtCandidate) {
      route = 'AUDIT_REQUIRED';
      auditReason = `ANPR only (${singlePlate}) with no tag found in Request Tag; routed to audit.`;
      baseConfidence = 0.62;
      decisionLog.push(auditReason);
    } else {
      route = 'STT';
      tagId = rtCandidate.tag_id;
      tagSource = 'REQUEST_TAG';
      tagClass = rtCandidate.tag_class;
      baseConfidence = 0.93;
      decisionLog.push(
        `ANPR only (${singlePlate}); tag ${tagId} found by plate in Request Tag, routed straight-through.`
      );
    }
  } else {
    // LiDAR only with zero identity sources
    route = 'AUDIT_REQUIRED';
    auditReason =
      missingSources.some((m) => m.reason.includes('DOWN'))
        ? `Insufficient identity evidence due to dead device(s): ${missingSources
            .filter((m) => m.reason.includes('DOWN'))
            .map((m) => m.source)
            .join(', ')}.`
        : 'Vehicle detected by LiDAR with no RFID or ANPR identity reads.';
    baseConfidence = 0.3;
    decisionLog.push(auditReason);
  }

  // Class mismatch check (tag class vs LiDAR class)
  if (tagClass && lidarClass && tagClass !== lidarClass) {
    flags.push('CLASS_CHECK');
    if (VEHICLE_CLASS_ORDER[lidarClass] > VEHICLE_CLASS_ORDER[tagClass]) {
      decisionLog.push(
        `Class check: tag and LiDAR differ (tag ${tagClass}, LiDAR ${lidarClass}); routed at tag class (back-office scope).`
      );
    } else {
      decisionLog.push(
        `Class check: tag and LiDAR differ (tag ${tagClass}, LiDAR ${lidarClass}); routed at tag class.`
      );
    }
  }

  // 10-minute duplicate plate check
  const updatedRecentPlates = { ...state.recentPlates };
  if (resolvedPlate) {
    const norm = normalisePlate(resolvedPlate, config.plateNormalisation.map);
    const prevTimes = (updatedRecentPlates[norm] ?? []).filter(
      (t) => passage.anchor_ts - t <= config.duplicatePlateWindowMs && passage.anchor_ts >= t
    );
    if (prevTimes.length > 0) {
      flags.push('POSSIBLE_DUPLICATE');
      decisionLog.push(
        `Same plate (${resolvedPlate}) seen twice within 10 minutes; flagged as possible duplicate (dedup is back-office scope).`
      );
    }
    updatedRecentPlates[norm] = [...prevTimes, passage.anchor_ts];
  }

  const finalConfidence = Number(Math.max(0.05, Math.min(0.99, baseConfidence - confidencePenalty)).toFixed(2));
  if (route === 'STT' && finalConfidence < config.straightThroughConfidenceThreshold) {
    route = 'AUDIT_REQUIRED';
    auditReason = `Fused confidence (${finalConfidence.toFixed(2)}) fell below straight-through threshold (${config.straightThroughConfidenceThreshold.toFixed(2)}).`;
    decisionLog.push(auditReason);
  }

  const nextTxnSeq = state.counters.txnSeq + 1;
  const txnId = `TXN-${passage.lane_id}-${String(nextTxnSeq).padStart(5, '0')}`;

  const rawEventIds = [
    ...passage.attached_event_ids.LIDAR,
    ...passage.attached_event_ids.FANPR,
    ...passage.attached_event_ids.RFID,
    ...passage.attached_event_ids.RANPR,
  ];

  const transaction: FusedTransaction = {
    txn_id: txnId,
    passage_id: passage.passage_id,
    lane_id: passage.lane_id,
    passage_ts: passage.anchor_ts,
    anchor_ts: passage.anchor_ts,
    match_mode: matchMode,
    confidence: finalConfidence,
    route,
    audit_reason: auditReason,
    flags: Array.from(new Set(flags)),
    tag_id: tagId,
    tag_source: tagSource,
    front_plate: frontPlate,
    rear_plate: rearPlate,
    resolved_plate: resolvedPlate,
    tag_class: tagClass,
    lidar_class: lidarClass,
    speed_kmph: speedKmph,
    raw_event_ids: rawEventIds,
    rejected_event_ids: rejectedEventIds,
    evidence_placeholders: {
      front_plate_crop:
        fanprEvent?.anpr?.plate_crop_placeholder ?? 'NO FRONT PLATE CROP (PLACEHOLDER)',
      front_vehicle:
        fanprEvent?.anpr?.vehicle_image_placeholder ?? 'NO FRONT VEHICLE IMAGE (PLACEHOLDER)',
      rear_plate_crop:
        ranprEvent?.anpr?.plate_crop_placeholder ?? 'NO REAR PLATE CROP (PLACEHOLDER)',
      rear_vehicle:
        ranprEvent?.anpr?.vehicle_image_placeholder ?? 'NO REAR VEHICLE IMAGE (PLACEHOLDER)',
    },
    request_tag_lookup: rtLookup,
    decision_log: decisionLog,
    missing_sources: missingSources,
    is_fallback_anchor: passage.is_fallback_anchor,
    windows: passage.windows,
    colour_index: passage.colour_index,
    created_at: demoNowMs,
  };

  return {
    transaction,
    updatedPassage: {
      ...passage,
      status: 'CLOSED',
      closed_at: demoNowMs,
      rejected_event_ids: rejectedEventIds,
    },
    updatedRecentPlates,
    nextTxnSeq,
  };
}

/**
 * Pure clock tick of the Fusion Engine:
 * 1) Checks heartbeat timeouts -> DOWN
 * 2) Advances IN_FLIGHT Request Tag lookups
 * 3) Expires unmatched pending events into LatePacket or OrphanEvent
 * 4) Closes due passages (that aren't waiting on IN_FLIGHT Request Tag)
 * 5) Advances Link Replay queue if link is UP
 */
export function stepEngine(
  state: FusionEngineState,
  demoNowMs: number,
  config: FusionConfig = DEFAULT_FUSION_CONFIG
): FusionEngineState {
  let nextHealth = state.deviceHealth;
  let healthChanged = false;

  for (const [k, dev] of Object.entries(state.deviceHealth)) {
    if (
      dev.state !== 'DOWN' &&
      demoNowMs - dev.last_heartbeat_ts >= config.heartbeatTimeoutMs
    ) {
      if (!healthChanged) {
        nextHealth = { ...state.deviceHealth };
        healthChanged = true;
      }
      nextHealth[k] = {
        ...dev,
        state: 'DOWN',
        state_log: [
          ...dev.state_log,
          {
            ts: demoNowMs,
            from: dev.state,
            to: 'DOWN',
            reason: `Heartbeat silent for ${(config.heartbeatTimeoutMs / 1000).toFixed(0)}s`,
          },
        ],
      };
    }
  }

  let nextRt = cloneRequestTagState(state.requestTag);
  let nextPassages = state.passages.map((p) => {
    if (p.status !== 'OPEN' || !p.request_tag_lookup || p.request_tag_lookup.status !== 'IN_FLIGHT') {
      return p;
    }
    const res = resolveRequestTagLookupStep(nextRt, p.request_tag_lookup, demoNowMs, config);
    if (res.updatedCacheEntry) {
      nextRt.cache[res.updatedCacheEntry.key] = res.updatedCacheEntry.entry;
    }
    return {
      ...p,
      request_tag_lookup: res.lookup,
    };
  });

  // Close due passages first so pending expirations can check newly closed passages if needed
  let nextTransactions = [...state.transactions];
  let nextRecentPlates = { ...state.recentPlates };
  const nextCounters = { ...state.counters };
  let nextLink = state.linkState;
  const newlyClosedTransactions: FusedTransaction[] = [];

  nextPassages = nextPassages.map((p) => {
    if (p.status !== 'OPEN') return p;
    if (demoNowMs < p.closes_at) return p;
    if (p.request_tag_lookup?.status === 'IN_FLIGHT') return p;

    const decision = decidePassage(
      p,
      {
        ...state,
        deviceHealth: nextHealth,
        passages: nextPassages,
        recentPlates: nextRecentPlates,
        counters: nextCounters,
      },
      demoNowMs,
      config
    );
    nextCounters.txnSeq = decision.nextTxnSeq;
    nextTransactions = [...nextTransactions, decision.transaction];
    nextRecentPlates = decision.updatedRecentPlates;
    newlyClosedTransactions.push(decision.transaction);
    return decision.updatedPassage;
  });

  // Buffer newly closed transactions if plaza link is DOWN
  if (newlyClosedTransactions.length > 0 && nextLink.status === 'DOWN') {
    const rawById = new Map<string, RawEvent>();
    for (const r of state.rawEvents) rawById.set(r.event_id, r);

    const newBuffered: BufferedItem[] = [...nextLink.buffered_items];
    for (const txn of newlyClosedTransactions) {
      nextCounters.bufferSeq += 1;
      const txnEvents = txn.raw_event_ids
        .map((id) => rawById.get(id)!)
        .filter(Boolean);
      newBuffered.push({
        seq: nextCounters.bufferSeq,
        txn_id: txn.txn_id,
        lane_id: txn.lane_id,
        buffered_at: demoNowMs,
        raw_events: txnEvents,
      });
    }
    nextLink = {
      ...nextLink,
      buffer_depth: newBuffered.length,
      buffered_items: newBuffered,
      buffer_history: [
        ...nextLink.buffer_history.slice(-119),
        { ts: demoNowMs, depth: newBuffered.length },
      ],
    };
  }

  // Expire pending events
  const stillPending: PendingEventEntry[] = [];
  const nextOrphans = [...state.orphans];
  const nextLate = [...state.latePackets];

  for (const entry of state.pendingEvents) {
    if (demoNowMs < entry.expiresAt) {
      stillPending.push(entry);
      continue;
    }

    const missed = findMatchingClosedPassageForLate(nextPassages, entry.event);
    if (missed) {
      nextCounters.lateSeq += 1;
      nextLate.push({
        id: `LATE-${String(nextCounters.lateSeq).padStart(5, '0')}`,
        event: entry.event,
        missed_passage_id: missed.passage_id,
        detected_at: demoNowMs,
        reason: `${entry.event.source} event fell outside window / arrived after passage ${missed.passage_id} closed.`,
      });
    } else {
      nextCounters.orphanSeq += 1;
      const reason =
        entry.event.source === 'RFID'
          ? `RFID tag ${entry.event.rfid?.tag_id ?? ''} heard in ${entry.event.lane_id} with no vehicle anchor (possible cross-lane read).`
          : `${entry.event.source} plate ${entry.event.anpr?.plate_text ?? ''} had no matching LiDAR anchor in ${entry.event.lane_id} (no timestamp match).`;
      nextOrphans.push({
        id: `ORP-${String(nextCounters.orphanSeq).padStart(5, '0')}`,
        event: entry.event,
        detected_at: demoNowMs,
        reason,
      });
    }
  }

  // Advance plaza link replay if link is UP and items are buffered
  let nextRawEvents = state.rawEvents;
  let nextSeen = state.seenEventIds;
  let nextReplayTickAt = state.nextReplayTickAt;

  if (nextLink.status === 'UP' && nextLink.buffered_items.length > 0) {
    if (!nextLink.replay_in_progress) {
      nextLink = {
        ...nextLink,
        replay_in_progress: true,
        replay_total: nextLink.buffered_items.length,
        replay_completed: 0,
      };
      nextReplayTickAt = demoNowMs + 350;
    } else if (nextReplayTickAt !== null && demoNowMs >= nextReplayTickAt) {
      const [head, ...rest] = nextLink.buffered_items;
      const replayEvents: RawEvent[] = head.raw_events.map((ev) => ({
        ...ev,
        event_id: `${ev.event_id}-RPL-${head.seq}`,
        lpu_ts: demoNowMs,
        is_replay: true,
      }));
      const addedRaw: RawEvent[] = [];
      const addedSeen = { ...nextSeen };
      for (const rev of replayEvents) {
        if (!addedSeen[rev.event_id]) {
          addedSeen[rev.event_id] = true;
          addedRaw.push(rev);
        }
      }
      if (addedRaw.length > 0) {
        nextRawEvents = [...nextRawEvents, ...addedRaw];
        nextSeen = addedSeen;
      }

      const completed = nextLink.replay_completed + 1;
      const done = rest.length === 0;
      nextLink = {
        ...nextLink,
        buffered_items: rest,
        buffer_depth: rest.length,
        replay_completed: completed,
        replay_in_progress: !done,
        buffer_history: [
          ...nextLink.buffer_history.slice(-119),
          { ts: demoNowMs, depth: rest.length },
        ],
      };
      nextReplayTickAt = done ? null : demoNowMs + 350;
    }
  }

  return {
    ...state,
    rawEvents: nextRawEvents,
    seenEventIds: nextSeen,
    pendingEvents: stillPending,
    passages: nextPassages,
    transactions: nextTransactions,
    orphans: nextOrphans,
    latePackets: nextLate,
    deviceHealth: nextHealth,
    linkState: nextLink,
    requestTag: nextRt,
    recentPlates: nextRecentPlates,
    counters: nextCounters,
    nextReplayTickAt,
  };
}

export function setDeviceHealthState(
  state: FusionEngineState,
  laneId: LaneId,
  source: DeviceSource,
  targetState: DeviceState,
  demoNowMs: number,
  reason: string
): FusionEngineState {
  const k = healthKey(laneId, source);
  const existing = state.deviceHealth[k];
  if (!existing) return state;

  const updated: DeviceHealth = {
    ...existing,
    state: targetState,
    last_heartbeat_ts: targetState === 'DOWN' ? existing.last_heartbeat_ts : demoNowMs,
    state_log: [
      ...existing.state_log,
      {
        ts: demoNowMs,
        from: existing.state,
        to: targetState,
        reason,
      },
    ],
  };

  return {
    ...state,
    deviceHealth: {
      ...state.deviceHealth,
      [k]: updated,
    },
  };
}

export function setDeviceDrift(
  state: FusionEngineState,
  laneId: LaneId,
  source: DeviceSource,
  driftMs: number
): FusionEngineState {
  const k = healthKey(laneId, source);
  const existing = state.deviceHealth[k];
  if (!existing) return state;
  return {
    ...state,
    deviceHealth: {
      ...state.deviceHealth,
      [k]: {
        ...existing,
        drift_ms: driftMs,
      },
    },
  };
}

export function recordDeviceHeartbeats(
  state: FusionEngineState,
  demoNowMs: number
): FusionEngineState {
  let changed = false;
  const nextHealth = { ...state.deviceHealth };
  for (const [k, dev] of Object.entries(state.deviceHealth)) {
    if (dev.state === 'UP' || dev.state === 'DEGRADED') {
      nextHealth[k] = {
        ...dev,
        last_heartbeat_ts: demoNowMs,
      };
      changed = true;
    }
  }
  return changed ? { ...state, deviceHealth: nextHealth } : state;
}

export function setLinkStatus(
  state: FusionEngineState,
  status: 'UP' | 'DOWN',
  demoNowMs: number,
  reason: string
): FusionEngineState {
  if (state.linkState.status === status) return state;
  const hasBuffered = state.linkState.buffered_items.length > 0;
  return {
    ...state,
    linkState: {
      ...state.linkState,
      status,
      replay_in_progress: status === 'UP' && hasBuffered,
      replay_total: status === 'UP' && hasBuffered ? state.linkState.buffered_items.length : 0,
      replay_completed: 0,
      history: [...state.linkState.history, { ts: demoNowMs, status, reason }],
    },
    nextReplayTickAt: status === 'UP' && hasBuffered ? demoNowMs + 350 : null,
  };
}
