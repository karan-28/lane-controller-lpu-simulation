/*
 * Case A2: No rear read (two of three).
 * LiDAR opens the passage, RFID and Front ANPR read and agree, while Rear ANPR produces no read.
 * Expected outcome: straight-through via two-of-three agreement.
 */
import type { CaseDefinition } from '../../domain/types';

export const caseA2: CaseDefinition = {
  id: 'A2',
  group: 'A',
  group_name: 'Clean flow',
  name: 'No rear read',
  summary: 'RFID and Front ANPR agree; Rear ANPR missed.',
  expected_summary: 'STT (two-of-three: RFID+FANPR+LIDAR)',
  duration_ms: 10500,
  buildActions: (laneId, sfx) => {
    const plate = `MH14AB${sfx}`;
    const tagId = `TAG-A2-${sfx}`;
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
          script_id: `A2-${sfx}`,
          true_plate: plate,
          true_tag_id: tagId,
          true_class: 'VC4',
          speed_kmph: 60,
          lane_id: laneId,
          events: [
            { source: 'FANPR', device_offset_ms: -320, lpu_offset_ms: -280, plate_confidence: 0.97 },
            { source: 'LIDAR', device_offset_ms: 0, lpu_offset_ms: 25 },
            { source: 'RFID', device_offset_ms: 80, lpu_offset_ms: 110, rssi: -54 },
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
