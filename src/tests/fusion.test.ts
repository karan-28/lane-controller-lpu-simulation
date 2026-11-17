import { describe, expect, it } from 'vitest';
import { ALL_CASES, CASE_GROUPS } from '../cases';
import { runCaseIsolated } from '../cases/runner';
import { DEMO_START_MS } from '../domain/clock';
import { DEFAULT_FUSION_CONFIG, comparePlates, normalisePlate } from '../domain/config';
import {
  createInitialEngineState,
  ingestRawEvent,
  setDeviceHealthState,
  stepEngine,
} from '../domain/fusion';
import type { RawEvent } from '../domain/types';
import { emitScriptEvents } from '../sim/devices';
import { registerTagCandidateInState } from '../sim/requestTag';

function makeRaw(partial: Partial<RawEvent> & Pick<RawEvent, 'event_id' | 'source' | 'device_ts' | 'lpu_ts'>): RawEvent {
  return {
    plaza_id: DEFAULT_FUSION_CONFIG.plazaId,
    gantry_id: DEFAULT_FUSION_CONFIG.gantryId,
    lane_id: 'L01',
    direction: 'NB',
    device_id: `L01-${partial.source}-01`,
    seq_no: 1,
    schema_ver: partial.source === 'LIDAR' ? 'VehicleEventV1/1.0' : '1.0',
    is_replay: false,
    ...partial,
  };
}

describe('Plate normalisation and edit distance', () => {
  it('normalises O/0, I/1, B/8 and spaces before comparison', () => {
    expect(normalisePlate('mh 12 ab 1234')).toBe('MH12A81234');
    const cmp = comparePlates('MH12OIB1234', 'MH120181234', DEFAULT_FUSION_CONFIG);
    expect(cmp.match).toBe('EXACT');
    expect(cmp.distance).toBe(0);
  });

  it('fuses edit distance 1 and rejects edit distance > 1', () => {
    const ed1 = comparePlates('MH12AB1234', 'MH12AB1235', DEFAULT_FUSION_CONFIG);
    expect(ed1.match).toBe('EDIT_1');
    const ed2 = comparePlates('MH12AB1234', 'MH12XY9234', DEFAULT_FUSION_CONFIG);
    expect(ed2.match).toBe('MISMATCH');
  });
});

