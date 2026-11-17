import type { LaneId, VehicleClass, VehicleScript } from '../domain/types';

export function makeCleanScript(
  scriptId: string,
  laneId: LaneId,
  plate: string,
  tagId: string | null,
  vClass: VehicleClass = 'VC4',
  speedKmph = 62
): VehicleScript {
  return {
    script_id: scriptId,
    true_plate: plate,
    true_tag_id: tagId,
    true_class: vClass,
    speed_kmph: speedKmph,
    lane_id: laneId,
    events: [
      { source: 'FANPR', device_offset_ms: -320, lpu_offset_ms: -280, plate_confidence: 0.97 },
      { source: 'LIDAR', device_offset_ms: 0, lpu_offset_ms: 25 },
      ...(tagId
        ? [{ source: 'RFID' as const, device_offset_ms: 80, lpu_offset_ms: 110, rssi: -52 }]
        : []),
      { source: 'RANPR', device_offset_ms: 850, lpu_offset_ms: 910, plate_confidence: 0.96 },
    ],
  };
}

export function adjacentLane(laneId: LaneId): LaneId {
  switch (laneId) {
    case 'L01':
      return 'L02';
    case 'L02':
      return 'L01';
    case 'L03':
      return 'L04';
    case 'L04':
      return 'L03';
  }
}
