import { useState } from 'react';
import { formatDemoTimeMs } from '../domain/clock';
import { useLpuStore } from '../store/useLpuStore';

type DebugTab = 'events' | 'passages' | 'transactions' | 'orphans' | 'late' | 'duplicates' | 'buffer';

export function DebugScreen() {
  const [tab, setTab] = useState<DebugTab>('events');
  const engine = useLpuStore((s) => s.engine);

  const tabs: { id: DebugTab; label: string; count: number }[] = [
    { id: 'events', label: 'Raw Events', count: engine.rawEvents.length },
    { id: 'passages', label: 'Passages', count: engine.passages.length },
    { id: 'transactions', label: 'Transactions', count: engine.transactions.length },
    { id: 'orphans', label: 'Orphans', count: engine.orphans.length },
    { id: 'late', label: 'Late Packets', count: engine.latePackets.length },
    { id: 'duplicates', label: 'Duplicates', count: engine.duplicates.length },
    { id: 'buffer', label: 'Buffer & Cache', count: engine.linkState.buffer_depth },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded p-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-base font-bold text-slate-900">Raw Engine Store (/debug)</h1>
          <p className="text-xs text-slate-600">
            Unfiltered view of the in-browser fusion engine state: events, passages, transactions, orphans, late packets, and link buffer.
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-2.5 py-1 rounded border text-xs font-medium cursor-pointer ${
                tab === t.id
                  ? 'bg-blue-700 text-white border-blue-700'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {t.label} ({t.count})
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded p-3 overflow-x-auto">
        {tab === 'events' && (
          <table className="w-full border-collapse text-[11px] font-mono">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <th className="px-2 py-1 text-left">Event ID</th>
                <th className="px-2 py-1 text-left">Lane</th>
                <th className="px-2 py-1 text-left">Source</th>
                <th className="px-2 py-1 text-left">Device TS</th>
                <th className="px-2 py-1 text-left">LPU TS</th>
                <th className="px-2 py-1 text-left">Replay</th>
                <th className="px-2 py-1 text-left">Payload</th>
              </tr>
            </thead>
            <tbody>
              {[...engine.rawEvents].reverse().slice(0, 100).map((e) => (
                <tr key={e.event_id} className="border-b border-slate-100">
                  <td className="px-2 py-1">{e.event_id}</td>
                  <td className="px-2 py-1">{e.lane_id}</td>
                  <td className="px-2 py-1">{e.source}</td>
                  <td className="px-2 py-1">{formatDemoTimeMs(e.device_ts)}</td>
                  <td className="px-2 py-1">{formatDemoTimeMs(e.lpu_ts)}</td>
                  <td className="px-2 py-1">{e.is_replay ? 'true' : 'false'}</td>
                  <td className="px-2 py-1 truncate max-w-md">
                    {JSON.stringify(e.rfid ?? e.anpr ?? e.lidar)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === 'passages' && (
          <pre className="text-[11px] font-mono max-h-[540px] overflow-y-auto">
            {JSON.stringify([...engine.passages].reverse().slice(0, 40), null, 2)}
          </pre>
        )}

        {tab === 'transactions' && (
          <pre className="text-[11px] font-mono max-h-[540px] overflow-y-auto">
            {JSON.stringify([...engine.transactions].reverse().slice(0, 40), null, 2)}
          </pre>
        )}

        {tab === 'orphans' && (
          <pre className="text-[11px] font-mono max-h-[540px] overflow-y-auto">
            {JSON.stringify([...engine.orphans].reverse(), null, 2)}
          </pre>
        )}

        {tab === 'late' && (
          <pre className="text-[11px] font-mono max-h-[540px] overflow-y-auto">
            {JSON.stringify([...engine.latePackets].reverse(), null, 2)}
          </pre>
        )}

        {tab === 'duplicates' && (
          <pre className="text-[11px] font-mono max-h-[540px] overflow-y-auto">
            {JSON.stringify([...engine.duplicates].reverse(), null, 2)}
          </pre>
        )}

        {tab === 'buffer' && (
          <pre className="text-[11px] font-mono max-h-[540px] overflow-y-auto">
            {JSON.stringify(
              {
                linkState: engine.linkState,
                requestTagCacheKeys: Object.keys(engine.requestTag.cache),
              },
              null,
              2
            )}
          </pre>
        )}
      </div>
    </div>
  );
}