describe('Fusion Engine core decision rules and boundaries', () => {
  it('handles window boundaries cleanly on demo clock', () => {
    const t0 = DEMO_START_MS;
    let state = createInitialEngineState(t0, DEFAULT_FUSION_CONFIG);
    registerTagCandidateInState(state.requestTag, 'MH12WB1001', [
      { tag_id: 'TAG-WB-1', plate: 'MH12WB1001', tag_class: 'VC4', status: 'VALID', issue_date: '2025-05-01' },
    ]);

    // Anchor LiDAR at t0 + 5000
    const anchorTs = t0 + 5000;
    state = ingestRawEvent(
      state,
      makeRaw({
        event_id: 'WB-LIDAR',
        source: 'LIDAR',
        device_ts: anchorTs,
        lpu_ts: anchorTs + 10,
        lidar: {
          vendor_event_id: 'AGNI-WB-1',
          vehicle_id: 'VEH-WB-1',
          vendor_class_id: 'AGNI_CAR_SUV',
          mapped_class: 'VC4',
          class_confidence: 0.95,
          speed_kmph: 60,
          axle_count: 2,
          dimensions: null,
          direction: 'FORWARD',
        },
      }),
      anchorTs + 10,
      DEFAULT_FUSION_CONFIG
    );

    // Front ANPR right on exact boundary (-2000 ms in Demo pacing)
    state = ingestRawEvent(
      state,
      makeRaw({
        event_id: 'WB-FANPR',
        source: 'FANPR',
        device_ts: anchorTs - 2000,
        lpu_ts: anchorTs + 20,
        anpr: {
          plate_text: 'MH12WB1001',
          plate_confidence: 0.96,
          vehicle_colour: 'White',
          plate_crop_placeholder: 'P',
          vehicle_image_placeholder: 'V',
        },
      }),
      anchorTs + 20,
      DEFAULT_FUSION_CONFIG
    );

    // Rear ANPR 1 ms outside (+6001 ms in Demo pacing) -> should NOT attach to passage
    state = ingestRawEvent(
      state,
      makeRaw({
        event_id: 'WB-RANPR-OUT',
        source: 'RANPR',
        device_ts: anchorTs + 6001,
        lpu_ts: anchorTs + 6020,
        anpr: {
          plate_text: 'MH12WB1001',
          plate_confidence: 0.96,
          vehicle_colour: 'White',
          plate_crop_placeholder: 'P',
          vehicle_image_placeholder: 'V',
        },
      }),
      anchorTs + 6020,
      DEFAULT_FUSION_CONFIG
    );

    // Advance past close (anchorTs + 8000) and pending expiry
    for (let now = anchorTs + 50; now <= anchorTs + 12000; now += 50) {
      state = stepEngine(state, now, DEFAULT_FUSION_CONFIG);
    }

    expect(state.transactions).toHaveLength(1);
    expect(state.transactions[0].front_plate).toBe('MH12WB1001');
    expect(state.transactions[0].rear_plate).toBeNull();
    expect(state.transactions[0].route).toBe('STT');
    expect(state.latePackets).toHaveLength(1);
  });

  it('flags class check when LiDAR class exceeds tag class while keeping STT at tag class', () => {
    const t0 = DEMO_START_MS;
    let state = createInitialEngineState(t0, DEFAULT_FUSION_CONFIG);
    registerTagCandidateInState(state.requestTag, 'MH12CC1111', [
      { tag_id: 'TAG-CC-1', plate: 'MH12CC1111', tag_class: 'VC4', status: 'VALID', issue_date: '2025-05-01' },
    ]);

    const emitted = emitScriptEvents(
      {
        script_id: 'CC-TEST',
        true_plate: 'MH12CC1111',
        true_tag_id: 'TAG-CC-1',
        true_class: 'VC7',
        speed_kmph: 55,
        lane_id: 'L01',
        events: [
          { source: 'FANPR', device_offset_ms: -200, lpu_offset_ms: -150, plate_confidence: 0.97 },
          { source: 'LIDAR', device_offset_ms: 0, lpu_offset_ms: 20, mapped_class: 'VC7' },
          { source: 'RFID', device_offset_ms: 60, lpu_offset_ms: 90, rssi: -52 },
          { source: 'RANPR', device_offset_ms: 800, lpu_offset_ms: 850, plate_confidence: 0.96 },
        ],
      },
      t0 + 1000,
      {},
      state.deviceHealth,
      DEFAULT_FUSION_CONFIG
    );

    const sorted = [...emitted.scheduled].sort((a, b) => a.deliverAtMs - b.deliverAtMs);
    for (let now = t0; now <= t0 + 11000; now += 50) {
      for (const s of sorted) {
        if (s.deliverAtMs <= now && !state.seenEventIds[s.event.event_id]) {
          state = ingestRawEvent(state, s.event, now, DEFAULT_FUSION_CONFIG);
        }
      }
      state = stepEngine(state, now, DEFAULT_FUSION_CONFIG);
    }

    expect(state.transactions).toHaveLength(1);
    const txn = state.transactions[0];
    expect(txn.route).toBe('STT');
    expect(txn.tag_class).toBe('VC4');
    expect(txn.lidar_class).toBe('VC7');
    expect(txn.flags).toContain('CLASS_CHECK');
  });

  it('enforces replay idempotency and ignores duplicate event_ids', () => {
    const t0 = DEMO_START_MS;
    let state = createInitialEngineState(t0, DEFAULT_FUSION_CONFIG);
    const ev = makeRaw({
      event_id: 'DUP-1',
      source: 'LIDAR',
      device_ts: t0 + 1000,
      lpu_ts: t0 + 1020,
      lidar: {
        vendor_event_id: 'AGNI-1',
        vehicle_id: 'V-1',
        vendor_class_id: 'AGNI_CAR_SUV',
        mapped_class: 'VC4',
        class_confidence: 0.95,
        speed_kmph: 60,
        axle_count: 2,
        dimensions: null,
        direction: 'FORWARD',
      },
    });
    state = ingestRawEvent(state, ev, t0 + 1020, DEFAULT_FUSION_CONFIG);
    state = ingestRawEvent(state, ev, t0 + 1050, DEFAULT_FUSION_CONFIG);
    expect(state.passages).toHaveLength(1);
    expect(state.duplicates).toHaveLength(1);

    const replayEv = { ...ev, event_id: 'DUP-1-RPL', is_replay: true };
    state = ingestRawEvent(state, replayEv, t0 + 1200, DEFAULT_FUSION_CONFIG);
    expect(state.rawEvents.some((e) => e.event_id === 'DUP-1-RPL' && e.is_replay)).toBe(true);
    expect(state.passages).toHaveLength(1);
  });

  it('continues degraded fusion with fallback anchor when LiDAR is down', () => {
    const t0 = DEMO_START_MS;
    let state = createInitialEngineState(t0, DEFAULT_FUSION_CONFIG);
    state = setDeviceHealthState(state, 'L01', 'LIDAR', 'DOWN', t0 + 100, 'Unit test LiDAR down');
    registerTagCandidateInState(state.requestTag, 'MH12LD2222', [
      { tag_id: 'TAG-LD-2', plate: 'MH12LD2222', tag_class: 'VC4', status: 'VALID', issue_date: '2025-05-01' },
    ]);

    const emitted = emitScriptEvents(
      {
        script_id: 'FALLBACK-TEST',
        true_plate: 'MH12LD2222',
        true_tag_id: 'TAG-LD-2',
        true_class: 'VC4',
        speed_kmph: 60,
        lane_id: 'L01',
        events: [
          { source: 'FANPR', device_offset_ms: -200, lpu_offset_ms: -150, plate_confidence: 0.97 },
          { source: 'LIDAR', device_offset_ms: 0, lpu_offset_ms: 20 },
          { source: 'RFID', device_offset_ms: 60, lpu_offset_ms: 90, rssi: -52 },
          { source: 'RANPR', device_offset_ms: 800, lpu_offset_ms: 850, plate_confidence: 0.96 },
        ],
      },
      t0 + 1000,
      {},
      state.deviceHealth,
      DEFAULT_FUSION_CONFIG
    );

    const sorted = [...emitted.scheduled].sort((a, b) => a.deliverAtMs - b.deliverAtMs);
    for (let now = t0; now <= t0 + 12000; now += 50) {
      for (const s of sorted) {
        if (s.deliverAtMs <= now && !state.seenEventIds[s.event.event_id]) {
          state = ingestRawEvent(state, s.event, now, DEFAULT_FUSION_CONFIG);
        }
      }
      state = stepEngine(state, now, DEFAULT_FUSION_CONFIG);
    }

    expect(state.transactions).toHaveLength(1);
    expect(state.transactions[0].is_fallback_anchor).toBe(true);
    expect(state.transactions[0].flags).toContain('FALLBACK_ANCHOR');
    expect(state.transactions[0].flags).toContain('DEGRADED_FUSION');
    expect(state.transactions[0].route).toBe('STT');
  });
});

