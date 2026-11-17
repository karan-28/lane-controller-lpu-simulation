/*
 * Case C4: Tag read arrives late (tag kept inside the dashboard).
 * Front and Rear ANPR fuse straight-through via Request Tag when the passage closes at +8s.
 * The delayed RFID read arrives after passage close and is classified as a LatePacket referencing that passage.
 */
import type { CaseDefinition } from '../../domain/types';

export const caseC4: CaseDefinition = {
  id: 'C4',
  group: 'C',
  group_name: 'RFID problems',
  name: 'Tag read arrives late (dashboard tag)',
  summary: 'RFID packet arrives after passage closes and becomes a late packet.',
  expected_summary: 'STT + LATE packet referencing passage',
  duration_ms: 12000,
  buildActions: (laneId, sfx) => {
    const plate = `KA04CD${sfx}`;
    const tagId = `TAG-C4-${sfx}`;
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
          script_id: `C4-${sfx}`,
          true_plate: plate,
          true_tag_id: tagId,
          true_class: 'VC4',
          speed_kmph: 60,
          lane_id: laneId,
          events: [
            { source: 'FANPR', device_offset_ms: -300, lpu_offset_ms: -260, plate_confidence: 0.97 },
            { source: 'LIDAR', device_offset_ms: 0, lpu_offset_ms: 25 },
            { source: 'RANPR', device_offset_ms: 850, lpu_offset_ms: 910, plate_confidence: 0.96 },
            { source: 'RFID', device_offset_ms: 9300, lpu_offset_ms: 9400, rssi: -71 },
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
