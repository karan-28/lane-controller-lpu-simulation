import { useNavigate } from 'react-router-dom';
import { useLpuStore } from '../store/useLpuStore';

interface GuidedStep {
  number: number;
  title: string;
  caption: string;
  actionLabel: string;
  route: string;
  routeLabel: string;
  runSetup: () => void;
}

export function GuidedCallOverlay() {
  const navigate = useNavigate();
  const open = useLpuStore((s) => s.guidedModeOpen);
  const stepIndex = useLpuStore((s) => s.guidedStepIndex);
  const setOpen = useLpuStore((s) => s.setGuidedModeOpen);
  const setStepIndex = useLpuStore((s) => s.setGuidedStepIndex);

  const runLibraryCaseLive = useLpuStore((s) => s.runLibraryCaseLive);
  const setDeviceStateAction = useLpuStore((s) => s.setDeviceStateAction);
  const sendSingleCleanVehicle = useLpuStore((s) => s.sendSingleCleanVehicle);
  const setLinkStatusAction = useLpuStore((s) => s.setLinkStatusAction);
  const resetDemo = useLpuStore((s) => s.resetDemo);
  const addToast = useLpuStore((s) => s.addToast);

  if (!open) return null;

  const steps: GuidedStep[] = [
    {
      number: 1,
      title: 'Lanes overview',
      caption: 'Background traffic is active across all four lanes, devices are UP, and counters increment from the fusion engine.',
      actionLabel: 'Ensure traffic running',
      route: '/lanes',
      routeLabel: 'Go to Lanes overview',
      runSetup: () => {
        const s = useLpuStore.getState();
        if (!s.backgroundTrafficEnabled) s.toggleBackgroundTraffic();
        if (s.clock.paused) s.toggleClockPause();
        addToast('Step 1 ready: all four lanes flowing.');
      },
    },
    {
      number: 2,
      title: 'Lane L02 detail',
      caption: 'Watch a clean 4-source passage fuse end to end on L02: LiDAR anchor, matching windows, decision sentence, and STT card.',
      actionLabel: 'Run clean passage (A1) on L02',
      route: '/lane/L02',
      routeLabel: 'Go to Lane L02',
      runSetup: () => {
        runLibraryCaseLive('A1', 'L02');
      },
    },
    {
      number: 3,
      title: 'Tailgating pair from library',
      caption: 'Two vehicles 1.8 s apart enter inside one rear window; two LiDAR anchors separate them into two STT transactions.',
      actionLabel: 'Run Tailgating (D1) on L02',
      route: '/lane/L02',
      routeLabel: 'Go to Lane L02',
      runSetup: () => {
        runLibraryCaseLive('D1', 'L02');
      },
    },
    {
      number: 4,
      title: 'Rear ANPR down -> recover',
      caption: 'Take L02 Rear ANPR DOWN and dispatch a vehicle (fuses two-of-three with DEGRADED_FUSION flag), then bring it back UP.',
      actionLabel: 'Toggle L02 RANPR DOWN + vehicle',
      route: '/lane/L02',
      routeLabel: 'Go to Lane L02',
      runSetup: () => {
        const cur = useLpuStore.getState().engine.deviceHealth['L02:RANPR']?.state;
        if (cur === 'DOWN') {
          setDeviceStateAction('L02', 'RANPR', 'UP', 'Guided call step 4 recovery');
        } else {
          setDeviceStateAction('L02', 'RANPR', 'DOWN', 'Guided call step 4 outage');
          sendSingleCleanVehicle('L02');
        }
      },
    },
    {
      number: 5,
      title: 'Covered-plate case (RFID only)',
      caption: 'No ANPR reads at all; RFID + Request Tag resolves the plate and routes straight-through flagged EVIDENCE_CHECK.',
      actionLabel: 'Run Covered-plate (B5) on L02',
      route: '/lane/L02',
      routeLabel: 'Go to Lane L02',
      runSetup: () => {
        runLibraryCaseLive('B5', 'L02');
      },
    },
    {
      number: 6,
      title: 'Link down, then restore',
      caption: 'Drop the simulated plaza link (buffer climbs while lanes keep fusing), then click again to restore and watch sequential replay drain.',
      actionLabel: 'Drop / Restore Link',
      route: '/health',
      routeLabel: 'Go to Health & Link',
      runSetup: () => {
        const st = useLpuStore.getState().engine.linkState.status;
        if (st === 'UP') {
          setLinkStatusAction('DOWN', 'Guided call step 6 link drop');
          sendSingleCleanVehicle('L01');
        } else {
          setLinkStatusAction('UP', 'Guided call step 6 link restore');
        }
      },
    },
    {
      number: 7,
      title: 'Case library tour (Wrong-way)',
      caption: 'Show all 38 cases grouped by scenario, run the wrong-way vehicle (D3), and inspect expected vs actual.',
      actionLabel: 'Run Wrong-way (D3) on L01',
      route: '/cases',
      routeLabel: 'Go to Case Library',
      runSetup: () => {
        runLibraryCaseLive('D3', 'L01');
      },
    },
    {
      number: 8,
      title: 'Reset to opening state',
      caption: 'One click resets clock (09:00 IST), device health, plaza link, and queues for the next run.',
      actionLabel: 'Reset Demo Now',
      route: '/lanes',
      routeLabel: 'Go to Lanes overview',
      runSetup: () => {
        resetDemo();
      },
    },
  ];

  const step = steps[stepIndex] ?? steps[0];

  return (
    <div className="fixed bottom-4 left-4 z-40 w-96 bg-white border border-slate-300 rounded shadow-lg text-xs">
      <div className="px-3 py-2 border-b border-slate-200 bg-slate-100 flex items-center justify-between">
        <span className="font-bold text-slate-900">
          Guided Call Script · Step {step.number} of {steps.length}
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-2 py-0.5 border border-slate-300 rounded bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"
        >
          Dismiss (Shift+G)
        </button>
      </div>

      <div className="p-3 space-y-2.5">
        <div>
          <div className="font-bold text-slate-900 text-sm">{step.title}</div>
          <p className="text-slate-600 mt-1">{step.caption}</p>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            onClick={step.runSetup}
            className="px-2.5 py-1.5 bg-blue-700 text-white font-semibold rounded hover:bg-blue-800 cursor-pointer"
          >
            {step.actionLabel}
          </button>
          <button
            type="button"
            onClick={() => navigate(step.route)}
            className="px-2.5 py-1.5 bg-white border border-slate-300 text-slate-800 font-medium rounded hover:bg-slate-50 cursor-pointer"
          >
            {step.routeLabel}
          </button>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-200">
          <button
            type="button"
            disabled={stepIndex === 0}
            onClick={() => setStepIndex(Math.max(0, stepIndex - 1))}
            className="px-2 py-1 border border-slate-300 rounded bg-white disabled:opacity-40 cursor-pointer"
          >
            Prev
          </button>
          <div className="flex gap-1">
            {steps.map((s, idx) => (
              <button
                key={s.number}
                type="button"
                onClick={() => setStepIndex(idx)}
                className={`w-5 h-5 rounded text-[11px] font-mono cursor-pointer ${
                  idx === stepIndex
                    ? 'bg-blue-700 text-white font-bold'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {s.number}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={stepIndex === steps.length - 1}
            onClick={() => setStepIndex(Math.min(steps.length - 1, stepIndex + 1))}
            className="px-2 py-1 border border-slate-300 rounded bg-white disabled:opacity-40 cursor-pointer"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
