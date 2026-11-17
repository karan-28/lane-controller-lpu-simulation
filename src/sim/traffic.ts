import { DEFAULT_FUSION_CONFIG } from '../domain/config';
import type { FusionConfig, LaneId, VehicleClass, VehicleScript } from '../domain/types';
import type { RequestTagCandidate } from '../domain/types';

const STATE_CODES = ['MH', 'DL', 'KA', 'GJ', 'TN', 'HR', 'UP', 'RJ', 'TS', 'KL'];
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

/** Deterministic PRNG (Mulberry32) so background traffic is reproducible if desired */
export function nextRand(seed: number): { value: number; nextSeed: number } {
  let t = (seed + 0x6d2b79f5) | 0;
  let r = Math.imul(t ^ (t >>> 15), 1 | t);
  r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
  return {
    value: ((r ^ (r >>> 14)) >>> 0) / 4294967296,
    nextSeed: (seed + 1) | 0,
  };
}

export function generateIndianPlate(seed: number): { plate: string; nextSeed: number } {
  let s = seed;
  const r1 = nextRand(s);
  s = r1.nextSeed;
  const state = STATE_CODES[Math.floor(r1.value * STATE_CODES.length)];

  const r2 = nextRand(s);
  s = r2.nextSeed;
  const rto = String(1 + Math.floor(r2.value * 48)).padStart(2, '0');

  const r3 = nextRand(s);
  s = r3.nextSeed;
  const c1 = LETTERS[Math.floor(r3.value * LETTERS.length)];

  const r4 = nextRand(s);
  s = r4.nextSeed;
  const c2 = LETTERS[Math.floor(r4.value * LETTERS.length)];

  const r5 = nextRand(s);
  s = r5.nextSeed;
  const num = String(1000 + Math.floor(r5.value * 8999));

  return {
    plate: `${state}${rto}${c1}${c2}${num}`,
    nextSeed: s,
  };
}

function pickWeightedClass(seed: number, config: FusionConfig): { vehicleClass: VehicleClass; nextSeed: number } {
  const weights = config.trafficMix.classWeights;
  const total = weights.reduce((acc, w) => acc + w.weight, 0);
  const r = nextRand(seed);
  let target = r.value * total;
  for (const w of weights) {
    target -= w.weight;
    if (target <= 0) {
      return { vehicleClass: w.vehicleClass, nextSeed: r.nextSeed };
    }
  }
  return { vehicleClass: 'VC4', nextSeed: r.nextSeed };
}

export interface BackgroundTrafficPlan {
  script: VehicleScript;
  tagCandidate: RequestTagCandidate;
  nextLaneDueMs: number;
  nextSeed: number;
}

export function generateBackgroundVehicle(
  laneId: LaneId,
  demoNowMs: number,
  seqNum: number,
  seed: number,
  rushHour: boolean,
  config: FusionConfig = DEFAULT_FUSION_CONFIG
): BackgroundTrafficPlan {
  let s = seed;
  const pRes = generateIndianPlate(s);
  s = pRes.nextSeed;
  const plate = pRes.plate;

  const cRes = pickWeightedClass(s, config);
  s = cRes.nextSeed;
  const vClass = cRes.vehicleClass;

  const spdR = nextRand(s);
  s = spdR.nextSeed;
  const speed = Math.round(48 + spdR.value * 36);

  const tagId = `TAG-BG-${laneId}-${String(seqNum).padStart(5, '0')}`;
  const tagCandidate: RequestTagCandidate = {
    tag_id: tagId,
    plate,
    tag_class: vClass,
    status: 'VALID',
    issue_date: '2025-08-14',
  };

  const mixR = nextRand(s);
  s = mixR.nextSeed;
  const roll = mixR.value;

  const events: VehicleScript['events'] = [];

  if (roll < config.trafficMix.cleanOrSimpleShare) {
    // 85% clean or simple two-of-three
    const subR = nextRand(s);
    s = subR.nextSeed;
    events.push({ source: 'LIDAR', device_offset_ms: 0, lpu_offset_ms: 20 });
    events.push({ source: 'FANPR', device_offset_ms: -320, lpu_offset_ms: -280, plate_confidence: 0.96 });
    if (subR.value < 0.72) {
      // Full 4-source clean
      events.push({ source: 'RFID', device_offset_ms: 80, lpu_offset_ms: 110, rssi: -54 });
      events.push({ source: 'RANPR', device_offset_ms: 850, lpu_offset_ms: 910, plate_confidence: 0.95 });
    } else if (subR.value < 0.86) {
      // Two of three: no rear read
      events.push({ source: 'RFID', device_offset_ms: 80, lpu_offset_ms: 110, rssi: -57 });
    } else {
      // Two of three: tag missed, front + rear agree
      events.push({ source: 'RANPR', device_offset_ms: 850, lpu_offset_ms: 910, plate_confidence: 0.95 });
    }
  } else if (roll < config.trafficMix.cleanOrSimpleShare + config.trafficMix.lowConfidenceShare) {
    // Low-confidence ANPR read
    events.push({ source: 'LIDAR', device_offset_ms: 0, lpu_offset_ms: 20 });
    events.push({ source: 'FANPR', device_offset_ms: -300, lpu_offset_ms: -260, plate_confidence: 0.64 });
    events.push({ source: 'RFID', device_offset_ms: 90, lpu_offset_ms: 120, rssi: -58 });
    events.push({ source: 'RANPR', device_offset_ms: 860, lpu_offset_ms: 920, plate_confidence: 0.94 });
  } else if (
    roll <
    config.trafficMix.cleanOrSimpleShare +
      config.trafficMix.lowConfidenceShare +
      config.trafficMix.lateRearShare
  ) {
    // Late rear event (arrives after passage closes in demo pacing)
    events.push({ source: 'LIDAR', device_offset_ms: 0, lpu_offset_ms: 20 });
    events.push({ source: 'FANPR', device_offset_ms: -300, lpu_offset_ms: -260, plate_confidence: 0.96 });
    events.push({ source: 'RFID', device_offset_ms: 80, lpu_offset_ms: 110, rssi: -55 });
    events.push({ source: 'RANPR', device_offset_ms: 8600, lpu_offset_ms: 8680, plate_confidence: 0.93 });
  } else {
    // Rare cross-lane tag read only (orphan)
    events.push({
      source: 'RFID',
      device_offset_ms: 0,
      lpu_offset_ms: 30,
      rssi: -82,
      antenna_no: 2,
    });
  }

  const intR = nextRand(s);
  s = intR.nextSeed;
  const [minInt, maxInt] = rushHour
    ? config.trafficMix.intervalRushHourMs
    : config.trafficMix.intervalNormalMs;
  const nextInterval = Math.round(minInt + intR.value * (maxInt - minInt));

  return {
    script: {
      script_id: `BG-${laneId}-${seqNum}`,
      true_plate: plate,
      true_tag_id: tagId,
      true_class: vClass,
      speed_kmph: speed,
      lane_id: laneId,
      events,
    },
    tagCandidate,
    nextLaneDueMs: demoNowMs + nextInterval,
    nextSeed: s,
  };
}
