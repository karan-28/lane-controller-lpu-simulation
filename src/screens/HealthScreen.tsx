import { formatAgeSeconds, formatDemoTime } from '../domain/clock';
import { useLpuStore } from '../store/useLpuStore';
import { DeviceChip, TagChip } from '../components/StatusChips';

export function HealthScreen() {
  const clock = useLpuStore((s) => s.clock);
  const engine = useLpuStore((s) => s.engine);

  const devices = Object.values(engine.deviceHealth);
  const link = engine.linkState;

  const stateChanges = devices
    .flatMap((d) =>
      d.state_log.map((entry) => ({
        device_id: d.device_id,
        lane_id: d.lane_id,
        source: d.source,
        ...entry,
      }))
    )
    .sort((a, b) => b.ts - a.ts);

  // Small flat SVG chart for buffer depth over time
  const historyPts = link.buffer_history;
  const maxDepth = Math.max(4, ...historyPts.map((p) => p.depth));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-base font-bold text-slate-900">
          Device Health &amp; Plaza Link (Simulated)
        </h1>
        <p className="text-xs text-slate-600">
          Heartbeats emit every 10 s of demo time; 30 s silent marks a device DOWN.
        </p>
      </div>

      {/* Per-Device Table */}
      <section className="bg-white border border-slate-200 rounded">
        <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
            Lane Devices (16 Simulated Emitters)
          </h2>
          <TagChip label="SIMULATED DEVICES" tone="amber" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <th className="px-3 py-1.5 text-left font-semibold">Device ID</th>
                <th className="px-3 py-1.5 text-left font-semibold">Lane</th>
                <th className="px-3 py-1.5 text-left font-semibold">Source</th>
                <th className="px-3 py-1.5 text-left font-semibold">State</th>
                <th className="px-3 py-1.5 text-right font-semibold">Heartbeat Age</th>
                <th className="px-3 py-1.5 text-right font-semibold">Clock Drift</th>
                <th className="px-3 py-1.5 text-left font-semibold">Firmware (Simulated)</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => (
                <tr key={d.device_id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-1.5 font-mono font-semibold">{d.device_id}</td>
                  <td className="px-3 py-1.5 font-mono">{d.lane_id}</td>
                  <td className="px-3 py-1.5 font-mono">{d.source}</td>
                  <td className="px-3 py-1.5">
                    <DeviceChip state={d.state} />
                  </td>
                  <td className="px-3 py-1.5 font-mono text-right tabular-nums">
                    {formatAgeSeconds(clock.nowMs, d.last_heartbeat_ts)}
                  </td>
                  <td
                    className={`px-3 py-1.5 font-mono text-right tabular-nums ${
                      Math.abs(d.drift_ms) > 100 ? 'text-amber-700 font-bold' : 'text-slate-600'
                    }`}
                  >
                    {d.drift_ms} ms
                  </td>
                  <td className="px-3 py-1.5 font-mono text-slate-600">{d.firmware}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Plaza Link & Buffer Chart + State Change Log */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Link to Plaza */}
        <section className="bg-white border border-slate-200 rounded">
          <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              Link to Plaza (Simulated)
            </h2>
            <span
              className={`font-mono text-xs font-bold ${
                link.status === 'UP' ? 'text-emerald-700' : 'text-red-700'
              }`}
            >
              {link.status} · Buffer {link.buffer_depth}
            </span>
          </div>

          <div className="p-3 space-y-3 text-xs">
            {/* Replay progress */}
            {link.replay_in_progress && (
              <div className="border border-blue-200 bg-blue-50 rounded p-2.5 space-y-1">
                <div className="flex justify-between font-medium text-blue-900">
                  <span>Sequential Replay in Progress (is_replay=true)</span>
                  <span className="font-mono">
                    {link.replay_completed} / {link.replay_total}
                  </span>
                </div>
                <div className="w-full h-2 bg-blue-100 rounded overflow-hidden">
                  <div
                    className="h-full bg-blue-700"
                    style={{
                      width: `${Math.round(
                        (link.replay_completed / Math.max(1, link.replay_total)) * 100
                      )}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Flat Buffer Depth Chart */}
            <div>
              <div className="text-[11px] font-semibold text-slate-600 mb-1">
                Buffer Depth Over Time (max {maxDepth})
              </div>
              <div className="border border-slate-200 rounded bg-slate-50 p-2">
                <svg viewBox="0 0 400 80" className="w-full h-20 overflow-visible">
                  <line x1="0" y1="75" x2="400" y2="75" stroke="#cbd5e1" strokeWidth="1" />
                  <line x1="0" y1="10" x2="400" y2="10" stroke="#e2e8f0" strokeDasharray="3 3" strokeWidth="1" />
                  {historyPts.length > 1 ? (
                    <polyline
                      fill="none"
                      stroke="#1d4ed8"
                      strokeWidth="2"
                      points={historyPts
                        .map((pt, idx) => {
                          const x = (idx / (historyPts.length - 1)) * 400;
                          const y = 75 - (pt.depth / maxDepth) * 65;
                          return `${x.toFixed(1)},${y.toFixed(1)}`;
                        })
                        .join(' ')}
                    />
                  ) : (
                    <line x1="0" y1="75" x2="400" y2="75" stroke="#1d4ed8" strokeWidth="2" />
                  )}
                </svg>
              </div>
            </div>

            {/* Up/Down History */}
            <div>
              <div className="text-[11px] font-semibold text-slate-600 mb-1">Link Up/Down History</div>
              <table className="w-full border-collapse border border-slate-200 text-[11px]">
                <thead>
                  <tr className="bg-slate-50 text-slate-600">
                    <th className="border border-slate-200 px-2 py-1 text-left">Demo Time</th>
                    <th className="border border-slate-200 px-2 py-1 text-left">Status</th>
                    <th className="border border-slate-200 px-2 py-1 text-left">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {[...link.history].reverse().slice(0, 10).map((h, i) => (
                    <tr key={i}>
                      <td className="border border-slate-200 px-2 py-1 font-mono">{formatDemoTime(h.ts)}</td>
                      <td className="border border-slate-200 px-2 py-1 font-mono font-semibold">{h.status}</td>
                      <td className="border border-slate-200 px-2 py-1">{h.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Device State-Change Log */}
        <section className="bg-white border border-slate-200 rounded">
          <div className="px-3 py-2 border-b border-slate-200 bg-slate-50">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              Device State-Change Log
            </h2>
          </div>
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full border-collapse text-[11px]">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="px-2.5 py-1.5 text-left font-semibold">Demo Time</th>
                  <th className="px-2.5 py-1.5 text-left font-semibold">Device</th>
                  <th className="px-2.5 py-1.5 text-left font-semibold">Transition</th>
                  <th className="px-2.5 py-1.5 text-left font-semibold">Reason</th>
                </tr>
              </thead>
              <tbody>
                {stateChanges.slice(0, 40).map((entry, idx) => (
                  <tr key={idx} className="border-b border-slate-100">
                    <td className="px-2.5 py-1.5 font-mono whitespace-nowrap">
                      {formatDemoTime(entry.ts)}
                    </td>
                    <td className="px-2.5 py-1.5 font-mono font-semibold">{entry.device_id}</td>
                    <td className="px-2.5 py-1.5 font-mono">
                      {entry.from} → <strong>{entry.to}</strong>
                    </td>
                    <td className="px-2.5 py-1.5 text-slate-700">{entry.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
