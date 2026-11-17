/*
 * Case B7: ANPR only, no tag on record.
 * RFID misses, ANPR reads an unregistered plate on a LiDAR-anchored passage.
 * Request Tag returns empty. Expected outcome: AUDIT_REQUIRED.
 */
import type { CaseDefinition } from '../../domain/types';

export const caseB7: CaseDefinition = {
  id: 'B7',
  group: 'B',
  group_name: 'Plate problems',
  name: 'ANPR only, no tag on record',
  summary: 'ANPR read with no RFID and no tag in Request Tag.',
  expected_summary: 'AUDIT_REQUIRED (no tag found)',
  duration_ms: 10500,
  buildActions: (laneId, sfx) => {
    const plate = `RJ14BG${sfx}`;
    return [
      {
        type: 'VEHICLE_SCRIPT',
        delay_ms: 1000,
        script: {
          script_id: `B7-${sfx}`,
          true_plate: plate,
          true_tag_id: null,
          true_class: 'VC4',
          speed_kmph: 62,
          lane_id: laneId,
          events: [
            { source: 'FANPR', device_offset_ms: -300, lpu_offset_ms: -260, plate_confidence: 0.96 },
            { source: 'LIDAR', device_offset_ms: 0, lpu_offset_ms: 25 },
          ],
        },
      },
    ];
  },
  expected: {
    route: 'AUDIT_REQUIRED',
    exact_transactions: 1,
    reason_includes: ['no tag found'],
  },
};
