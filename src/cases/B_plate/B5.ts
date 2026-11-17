/*
 * Case B5: No ANPR reads at all (covered or tampered plates).
 * Neither Front nor Rear ANPR captures a plate. LiDAR detects the vehicle and RFID reads the tag.
 * Request Tag resolves the plate; routed straight-through with flag EVIDENCE_CHECK.
 */
import type { CaseDefinition } from '../../domain/types';

export const caseB5: CaseDefinition = {
  id: 'B5',
  group: 'B',
  group_name: 'Plate problems',
  name: 'No ANPR reads at all',
  summary: 'RFID only + LiDAR; Request Tag resolves plate, STT flagged evidence check.',
  expected_summary: 'STT (flagged EVIDENCE_CHECK)',
  duration_ms: 10500,
  buildActions: (laneId, sfx) => {
    const plate = `HR26BE${sfx}`;
    const tagId = `TAG-B5-${sfx}`;
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
          script_id: `B5-${sfx}`,
          true_plate: plate,
          true_tag_id: tagId,
          true_class: 'VC4',
          speed_kmph: 66,
          lane_id: laneId,
          events: [
            { source: 'LIDAR', device_offset_ms: 0, lpu_offset_ms: 25 },
            { source: 'RFID', device_offset_ms: 80, lpu_offset_ms: 110, rssi: -53 },
          ],
        },
      },
    ];
  },
  expected: {
    route: 'STT',
    exact_transactions: 1,
    required_flags: ['EVIDENCE_CHECK'],
  },
};
