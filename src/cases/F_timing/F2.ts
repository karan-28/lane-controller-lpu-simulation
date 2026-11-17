/*
 * Case F2: RFID read after close.
 * Front and Rear ANPR fuse straight-through via Request Tag at close; RFID read arrives at +9.4s after close.
 * Expected outcome: STT transaction + LatePacket referencing the closed passage.
 */
import type { CaseDefinition } from '../../domain/types';

export const caseF2: CaseDefinition = {
  id: 'F2',
  group: 'F',
  group_name: 'Timing and ordering',
  name: 'RFID read after close',
  summary: 'RFID arrives after passage close and becomes a LatePacket.',
  expected_summary: 'STT + LATE packet referencing passage',
  duration_ms: 11500,
  buildActions: (laneId, sfx) => {
    const plate = `DL03FB${sfx}`;
    const tagId = `TAG-F2-${sfx}`;
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
          script_id: `F2-${sfx}`,
          true_plate: plate,
          true_tag_id: tagId,
          true_class: 'VC4',
          speed_kmph: 60,
          lane_id: laneId,
          events: [
            { source: 'FANPR', device_offset_ms: -300, lpu_offset_ms: -260, plate_confidence: 0.97 },
            { source: 'LIDAR', device_offset_ms: 0, lpu_offset_ms: 25 },
            { source: 'RANPR', device_offset_ms: 850, lpu_offset_ms: 910, plate_confidence: 0.96 },
            { source: 'RFID', device_offset_ms: 9300, lpu_offset_ms: 9400, rssi: -68 },
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
