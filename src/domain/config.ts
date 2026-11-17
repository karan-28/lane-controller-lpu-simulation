import type {
  DeviceSource,
  FusionConfig,
  LaneMetadata,
  VehicleClass,
  WindowPreset,
  WindowRule,
} from './types';

export type { FusionConfig, LaneMetadata, WindowPreset, WindowRule };

// Open design question: whether the lane controller or the auditor decides a one-character mismatch; this demo fuses it and says so.

export const DEFAULT_FUSION_CONFIG: FusionConfig = {
  plazaId: 'PLZ-NH48-01',
  gantryId: 'GNT-01',
  lanes: [
    { lane_id: 'L01', direction: 'NB', label: 'Lane 01 (Northbound)' },
    { lane_id: 'L02', direction: 'NB', label: 'Lane 02 (Northbound)' },
    { lane_id: 'L03', direction: 'SB', label: 'Lane 03 (Southbound)' },
    { lane_id: 'L04', direction: 'SB', label: 'Lane 04 (Southbound)' },
  ],
  activePresetId: 'demo_pacing',
  presets: {
    demo_pacing: {
      id: 'demo_pacing',
      name: 'Demo pacing',
      provisionalLabel: 'provisional - settled at site calibration',
      description: 'Widened windows (-2/+1 s front, +/-2 s RFID, 0/+6 s rear, 2 s grace) so events are readable on screen.',
      windows: {
        FANPR: { startMs: -2000, endMs: 1000 },
        RFID: { startMs: -2000, endMs: 2000 },
        RANPR: { startMs: 0, endMs: 6000 },
        LIDAR: { startMs: 0, endMs: 0 },
      },
      closeGraceMs: 2000,
      speedScaleRear: false,
      nominalSpeedKmph: 60,
    },
    design_doc: {
      id: 'design_doc',
      name: 'Baseline',
      provisionalLabel: 'provisional - settled at site calibration',
      description: 'Front -400/+300 ms, RFID +/-600 ms, Rear +200/+1,500 ms scaled by speed, close = longest window + 2 s grace.',
      windows: {
        FANPR: { startMs: -400, endMs: 300 },
        RFID: { startMs: -600, endMs: 600 },
        RANPR: { startMs: 200, endMs: 1500 },
        LIDAR: { startMs: 0, endMs: 0 },
      },
      closeGraceMs: 2000,
      speedScaleRear: true,
      nominalSpeedKmph: 60,
    },
  },
  plateNormalisation: {
    map: {
      O: '0',
      I: '1',
      B: '8',
    },
    maxEditDistance: 1,
    editDistancePenalty: 0.05,
    provisionalNote:
      'Provisional rule: normalise O/0, I/1, B/8 and spaces; edit distance 1 fuses with confidence penalty. Open design question whether LPU or back office decides.',
  },
  straightThroughConfidenceThreshold: 0.9,
  lowPlateConfidenceThreshold: 0.75,
  heartbeatIntervalMs: 10_000,
  heartbeatTimeoutMs: 30_000,
  driftWarningMs: 100,
  driftConfidencePenalty: 0.05,
  degradedConfidencePenalty: 0.02,
  duplicatePlateWindowMs: 600_000,
  requestTag: {
    cacheTtlMs: 600_000,
    timeoutMs: 1500,
    retryDelayMs: 200,
    normalLatencyRangeMs: [80, 140],
    multiTagPolicy: 'VALID_FIRST_ELSE_LATEST_ISSUE',
    multiTagRuleNote: 'Provisional: acquirer contract version determines multi-tag selection priority.',
  },
  rfidMultiTagPickPolicy: 'STRONGEST_RSSI',
  trafficMix: {
    cleanOrSimpleShare: 0.85,
    lowConfidenceShare: 0.05,
    lateRearShare: 0.05,
    crossLaneShare: 0.05,
    intervalNormalMs: [8000, 20000],
    intervalRushHourMs: [4000, 10000],
    classWeights: [
      { vehicleClass: 'VC4', weight: 68 },
      { vehicleClass: 'VC5', weight: 15 },
      { vehicleClass: 'VC7', weight: 10 },
      { vehicleClass: 'VC10', weight: 4 },
      { vehicleClass: 'VC12', weight: 3 },
    ],
  },
  vendorClassCrosswalk: {
    AGNI_CAR_SUV: 'VC4',
    AGNI_LCV_VAN: 'VC5',
    AGNI_BUS_TRUCK_2A: 'VC7',
    AGNI_TRUCK_3A: 'VC10',
    AGNI_MAV_4PLUS: 'VC12',
  },
  lidarAnchorNote:
    'Provisional: LiDAR VehicleEventV1 timestamp is treated as passage anchor (t=0); vendor-class crosswalk is provisional until site calibration.',
  presetDisagreementNote:
    'Demo pacing uses wider windows for visual demonstration, while Baseline contains tighter candidate timings. Both remain provisional and need site calibration.',
};

