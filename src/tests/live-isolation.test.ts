import {it,expect} from 'vitest';import {useLpuStore} from '../store/useLpuStore';
it('live clean and mismatch cases drain in-flight background instead of mixing evidence',()=>{
 for(const speed of [1,5,20] as const){
  useLpuStore.getState().resetDemo();useLpuStore.getState().setClockSpeed(speed);
  // Deliberately interrupt a background vehicle before its matching window closes.
  for(let i=0;i<Math.ceil(1700/(50*speed));i++)useLpuStore.getState().tick(50);
  for(const id of ['A1','B2','D1']){
   useLpuStore.getState().runLibraryCaseLive(id,'L01');
   const end=Math.max(...useLpuStore.getState().activeCases.map(c=>c.endsAtMs));
   while(useLpuStore.getState().clock.nowMs<end+100)useLpuStore.getState().tick(50);
   expect(useLpuStore.getState().caseResults[id]?.status).toBe('PASS');
  }
 }
});
