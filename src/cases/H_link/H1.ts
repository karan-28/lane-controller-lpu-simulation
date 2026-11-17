/*
 * Case H1: Plaza link down.
 * The simulated link to the plaza drops. Lanes keep fusing vehicles normally,
 * and closed transactions queue into the local buffer (buffer_depth climbs).
 */
import type { CaseDefinition } from '../../domain/types';
import { makeCleanScript } from '../helpers';

export const caseH1: CaseDefinition = {
  id: 'H1',
  group: 'H',
  group_name: 'Link and recovery',
  name: 'Plaza link down (buffer fills)',
  summary: 'Lanes keep fusing while link is DOWN; transactions buffer locally.',
  expected_summary: '1x STT + buffer_depth >= 1',
  duration_ms: 10500,
  buildActions: (laneId, sfx) => {
    const plate = `MH12HA${sfx}`;
    const tagId = `TAG-H1-${sfx}`;
    return [
      {
        type: 'REGISTER_TAG',
        delay_ms: 0,
        plate,
        candidates: [{ tag_id: tagId, plate, tag_class: 'VC4', status: 'VALID', issue_date: '2025-05-01' }],
      },
      { type: 'SET_LINK_STATUS', delay_ms: 0, status: 'DOWN', reason: 'Simulated plaza link outage' },
      { type: 'VEHICLE_SCRIPT', delay_ms: 1000, script: makeCleanScript(`H1-${sfx}`, laneId, plate, tagId, 'VC4', 60) },
    ];
  },
  expected: {
    route: 'STT',
    exact_transactions: 1,
    expect_buffer_depth_min: 1,
  },
};
