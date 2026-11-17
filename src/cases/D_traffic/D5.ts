/*
 * Case D5: Ghost read (over-height vehicle in adjacent lane trips sensor).
 * A camera in this lane captures a plate with no LiDAR anchor in this lane.
 * After the pre-anchor wait expires, the stray event becomes an Orphan.
 */
import type { CaseDefinition } from '../../domain/types';

export const caseD5: CaseDefinition = {
  id: 'D5',
  group: 'D',
  group_name: 'Traffic and behaviour',
  name: 'Ghost read (no anchor)',
  summary: 'Over-height vehicle in next lane trips ANPR with no LiDAR anchor -> orphan.',
  expected_summary: 'ORPHAN (no matching LiDAR anchor)',
  duration_ms: 4500,
  buildActions: (laneId, sfx) => {
    const plate = `KA05DF${sfx}`;
    return [
      {
        type: 'VEHICLE_SCRIPT',
        delay_ms: 500,
        script: {
          script_id: `D5-${sfx}`,
          true_plate: plate,
          true_tag_id: null,
          true_class: 'VC10',
          speed_kmph: 50,
          lane_id: laneId,
          events: [
            { source: 'FANPR', device_offset_ms: 0, lpu_offset_ms: 25, plate_confidence: 0.91 },
          ],
        },
      },
    ];
  },
  expected: {
    exact_transactions: 0,
    min_orphans: 1,
    reason_includes: ['no matching LiDAR anchor'],
  },
};
