/*
 * Case F1: Rear event after the passage closed.
 * LiDAR, Front ANPR, and RFID fuse at close (+8s). Rear ANPR arrives at +9.4s after close.
 * Expected outcome: passage routes STT (two-of-three) and delayed rear read becomes a LatePacket referencing the passage.
 */
import type { CaseDefinition } from '../../domain/types';

export const caseF1: CaseDefinition = {
  id: 'F1',
  group: 'F',
  group_name: 'Timing and ordering',
  name: 'Rear event after passage closed',
  summary: 'Delayed Rear ANPR packet arrives after close and becomes a LatePacket.',
  expected_summary: 'STT + LATE packet referencing passage',
  duration_ms: 11500,
  buildActions: (laneId, sfx) => {
    const plate = `MH12FA${sfx}`;
    const tagId = `TAG-F1-${sfx}`;
    return [
      {
        type: 'REGISTER_TAG',
        delay_ms: 0,
        plate,
        candidates: [{ tag_id: tagId, plate, tag_class: 'VC4', status: 'VALID', issue_date: '2025-05-01' }],
      },
      {
        type: 'VEHICLE_SCRIPT',
        delay_ms: 1000,
        script: {
          script_id: `F1-${sfx}`,
          true_plate: plate,
          true_tag_id: tagId,
          true_class: 'VC4',
          speed_kmph: 60,
          lane_id: laneId,
          events: [
            { source: 'FANPR', device_offset_ms: -300, lpu_offset_ms: -260, plate_confidence: 0.97 },
            { source: 'LIDAR', device_offset_ms: 0, lpu_offset_ms: 25 },
            { source: 'RFID', device_offset_ms: 80, lpu_offset_ms: 110, rssi: -54 },
            { source: 'RANPR', device_offset_ms: 9300, lpu_offset_ms: 9400, plate_confidence: 0.95 },
          ],
        },
      },
    ];
  },
  expected: {
    route: 'STT',
    exact_transactions: 1,
    min_late_packets: 1,
  },
};
