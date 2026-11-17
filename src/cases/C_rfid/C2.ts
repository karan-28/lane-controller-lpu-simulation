/*
 * Case C2: Two tags on one windshield.
 * Two distinct RFID reads arrive inside the same passage window (one at -50 dBm, one at -74 dBm).
 * The configured rule (strongest RSSI) wins and fuses straight-through; the rejected read stays visible.
 */
import type { CaseDefinition } from '../../domain/types';

export const caseC2: CaseDefinition = {
  id: 'C2',
  group: 'C',
  group_name: 'RFID problems',
  name: 'Two tags on one windshield',
  summary: 'Strongest RSSI (-50 dBm) wins over weaker tag (-74 dBm); rejected read retained.',
  expected_summary: 'STT (MULTI_TAG_READ, strongest RSSI)',
  duration_ms: 10500,
  buildActions: (laneId, sfx) => {
    const plate = `MH12CB${sfx}`;
    const strongTag = `TAG-C2-WIN-${sfx}`;
    const weakTag = `TAG-C2-REJ-${sfx}`;
    return [
      {
        type: 'REGISTER_TAG',
        delay_ms: 0,
        plate,
        candidates: [{ tag_id: strongTag, plate, tag_class: 'VC4', status: 'VALID', issue_date: '2025-05-01' }],
      },
      {
        type: 'VEHICLE_SCRIPT',
        delay_ms: 1000,
        script: {
          script_id: `C2-${sfx}`,
          true_plate: plate,
          true_tag_id: strongTag,
          true_class: 'VC4',
          speed_kmph: 62,
          lane_id: laneId,
          events: [
            { source: 'FANPR', device_offset_ms: -300, lpu_offset_ms: -260, plate_confidence: 0.97 },
            { source: 'LIDAR', device_offset_ms: 0, lpu_offset_ms: 25 },
            { source: 'RFID', device_offset_ms: 60, lpu_offset_ms: 90, tag_id: weakTag, rssi: -74 },
            { source: 'RFID', device_offset_ms: 110, lpu_offset_ms: 140, tag_id: strongTag, rssi: -50 },
            { source: 'RANPR', device_offset_ms: 850, lpu_offset_ms: 910, plate_confidence: 0.96 },
          ],
        },
      },
    ];
  },
  expected: {
    route: 'STT',
    exact_transactions: 1,
    required_flags: ['MULTI_TAG_READ'],
  },
};
