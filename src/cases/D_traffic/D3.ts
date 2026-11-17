/*
 * Case D3: Wrong-way vehicle.
 * LiDAR reports direction = REVERSE. Even if RFID and ANPR plates match, the lane controller
 * routes the transaction to AUDIT_REQUIRED with WRONG_WAY flag.
 */
import type { CaseDefinition } from '../../domain/types';

export const caseD3: CaseDefinition = {
  id: 'D3',
  group: 'D',
  group_name: 'Traffic and behaviour',
  name: 'Wrong-way vehicle',
  summary: 'LiDAR REVERSE direction flag forces AUDIT_REQUIRED.',
  expected_summary: 'AUDIT_REQUIRED (WRONG_WAY)',
  duration_ms: 10500,
  buildActions: (laneId, sfx) => {
    const plate = `MH12DD${sfx}`;
    const tagId = `TAG-D3-${sfx}`;
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
          script_id: `D3-${sfx}`,
          true_plate: plate,
          true_tag_id: tagId,
          true_class: 'VC4',
          speed_kmph: 38,
          lane_id: laneId,
          events: [
            { source: 'FANPR', device_offset_ms: -300, lpu_offset_ms: -260, plate_confidence: 0.95 },
            { source: 'LIDAR', device_offset_ms: 0, lpu_offset_ms: 25, lidar_direction: 'REVERSE' },
            { source: 'RFID', device_offset_ms: 80, lpu_offset_ms: 110, rssi: -55 },
            { source: 'RANPR', device_offset_ms: 850, lpu_offset_ms: 910, plate_confidence: 0.94 },
          ],
        },
      },
    ];
  },
  expected: {
    route: 'AUDIT_REQUIRED',
    exact_transactions: 1,
    required_flags: ['WRONG_WAY'],
  },
};
