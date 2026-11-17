import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ALL_CASES } from '../cases';
import type {
  ClockSpeed,
  DeviceSource,
  DeviceState,
  LaneId,
  RequestTagOverride,
  WindowPresetId,
} from '../domain/types';
import { getActivePreset } from '../domain/config';
import { useLpuStore } from '../store/useLpuStore';

const LANES: LaneId[] = ['L01', 'L02', 'L03', 'L04'];
const SOURCES: DeviceSource[] = ['RFID', 'FANPR', 'RANPR', 'LIDAR'];

export function DemoControlPanel() {
  const open = useLpuStore((s) => s.demoPanelOpen);
  const setOpen = useLpuStore((s) => s.setDemoPanelOpen);
  const clock = useLpuStore((s) => s.clock);
  const config = useLpuStore((s) => s.config);
  const linkStatus = useLpuStore((s) => s.engine.linkState.status);
  const bufferDepth = useLpuStore((s) => s.engine.linkState.buffer_depth);
  const rtOverride = useLpuStore((s) => s.engine.requestTag.override);
  const rushHour = useLpuStore((s) => s.rushHour);
  const bgEnabled = useLpuStore((s) => s.backgroundTrafficEnabled);
  const deviceHealth = useLpuStore((s) => s.engine.deviceHealth);

  const runLibraryCaseLive = useLpuStore((s) => s.runLibraryCaseLive);
  const setDeviceStateAction = useLpuStore((s) => s.setDeviceStateAction);
  const setDeviceDriftAction = useLpuStore((s) => s.setDeviceDriftAction);
  const flapDeviceAction = useLpuStore((s) => s.flapDeviceAction);
  const setLinkStatusAction = useLpuStore((s) => s.setLinkStatusAction);
  const setRequestTagOverrideAction = useLpuStore((s) => s.setRequestTagOverrideAction);
  const toggleRushHour = useLpuStore((s) => s.toggleRushHour);
  const toggleBackgroundTraffic = useLpuStore((s) => s.toggleBackgroundTraffic);
  const setClockSpeed = useLpuStore((s) => s.setClockSpeed);
  const toggleClockPause = useLpuStore((s) => s.toggleClockPause);
  const setActivePreset = useLpuStore((s) => s.setActivePreset);
  const sendSingleCleanVehicle = useLpuStore((s) => s.sendSingleCleanVehicle);
  const resetDemo = useLpuStore((s) => s.resetDemo);

  const [selectedCaseId, setSelectedCaseId] = useState<string>('A1');
  const [selectedCaseLane, setSelectedCaseLane] = useState<LaneId>('L01');
  const [devLane, setDevLane] = useState<LaneId>('L02');
  const [devSource, setDevSource] = useState<DeviceSource>('RANPR');
  const [driftInput, setDriftInput] = useState<number>(180);
  const [confirmReset, setConfirmReset] = useState(false);

  if (!open) return null;

  const currentDev = deviceHealth[`${devLane}:${devSource}`];

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full max-w-md bg-white border-l border-slate-300 shadow-lg flex flex-col">
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-100 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-900">
            Demo Control Panel (Presenter Only)
          </h2>
          <p className="text-[11px] text-slate-600">
            Presenter tools · Toggle with <kbd className="font-mono bg-white border px-1 rounded">Shift+D</kbd> or <code className="font-mono">?demo=1</code>
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-2.5 py-1 text-xs font-medium border border-slate-300 rounded bg-white hover:bg-slate-50 cursor-pointer"
        >
          Close
        </button>
      </div>
      <button type="button" className="m-3 border border-blue-300 rounded px-3 py-2 text-xs text-blue-700" onClick={() => { useLpuStore.getState().setGuidedModeOpen(true); setOpen(false); }}>Open guided call mode</button>

      <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
        {/* Fire any library case */}
        <section className="space-y-2 border-b border-slate-200 pb-4">
          <h3 className="font-bold text-slate-800 uppercase tracking-wide text-[11px]">
            1. Fire Library Case
          </h3>
          <div className="grid grid-cols-3 gap-2">
            <select
              value={selectedCaseId}
              onChange={(e) => setSelectedCaseId(e.target.value)}
              className="col-span-2 border border-slate-300 rounded px-2 py-1.5 bg-white text-xs"
            >
              {ALL_CASES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.id} — {c.name}
                </option>
              ))}
            </select>
            <select
              value={selectedCaseLane}
              onChange={(e) => setSelectedCaseLane(e.target.value as LaneId)}
              className="border border-slate-300 rounded px-2 py-1.5 bg-white text-xs"
            >
              {LANES.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => runLibraryCaseLive(selectedCaseId, selectedCaseLane)}
              className="px-3 py-1.5 bg-blue-700 text-white font-semibold rounded hover:bg-blue-800 cursor-pointer"
            >
              Submit / Fire Case
            </button>
            <button
              type="button"
              onClick={() => sendSingleCleanVehicle(selectedCaseLane)}
              className="px-3 py-1.5 bg-white border border-slate-300 text-slate-800 font-medium rounded hover:bg-slate-50 cursor-pointer"
            >
              Send 1 Vehicle ({selectedCaseLane})
            </button>
          </div>
        </section>

        {/* Device health & drift */}
        <section className="space-y-2 border-b border-slate-200 pb-4">
          <h3 className="font-bold text-slate-800 uppercase tracking-wide text-[11px]">
            2. Device Health &amp; Clock Drift (Simulated)
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={devLane}
              onChange={(e) => setDevLane(e.target.value as LaneId)}
              className="border border-slate-300 rounded px-2 py-1.5 bg-white text-xs"
            >
              {LANES.map((l) => (
                <option key={l} value={l}>
                  Lane {l}
                </option>
              ))}
            </select>
            <select
              value={devSource}
              onChange={(e) => setDevSource(e.target.value as DeviceSource)}
              className="border border-slate-300 rounded px-2 py-1.5 bg-white text-xs"
            >
              {SOURCES.map((src) => (
                <option key={src} value={src}>
                  {src}
                </option>
              ))}
            </select>
          </div>
          <div className="text-[11px] text-slate-600">
            Current: <strong className="text-slate-900">{currentDev?.state}</strong> · Drift:{' '}
            <strong className="font-mono text-slate-900">{currentDev?.drift_ms ?? 0} ms</strong>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(['UP', 'DEGRADED', 'DOWN'] as DeviceState[]).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setDeviceStateAction(devLane, devSource, st)}
                className={`px-2.5 py-1 rounded border text-xs font-semibold cursor-pointer ${
                  currentDev?.state === st
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                Set {st}
              </button>
            ))}
            <button
              type="button"
              onClick={() => flapDeviceAction(devLane, devSource)}
              className="px-2.5 py-1 rounded border border-amber-300 bg-amber-50 text-amber-900 font-semibold hover:bg-amber-100 cursor-pointer"
            >
              Flap Device
            </button>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <label className="text-[11px] text-slate-600">Drift (ms):</label>
            <input
              type="number"
              value={driftInput}
              onChange={(e) => setDriftInput(Number(e.target.value))}
              className="w-24 border border-slate-300 rounded px-2 py-1 font-mono text-xs"
            />
            <button
              type="button"
              onClick={() => setDeviceDriftAction(devLane, devSource, driftInput)}
              className="px-2.5 py-1 border border-slate-300 rounded bg-white hover:bg-slate-50 font-medium cursor-pointer"
            >
              Apply Drift
            </button>
            <button
              type="button"
              onClick={() => setDeviceDriftAction(devLane, devSource, 0)}
              className="px-2 py-1 border border-slate-300 rounded bg-white hover:bg-slate-50 text-slate-600 cursor-pointer"
            >
              Clear
            </button>
          </div>
        </section>

        {/* Plaza link & buffer */}
        <section className="space-y-2 border-b border-slate-200 pb-4">
          <h3 className="font-bold text-slate-800 uppercase tracking-wide text-[11px]">
            3. Plaza Link &amp; Buffer (Simulated)
          </h3>
          <div className="flex items-center justify-between text-xs">
            <span>
              Link: <strong>{linkStatus}</strong> · Buffer depth:{' '}
              <strong className="font-mono">{bufferDepth}</strong>
            </span>
            <div className="flex gap-1.5">
              <button
                type="button"
                disabled={linkStatus === 'DOWN'}
                onClick={() => setLinkStatusAction('DOWN', 'Presenter dropped plaza link')}
                title={linkStatus === 'DOWN' ? 'Link is already DOWN' : 'Drop link'}
                className="px-2.5 py-1 rounded border border-red-300 bg-red-50 text-red-800 font-semibold disabled:opacity-40 cursor-pointer"
              >
                Drop Link
              </button>
              <button
                type="button"
                disabled={linkStatus === 'UP'}
                onClick={() => setLinkStatusAction('UP', 'Presenter restored plaza link')}
                title={linkStatus === 'UP' ? 'Link is already UP' : 'Restore link and replay buffer'}
                className="px-2.5 py-1 rounded border border-emerald-300 bg-emerald-50 text-emerald-800 font-semibold disabled:opacity-40 cursor-pointer"
              >
                Restore Link
              </button>
            </div>
          </div>
        </section>

        {/* Request Tag override */}
        <section className="space-y-2 border-b border-slate-200 pb-4">
          <h3 className="font-bold text-slate-800 uppercase tracking-wide text-[11px]">
            4. Request Tag Override (Simulated)
          </h3>
          <div className="grid grid-cols-2 gap-1.5">
            {(['normal', 'timeout', 'empty', 'multi_tag'] as RequestTagOverride[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setRequestTagOverrideAction(mode)}
                className={`px-2.5 py-1.5 rounded border text-xs font-medium text-left cursor-pointer ${
                  rtOverride === mode
                    ? 'bg-blue-700 text-white border-blue-700'
                    : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {mode === 'normal'
                  ? 'Normal'
                  : mode === 'timeout'
                    ? 'Timeout (1 retry)'
                    : mode === 'empty'
                      ? 'Empty result'
                      : 'Multi-tag response'}
              </button>
            ))}
          </div>
        </section>

        {/* Traffic, Clock & Window Presets */}
        <section className="space-y-2 border-b border-slate-200 pb-4">
          <h3 className="font-bold text-slate-800 uppercase tracking-wide text-[11px]">
            5. Traffic, Clock &amp; Presets
          </h3>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={toggleRushHour}
              className={`px-2.5 py-1 rounded border font-medium cursor-pointer ${
                rushHour
                  ? 'bg-amber-100 border-amber-300 text-amber-900'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              Rush Hour: {rushHour ? 'ON (~2x)' : 'OFF'}
            </button>
            <button
              type="button"
              onClick={toggleBackgroundTraffic}
              className="px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 font-medium cursor-pointer"
            >
              Traffic: {bgEnabled ? 'Running' : 'Paused'}
            </button>
          </div>

          <div className="flex items-center gap-1.5 pt-1">
            <span className="text-[11px] text-slate-600 mr-1">Clock:</span>
            {([1, 5, 20] as ClockSpeed[]).map((spd) => (
              <button
                key={spd}
                type="button"
                onClick={() => setClockSpeed(spd)}
                className={`px-2 py-1 rounded border font-mono text-xs cursor-pointer ${
                  clock.speed === spd
                    ? 'bg-blue-700 text-white border-blue-700'
                    : 'bg-white border-slate-300 text-slate-700'
                }`}
              >
                {spd}x
              </button>
            ))}
            <button
              type="button"
              onClick={toggleClockPause}
              className="px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 text-xs cursor-pointer"
            >
              {clock.paused ? 'Resume' : 'Pause'}
            </button>
          </div>

          <div className="pt-1">
            <label className="block text-[11px] text-slate-600 mb-1">
              Matching Window Preset (provisional):
            </label>
            <select
              value={getActivePreset(config).id}
              onChange={(e) => setActivePreset(e.target.value as WindowPresetId)}
              className="w-full border border-slate-300 rounded px-2 py-1.5 bg-white text-xs"
            >
              {Object.values(config.presets).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.provisionalLabel})
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* Reset & Debug */}
        <section className="space-y-2">
          <h3 className="font-bold text-slate-800 uppercase tracking-wide text-[11px]">
            6. Reset &amp; Diagnostics
          </h3>
          {!confirmReset ? (
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="px-3 py-1.5 rounded border border-red-300 bg-white text-red-700 font-semibold hover:bg-red-50 cursor-pointer"
              >
                Reset Demo
              </button>
              <Link
                to="/debug"
                onClick={() => setOpen(false)}
                className="text-xs text-blue-700 underline hover:text-blue-900"
              >
                Open Raw Store (/debug)
              </Link>
            </div>
          ) : (
            <div className="border border-red-300 bg-red-50 rounded p-2.5 space-y-2">
              <p className="text-xs text-red-900 font-medium">
                Restore seed clock (09:00 IST), all devices UP, link UP, and clear transactions?
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    resetDemo();
                    setConfirmReset(false);
                  }}
                  className="px-3 py-1 bg-red-700 text-white font-semibold rounded hover:bg-red-800 cursor-pointer"
                >
                  Confirm Reset
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="px-3 py-1 bg-white border border-slate-300 rounded text-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
