import {beforeEach,describe,it,expect} from 'vitest';
import {useLpuStore} from '../store/useLpuStore';
describe('Suite decision identity regression',()=>{
 beforeEach(()=>useLpuStore.getState().resetDemo());
 it('A1, B2 and D3 link to their own decisions, not a live counter collision',()=>{
  useLpuStore.getState().runAllCasesSuite();
  const s=useLpuStore.getState();const ids=s.runAllResults.map(r=>r.primary_txn_id).filter(Boolean);
  expect(new Set(ids).size).toBe(ids.length);
  for(const [id,route] of [['A1','STT'],['B2','AUDIT_REQUIRED'],['D3','AUDIT_REQUIRED']]){
   const r=s.caseResults[id];const a=s.archivedCaseTxns[r.primary_txn_id!];
   expect(a.txn.route).toBe(route);expect(a.txn.txn_id).not.toBe('TXN-L01-00001');
   expect(a.events.length).toBeGreaterThan(0);
  }
 });
 it('preserves separate identities and archives across repeated suite runs',()=>{
  useLpuStore.getState().runAllCasesSuite();const first=useLpuStore.getState().caseResults.B2.primary_txn_id!;
  useLpuStore.getState().runAllCasesSuite();const s=useLpuStore.getState();const second=s.caseResults.B2.primary_txn_id!;
  expect(second).not.toBe(first);expect(s.archivedCaseTxns[first].txn.route).toBe('AUDIT_REQUIRED');expect(s.archivedCaseTxns[second].txn.route).toBe('AUDIT_REQUIRED');
 });
 it('archives every class-sweep and tailgating transaction and retains rejected reads',()=>{
  useLpuStore.getState().runAllCasesSuite();const s=useLpuStore.getState();
  expect(s.caseResults.A5.txn_ids.length).toBe(5);expect(s.caseResults.D1.txn_ids.length).toBe(2);
  for(const id of [...s.caseResults.A5.txn_ids,...s.caseResults.D1.txn_ids]) expect(s.archivedCaseTxns[id]).toBeDefined();
  const a=s.archivedCaseTxns[s.caseResults.C2.primary_txn_id!];for(const id of a.txn.rejected_event_ids)expect(a.events.some(e=>e.event_id===id)).toBe(true);
 });
});
