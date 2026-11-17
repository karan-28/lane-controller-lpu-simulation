/*
 * Case B4: No rear plate visible (covered or missing).
 * Rear ANPR sees nothing; RFID and Front ANPR agree within the matching window.
 * Expected outcome: straight-through via two-of-three agreement.
 */
import type { CaseDefinition } from '../../domain/types';

export const caseB4: CaseDefinition = {
  id: 'B4',
  group: 'B',
  group_name: 'Plate problems',
  name: 'No rear plate visible',
  summary: 'Covered/missing rear plate; fuses two-of-three via RFID and Front ANPR.',
  expected_summary: 'STT (RFID+FANPR+LIDAR)',
  duration_ms: 10500,
  buildActions: (laneId, sfx) => {
    const plate = `TN04BD${sfx}`;
    const tagId = `TAG-B4-${sfx}`;
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
          script_id: `B4-${sfx}`,
          true_plate: plate,
          true_tag_id: tagId,
          true_class: 'VC4',
          speed_kmph: 63,
          lane_id: laneId,
          events: [
            { source: 'FANPR', device_offset_ms: -300, lpu_offset_ms: -260, plate_confidence: 0.96 },
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