/**
 * Normalise plate text per provisional config:
 * uppercase, remove spaces/hyphens, map O->0, I->1, B->8.
 */
export function normalisePlate(plate: string, map: Record<string, string> = DEFAULT_FUSION_CONFIG.plateNormalisation.map): string {
  const cleaned = plate.toUpperCase().replace(/[\s-]+/g, '');
  let out = '';
  for (const ch of cleaned) {
    out += map[ch] ?? ch;
  }
  return out;
}

/** Standard Levenshtein edit distance on normalised plate strings */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      if (a[i - 1] === b[j - 1]) {
        dp[j] = prev;
      } else {
        dp[j] = 1 + Math.min(prev, dp[j], dp[j - 1]);
      }
      prev = temp;
    }
  }
  return dp[n];
}

export function getActivePreset(config: FusionConfig): WindowPreset {
  return config.presets[config.activePresetId] ?? config.presets.demo_pacing;
}

export function computePassageWindows(
  anchorTs: number,
  config: FusionConfig,
  speedKmph: number | null
): {
  windows: Record<DeviceSource, { start_ms: number; end_ms: number }>;
  closesAt: number;
} {
  const preset = getActivePreset(config);
  let rearEndOffset = preset.windows.RANPR.endMs;
  if (preset.speedScaleRear && speedKmph !== null && speedKmph > 0) {
    const clampedSpeed = Math.max(20, Math.min(120, speedKmph));
    const scale = preset.nominalSpeedKmph / clampedSpeed;
    rearEndOffset = Math.round(preset.windows.RANPR.endMs * scale);
  }

  const windows: Record<DeviceSource, { start_ms: number; end_ms: number }> = {
    FANPR: {
      start_ms: anchorTs + preset.windows.FANPR.startMs,
      end_ms: anchorTs + preset.windows.FANPR.endMs,
    },
    RFID: {
      start_ms: anchorTs + preset.windows.RFID.startMs,
      end_ms: anchorTs + preset.windows.RFID.endMs,
    },
    RANPR: {
      start_ms: anchorTs + preset.windows.RANPR.startMs,
      end_ms: anchorTs + rearEndOffset,
    },
    LIDAR: {
      start_ms: anchorTs + preset.windows.LIDAR.startMs,
      end_ms: anchorTs + preset.windows.LIDAR.endMs,
    },
  };

  const maxEnd = Math.max(
    windows.FANPR.end_ms,
    windows.RFID.end_ms,
    windows.RANPR.end_ms,
    windows.LIDAR.end_ms
  );

  return {
    windows,
    closesAt: maxEnd + preset.closeGraceMs,
  };
}

export function comparePlates(
  plateA: string,
  plateB: string,
  config: FusionConfig
): { match: 'EXACT' | 'EDIT_1' | 'MISMATCH'; distance: number; normA: string; normB: string } {
  const normA = normalisePlate(plateA, config.plateNormalisation.map);
  const normB = normalisePlate(plateB, config.plateNormalisation.map);
  const distance = levenshteinDistance(normA, normB);
  if (distance === 0) return { match: 'EXACT', distance, normA, normB };
  if (distance <= config.plateNormalisation.maxEditDistance) {
    return { match: 'EDIT_1', distance, normA, normB };
  }
  return { match: 'MISMATCH', distance, normA, normB };
}

export const VEHICLE_CLASS_ORDER: Record<VehicleClass, number> = {
  VC4: 1,
  VC5: 2,
  VC7: 3,
  VC10: 4,
  VC12: 5,
};
