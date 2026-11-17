/*
 * Case A3: No front read (two of three).
 * LiDAR opens the passage, RFID and Rear ANPR read and agree, while Front ANPR produces no read.
 * Expected outcome: straight-through via two-of-three agreement.
 */
import type { CaseDefinition } from '../../domain/types';

export const caseA3: CaseDefinition = {
  id: 'A3',
  group: 'A',
  group_name: 'Clean flow',
  name: 'No front read',
  summary: 'RFID and Rear ANPR agree; Front ANPR missed.',
  expected_summary: 'STT (two-of-three: RFID+RANPR+LIDAR)',
  duration_ms: 10500,
  buildActions: (laneId, sfx) => {
    const plate = `DL08AC${sfx}`;
    const tagId = `TAG-A3-${sfx}`;
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
          script_id: `A3-${sfx}`,
          true_plate: plate,
          true_tag_id: tagId,
          true_class: 'VC4',
          speed_kmph: 62,
          lane_id: laneId,
          events: [
            { source: 'LIDAR', device_offset_ms: 0, lpu_offset_ms: 25 },
            { source: 'RFID', device_offset_ms: 80, lpu_offset_ms: 110, rssi: -55 },
            { source: 'RANPR', device_offset_ms: 850, lpu_offset_ms: 910, plate_confidence: 0.96 },
          ],
        },
      },
    ];
  },
  expected: {
    route: 'STT',
    exact_transactions: 1,
    decision_log_includes: ['Two of three agree'],
  },
};
