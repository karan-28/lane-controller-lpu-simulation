/*
 * Case G3: Several tags on one plate.
 * Request Tag returns multiple tag candidates for the plate (one SUSPENDED old tag, one VALID newer tag).
 * The configured provisional rule picks a valid tag first (else latest issue date) and retains rejected tags.
 */
import type { CaseDefinition } from '../../domain/types';
import { makeCleanScript } from '../helpers';

export const caseG3: CaseDefinition = {
  id: 'G3',
  group: 'G',
  group_name: 'Request Tag behaviour',
  name: 'Several tags on one plate',
  summary: 'Picks VALID tag first (else latest issue date); rejected tags retained.',
  expected_summary: 'STT (flagged MULTI_TAG_ON_PLATE)',
  duration_ms: 10500,
  buildActions: (laneId, sfx) => {
    const plate = `KA01GC${sfx}`;
    return [
      {
        type: 'REGISTER_TAG',
        delay_ms: 0,
        plate,
        candidates: [
          { tag_id: `TAG-G3-OLD-${sfx}`, plate, tag_class: 'VC4', status: 'SUSPENDED', issue_date: '2023-08-10' },
          { tag_id: `TAG-G3-NEW-${sfx}`, plate, tag_class: 'VC4', status: 'VALID', issue_date: '2025-11-15' },
        ],
      },
      { type: 'VEHICLE_SCRIPT', delay_ms: 1000, script: makeCleanScript(`G3-${sfx}`, laneId, plate, null, 'VC4', 60) },
    ];
  },
  expected: {
    route: 'STT',
    exact_transactions: 1,
    required_flags: ['MULTI_TAG_ON_PLATE'],
  },
};
