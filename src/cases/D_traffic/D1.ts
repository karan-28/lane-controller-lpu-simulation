/*
 * Case D1: Tailgating pair.
 * Two vehicles follow closely (1.8 s apart) so Vehicle 2 enters while Vehicle 1's rear window is still open.
 * Two separate LiDAR anchors open two passages and keep assignments separated into two STT transactions.
 */
import type { CaseDefinition } from '../../domain/types';
import { makeCleanScript } from '../helpers';

export const caseD1: CaseDefinition = {
  id: 'D1',
  group: 'D',
  group_name: 'Traffic and behaviour',
  name: 'Tailgating pair',
  summary: 'Two vehicles 1.8 s apart; LiDAR anchors separate them into two transactions.',
  expected_summary: '2x STT (distinct vehicles)',
  duration_ms: 13000,
  buildActions: (laneId, sfx) => {
    const plate1 = `MH12DA${sfx}`;
    const tag1 = `TAG-D1A-${sfx}`;
    const plate2 = `MH12DB${sfx}`;
    const tag2 = `TAG-D1B-${sfx}`;
    return [
      {
        type: 'REGISTER_TAG',
        delay_ms: 0,
        plate: plate1,
        candidates: [{ tag_id: tag1, plate: plate1, tag_class: 'VC4', status: 'VALID', issue_date: '2025-05-01' }],
      },
      {
        type: 'REGISTER_TAG',
        delay_ms: 0,
        plate: plate2,
        candidates: [{ tag_id: tag2, plate: plate2, tag_class: 'VC5', status: 'VALID', issue_date: '2025-05-01' }],
      },
      {
        type: 'VEHICLE_SCRIPT',
        delay_ms: 1000,
        script: makeCleanScript(`D1-V1-${sfx}`, laneId, plate1, tag1, 'VC4', 65),
      },
      {
        type: 'VEHICLE_SCRIPT',
        delay_ms: 2800,
        script: makeCleanScript(`D1-V2-${sfx}`, laneId, plate2, tag2, 'VC5', 65),
      },
    ];
  },
  expected: {
    exact_transactions: 2,
    expected_routes: ['STT', 'STT'],
  },
};
