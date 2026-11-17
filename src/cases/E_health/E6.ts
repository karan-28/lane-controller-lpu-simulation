/*
 * Case E6: Clock drift over 100 ms on one device.
 * Front ANPR carries +180 ms clock drift (above the 100 ms provisional limit).
 * Expected outcome: confidence lowered by penalty and CLOCK_DRIFT warning raised.
 */
import type { CaseDefinition } from '../../domain/types';
import { makeCleanScript } from '../helpers';

export const caseE6: CaseDefinition = {
  id: 'E6',
  group: 'E',
  group_name: 'Device health',
  name: 'Clock drift > 100 ms',
  summary: '+180 ms drift on Front ANPR lowers confidence and raises CLOCK_DRIFT flag.',
  expected_summary: 'STT (flagged CLOCK_DRIFT, lowered confidence)',
  duration_ms: 10500,
  buildActions: (laneId, sfx) => {
    const plate = `GJ05EF${sfx}`;
    const tagId = `TAG-E6-${sfx}`;
    return [
      {
        type: 'REGISTER_TAG',
        delay_ms: 0,
        plate,
        candidates: [{ tag_id: tagId, plate, tag_class: 'VC4', status: 'VALID', issue_date: '2025-05-01' }],
      },
      { type: 'SET_DEVICE_DRIFT', delay_ms: 0, source: 'FANPR', drift_ms: 180 },
      { type: 'VEHICLE_SCRIPT', delay_ms: 1000, script: makeCleanScript(`E6-${sfx}`, laneId, plate, tagId, 'VC4', 60) },
      { type: 'SET_DEVICE_DRIFT', delay_ms: 9800, source: 'FANPR', drift_ms: 0 },
    ];
  },
  expected: {
    route: 'STT',
    exact_transactions: 1,
    required_flags: ['CLOCK_DRIFT'],
  },
};
