/*
 * Case B6: ANPR only, tag found by plate.
 * RFID misses and only Front ANPR reads the plate on a LiDAR-anchored passage.
 * Request Tag finds a valid tag for the plate. Expected outcome: straight-through.
 */
import type { CaseDefinition } from '../../domain/types';

export const caseB6: CaseDefinition = {
  id: 'B6',
  group: 'B',
  group_name: 'Plate problems',
  name: 'ANPR only, tag found by plate',
  summary: 'Single ANPR read + LiDAR; Request Tag resolves tag by plate.',
  expected_summary: 'STT (tag via Request Tag)',
  duration_ms: 10500,
  buildActions: (laneId, sfx) => {
    const plate = `UP32BF${sfx}`;
    const tagId = `TAG-B6-${sfx}`;
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
          script_id: `B6-${sfx}`,
          true_plate: plate,
          true_tag_id: null,
          true_class: 'VC4',
          speed_kmph: 58,
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
    route: 'STT',
    exact_transactions: 1,
    decision_log_includes: ['tag'],
  },
};
