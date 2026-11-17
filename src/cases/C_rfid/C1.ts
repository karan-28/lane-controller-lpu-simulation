/*
 * Case C1: Cross-lane tag read.
 * An RFID tag is heard in a lane with healthy LiDAR, but no vehicle anchor exists in this lane.
 * After the pre-anchor wait expires, the read becomes an Orphan with its plain-language reason.
 */
import type { CaseDefinition } from '../../domain/types';

export const caseC1: CaseDefinition = {
  id: 'C1',
  group: 'C',
  group_name: 'RFID problems',
  name: 'Cross-lane tag read',
  summary: 'RFID tag heard with no vehicle anchor in this lane becomes an orphan.',
  expected_summary: 'ORPHAN (no vehicle anchor)',
  duration_ms: 4500,
  buildActions: (laneId, sfx) => {
    const plate = `MH12CA${sfx}`;
    const tagId = `TAG-C1-${sfx}`;
    return [
      {
        type: 'REGISTER_TAG',
        delay_ms: 0,
        plate,
        candidates: [{ tag_id: tagId, plate, tag_class: 'VC4', status: 'VALID', issue_date: '2025-05-01' }],
      },
      {
        type: 'VEHICLE_SCRIPT',
        delay_ms: 500,
        script: {
          script_id: `C1-${sfx}`,
          true_plate: plate,
          true_tag_id: tagId,
          true_class: 'VC4',
          speed_kmph: 60,
          lane_id: laneId,
          events: [
            { source: 'RFID', device_offset_ms: 0, lpu_offset_ms: 30, rssi: -83, antenna_no: 2 },
          ],
        },
      },
    ];
  },
  expected: {
    exact_transactions: 0,
    min_orphans: 1,
    reason_includes: ['no vehicle anchor'],
  },
};