describe('Case Library: all 38 cases across 8 groups', () => {
  it('contains exactly 38 cases in 8 groups', () => {
    expect(CASE_GROUPS).toHaveLength(8);
    expect(ALL_CASES).toHaveLength(38);
  });

  for (const c of ALL_CASES) {
    it(`${c.id}: ${c.name}`, () => {
      const { result } = runCaseIsolated(c, 'L01', DEFAULT_FUSION_CONFIG, `T${c.id}`);
      expect(result.details.join(' | ')).toBe('All expected assertions matched engine output.');
      expect(result.status).toBe('PASS');
    });
  }
});

describe('Guided Call Script end-to-end (1x and 5x) and Consistency Check', () => {
  it('executes the 8-step call script cleanly at 1x and 5x through the live store', async () => {
    const { useLpuStore } = await import('../store/useLpuStore');

    for (const speed of [1, 5] as const) {
      const store = useLpuStore.getState();
      store.resetDemo();
      store.setClockSpeed(speed);

      const advanceDemoMs = (ms: number) => {
        const realStep = 50;
        const demoPerStep = realStep * speed;
        const steps = Math.ceil(ms / demoPerStep);
        for (let i = 0; i < steps; i++) {
          useLpuStore.getState().tick(realStep);
        }
      };

      const finishLiveCase = () => {
        const end = Math.max(useLpuStore.getState().clock.nowMs, ...useLpuStore.getState().activeCases.map(c => c.endsAtMs));
        advanceDemoMs(end - useLpuStore.getState().clock.nowMs + 100);
      };
      // Step 1: Background traffic flowing across 4 lanes
      advanceDemoMs(18000);
      expect(useLpuStore.getState().engine.transactions.length).toBeGreaterThanOrEqual(1);

      // Step 2: Clean passage A1 on L02
      useLpuStore.getState().runLibraryCaseLive('A1', 'L02');
      finishLiveCase();
      expect(useLpuStore.getState().caseResults['A1']?.status).toBe('PASS');

      // Step 3: Tailgating pair D1 on L02
      useLpuStore.getState().runLibraryCaseLive('D1', 'L02');
      finishLiveCase();
      expect(useLpuStore.getState().caseResults['D1']?.status).toBe('PASS');

      // Step 4: Rear ANPR down on L02 -> vehicle -> recover
      useLpuStore.getState().setDeviceStateAction('L02', 'RANPR', 'DOWN', 'Call script step 4');
      useLpuStore.getState().sendSingleCleanVehicle('L02');
      advanceDemoMs(10500);
      const l02Last = useLpuStore
        .getState()
        .engine.transactions.filter((t) => t.lane_id === 'L02')
        .slice(-1)[0];
      expect(l02Last.flags).toContain('DEGRADED_FUSION');
      useLpuStore.getState().setDeviceStateAction('L02', 'RANPR', 'UP', 'Call script recover');

      // Step 5: Covered-plate B5 on L02
      useLpuStore.getState().runLibraryCaseLive('B5', 'L02');
      finishLiveCase();
      expect(useLpuStore.getState().caseResults['B5']?.status).toBe('PASS');

      // Step 6: Link down -> vehicle -> buffer climbs -> restore -> drains
      useLpuStore.getState().setLinkStatusAction('DOWN', 'Call script step 6');
      useLpuStore.getState().sendSingleCleanVehicle('L01');
      advanceDemoMs(10500);
      expect(useLpuStore.getState().engine.linkState.buffer_depth).toBeGreaterThanOrEqual(1);
      useLpuStore.getState().setLinkStatusAction('UP', 'Call script restore');
      advanceDemoMs(3000);
      expect(useLpuStore.getState().engine.linkState.buffer_depth).toBe(0);

      // Step 7: Case Library tour + D3 wrong-way
      useLpuStore.getState().runLibraryCaseLive('D3', 'L01');
      finishLiveCase();
      expect(useLpuStore.getState().caseResults['D3']?.status).toBe('PASS');

      // Step 8: Reset
      useLpuStore.getState().resetDemo();
      expect(useLpuStore.getState().engine.transactions).toHaveLength(0);
      expect(useLpuStore.getState().clock.nowMs).toBe(DEMO_START_MS);
    }
  });

  it('maintains store-wide consistency across feeds, passages, and outcomes for clean, no-rear, and mismatch', async () => {
    const { useLpuStore } = await import('../store/useLpuStore');
    const store = useLpuStore.getState();
    store.resetDemo();
    store.toggleBackgroundTraffic(); // isolate the 3 consistency check scripts

    const runAndAdvance = (caseId: string, ms: number) => {
      useLpuStore.getState().runLibraryCaseLive(caseId, 'L01');
      for (let i = 0; i < Math.ceil(ms / 50); i++) {
        useLpuStore.getState().tick(50);
      }
    };

    runAndAdvance('A1', 11500);
    runAndAdvance('A2', 11500);
    runAndAdvance('B2', 11500);

    const eng = useLpuStore.getState().engine;
    expect(eng.transactions).toHaveLength(3);
    const [tClean, tNoRear, tMismatch] = eng.transactions;

    expect(tClean.route).toBe('STT');
    expect(tClean.raw_event_ids).toHaveLength(4);

    // No rear read: missing RANPR everywhere, never invented
    expect(tNoRear.route).toBe('STT');
    expect(tNoRear.rear_plate).toBeNull();
    expect(tNoRear.missing_sources.some((m) => m.source === 'RANPR')).toBe(true);
    const pNoRear = eng.passages.find((p) => p.passage_id === tNoRear.passage_id)!;
    expect(pNoRear.attached_event_ids.RANPR).toHaveLength(0);

    // Front/rear mismatch: AUDIT_REQUIRED
    expect(tMismatch.route).toBe('AUDIT_REQUIRED');
    expect(tMismatch.front_plate).not.toBe(tMismatch.rear_plate);
  });
});
