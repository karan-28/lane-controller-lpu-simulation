import { DEFAULT_FUSION_CONFIG } from '../domain/config';
import { deviceIdFor, healthKey } from '../domain/fusion';
import type {
  DeviceHealth,
  DeviceSource,
  FusionConfig,
  LaneId,
  RawEvent,
  ScriptEventSpec,
  VehicleClass,
  VehicleScript,
} from '../domain/types';

export interface EmitterSeqCounters {
  [deviceId: string]: number;
}

export interface ScheduledRawEvent {
  deliverAtMs: number;
  event: RawEvent;
}

const CLASS_TO_VENDOR_ID: Record<VehicleClass, string> = {
  VC4: 'AGNI_CAR_SUV',
  VC5: 'AGNI_LCV_VAN',
  VC7: 'AGNI_BUS_TRUCK_2A',
  VC10: 'AGNI_TRUCK_3A',
  VC12: 'AGNI_MAV_4PLUS',
};

const CLASS_AXLES: Record<VehicleClass, number> = {
  VC4: 2,
  VC5: 2,
  VC7: 2,
  VC10: 3,
  VC12: 4,
};

const CLASS_DIMENSIONS: Record<VehicleClass, { length_m: number; width_m: number; height_m: number }> = {
  VC4: { length_m: 4.3, width_m: 1.8, height_m: 1.55 },
  VC5: { length_m: 5.4, width_m: 2.0, height_m: 2.3 },
  VC7: { length_m: 8.6, width_m: 2.45, height_m: 3.1 },
  VC10: { length_m: 10.8, width_m: 2.5, height_m: 3.3 },
  VC12: { length_m: 14.5, width_m: 2.55, height_m: 3.6 },
};

/**
 * Simulated Device Emitters:
 * Translates a VehicleScript (the single source of truth for a passing vehicle)
 * into raw device events with per-device headers and sequence numbers.
 * Respects device DOWN state (dead devices emit nothing) and clock drift.
 */
export function emitScriptEvents(
  script: VehicleScript,
  t0Ms: number,
  seqCounters: EmitterSeqCounters,
  deviceHealth: Record<string, DeviceHealth>,
  config: FusionConfig = DEFAULT_FUSION_CONFIG,
  options?: { ignoreDeviceDown?: boolean }
): { scheduled: ScheduledRawEvent[]; nextSeqCounters: EmitterSeqCounters } {
  const nextSeq = { ...seqCounters };
  const scheduled: ScheduledRawEvent[] = [];

  for (let idx = 0; idx < script.events.length; idx++) {
    const spec: ScriptEventSpec = script.events[idx];
    const laneId: LaneId = spec.lane_override ?? script.lane_id;
    const laneMeta = config.lanes.find((l) => l.lane_id === laneId) ?? config.lanes[0];
    const devId = deviceIdFor(laneId, spec.source);
    const h = deviceHealth[healthKey(laneId, spec.source)];

    if (!options?.ignoreDeviceDown && h?.state === 'DOWN' && !spec.is_replay) {
      // Dead simulated device emits no packets
      continue;
    }

    const seq = (nextSeq[devId] ?? 0) + 1;
    nextSeq[devId] = seq;

    const driftOffset = h?.drift_ms ?? 0;
    const deviceTs = t0Ms + spec.device_offset_ms + driftOffset;
    const lpuOffset = spec.lpu_offset_ms ?? spec.device_offset_ms + 30;
    const lpuTs = Math.max(t0Ms, t0Ms + lpuOffset);

    const eventId =
      spec.fixed_event_id ??
      `EVT-${laneId}-${spec.source}-${String(seq).padStart(6, '0')}`;

    const base: RawEvent = {
      event_id: eventId,
      source: spec.source,
      plaza_id: config.plazaId,
      gantry_id: config.gantryId,
      lane_id: laneId,
      direction: laneMeta.direction,
      device_id: devId,
      device_ts: deviceTs,
      lpu_ts: lpuTs,
      seq_no: seq,
      schema_ver: spec.source === 'LIDAR' ? 'VehicleEventV1/1.0' : '1.0',
      is_replay: Boolean(spec.is_replay),
    };

    if (spec.source === 'RFID') {
      const tagId = spec.tag_id ?? script.true_tag_id ?? 'TAG-UNKNOWN';
      base.rfid = {
        tag_id: tagId,
        tid: spec.tid ?? `E2801170000002${String(seq).padStart(10, '0')}`,
        rssi: spec.rssi ?? -56,
        antenna_no: spec.antenna_no ?? 1,
        read_count: spec.read_count ?? 4,
      };
    } else if (spec.source === 'FANPR' || spec.source === 'RANPR') {
      const plate = spec.plate_text ?? script.true_plate;
      const side = spec.source === 'FANPR' ? 'FRONT' : 'REAR';
      base.anpr = {
        plate_text: plate,
        plate_confidence: spec.plate_confidence ?? 0.97,
        vehicle_colour: spec.vehicle_colour ?? 'White',
        plate_crop_placeholder: `PLACEHOLDER_${side}_PLATE_CROP [${plate}]`,
        vehicle_image_placeholder: `PLACEHOLDER_${side}_VEHICLE_FRAME [${laneId}]`,
      };
    } else if (spec.source === 'LIDAR') {
      const mappedClass = spec.mapped_class ?? script.true_class;
      const vendorClassId = spec.vendor_class_id ?? CLASS_TO_VENDOR_ID[mappedClass];
      base.lidar = {
        vendor_event_id: `AGNI-VE-${laneId}-${String(seq).padStart(6, '0')}`,
        vehicle_id: `VEH-${script.script_id}-${seq}`,
        vendor_class_id: vendorClassId,
        mapped_class: config.vendorClassCrosswalk[vendorClassId] ?? mappedClass,
        class_confidence: spec.class_confidence ?? 0.95,
        speed_kmph: spec.speed_kmph === undefined ? script.speed_kmph : spec.speed_kmph,
        axle_count: spec.axle_count === undefined ? CLASS_AXLES[mappedClass] : spec.axle_count,
        dimensions: spec.dimensions === undefined ? CLASS_DIMENSIONS[mappedClass] : spec.dimensions,
        direction: spec.lidar_direction ?? 'FORWARD',
      };
    }

    scheduled.push({
      deliverAtMs: lpuTs,
      event: base,
    });
  }

  return {
    scheduled,
    nextSeqCounters: nextSeq,
  };
}

export function describeRawEventSummary(ev: RawEvent): string {
  if (ev.source === 'RFID' && ev.rfid) {
    return `${ev.rfid.tag_id} · RSSI ${ev.rfid.rssi} dBm · Ant ${ev.rfid.antenna_no}`;
  }
  if ((ev.source === 'FANPR' || ev.source === 'RANPR') && ev.anpr) {
    return `${ev.anpr.plate_text} · conf ${ev.anpr.plate_confidence.toFixed(2)}`;
  }
  if (ev.source === 'LIDAR' && ev.lidar) {
    const spd = ev.lidar.speed_kmph !== null ? `${ev.lidar.speed_kmph} km/h` : 'speed n/a';
    const ax = ev.lidar.axle_count !== null ? `${ev.lidar.axle_count}ax` : 'ax n/a';
    return `${ev.lidar.mapped_class} · ${spd} · ${ax}${ev.lidar.direction === 'REVERSE' ? ' · REV' : ''}`;
  }
  return ev.event_id;
}
