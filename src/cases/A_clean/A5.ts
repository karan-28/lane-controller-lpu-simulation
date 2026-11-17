/*
 * Case A5: Class sweep (VC4, VC5, VC7, VC10, VC12).
 * Plays clean 4-source passages once per vehicle class, with LiDAR mapped class
 * agreeing with the registered tag class each time. Expected outcome: 5 straight-through transactions.
 */
import type { CaseDefinition, VehicleClass } from '../../domain/types';
import { makeCleanScript } from '../helpers';

const CLASSES: VehicleClass[] = ['VC4', 'VC5', 'VC7', 'VC10', 'VC12'];

export const caseA5: CaseDefinition = {
  id: 'A5',
  group: 'A',
  group_name: 'Clean flow',
  name: 'Class sweep (VC4–VC12)',
  summary: 'Clean flow across VC4, VC5, VC7, VC10, and VC12 with agreeing LiDAR class.',
  expected_summary: '5x STT (no class flags)',
  duration_ms: 23000,
  buildActions: (laneId, sfx) => {
    const actions: ReturnType<CaseDefinition['buildActions']> = [];
    CLASSES.forEach((vc, idx) => {
      const plate = `GJ0${idx + 1}CS${sfx}`;
      const tagId = `TAG-A5-${vc}-${sfx}`;
      actions.push({
        type: 'REGISTER_TAG',
        delay_ms: 0,
        plate,
        candidates: [{ tag_id: tagId, plate, tag_class: vc, status: 'VALID', issue_date: '2025-04-10' }],
      });
      actions.push({
        type: 'VEHICLE_SCRIPT',
        delay_ms: 1000 + idx * 3000,
        script: makeCleanScript(`A5-${vc}-${sfx}`, laneId, plate, tagId, vc, 55 - idx * 3),
      });
    });
    return actions;
  },
  expected: {
    exact_transactions: 5,
    expected_routes: ['STT', 'STT', 'STT', 'STT', 'STT'],
  },
};
