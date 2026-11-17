import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CASE_GROUPS } from '../cases';
import type { LaneId } from '../domain/types';
import { useLpuStore } from '../store/useLpuStore';
import { PassFailChip } from '../components/StatusChips';

const LANES: LaneId[] = ['L01', 'L02', 'L03', 'L04'];

export function CaseLibraryScreen() {
  const [selectedLane, setSelectedLane] = useState<LaneId>('L01');

  const activeCases = useLpuStore((s) => s.activeCases);
  const caseResults = useLpuStore((s) => s.caseResults);
  const runAllResults = useLpuStore((s) => s.runAllResults);
  const runLibraryCaseLive = useLpuStore((s) => s.runLibraryCaseLive);
  const runAllCasesSuite = useLpuStore((s) => s.runAllCasesSuite);

  const passCount = runAllResults.filter((r) => r.status === 'PASS').length;
  const failCount = runAllResults.filter((r) => r.status === 'FAIL').length;

  return (
    <div className="space-y-4">
      {/* Header & Run All Controls */}
      <div className="bg-white border border-slate-200 rounded p-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-bold text-slate-900">
            Case Library (38 Scenarios · 8 Groups)
          </h1>
          <p className="text-xs text-slate-600">
            Cases inject raw device events through the same fusion engine as live traffic (background traffic pauses on the selected lane during each run).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label className="text-slate-600 font-medium">Run lane:</label>
          <select
            aria-label="Case run lane"
            value={selectedLane}
            onChange={(e) => setSelectedLane(e.target.value as LaneId)}
            className="border border-slate-300 rounded px-2 py-1.5 bg-white font-mono"
          >
            {LANES.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={runAllCasesSuite}
            className="px-3 py-1.5 bg-blue-700 text-white font-semibold rounded hover:bg-blue-800 cursor-pointer"
          >
            Verify all 38 (isolated)
          </button>
        </div>
      </div>

      <p className="text-xs text-slate-600">Verify all runs each case in its own isolated engine, without live animation. Use a case's Run button to watch live device-event playback. These are simulation checks, not hardware or production acceptance tests.</p>
      {/* Run All Pass/Fail Evidence Table */}
      {runAllResults.length > 0 && (
        <section className="bg-white border border-slate-200 rounded">
          <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              Isolated Engine Verification (38 cases · Demo pacing preset)
            </h2>
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-emerald-700 font-bold">{passCount} PASS</span>
              <span className="text-slate-400">/</span>
              <span className={failCount > 0 ? 'text-red-700 font-bold' : 'text-slate-600'}>
                {failCount} FAIL
              </span>
              <span className="text-slate-500">({runAllResults.length} total)</span>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            <table className="w-full border-collapse text-xs">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="px-3 py-1.5 text-left font-semibold">Case</th>
                  <th className="px-3 py-1.5 text-left font-semibold">Expected</th>
                  <th className="px-3 py-1.5 text-left font-semibold">Actual Engine Output</th>
                  <th className="px-3 py-1.5 text-left font-semibold">Result</th>
                  <th className="px-3 py-1.5 text-right font-semibold">Decision</th>
                </tr>
              </thead>
              <tbody>
                {runAllResults.map((r) => (
                  <tr key={r.case_id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-1.5 font-mono font-bold">{r.case_id}</td>
                    <td className="px-3 py-1.5 text-slate-700">{r.expected_summary}</td>
                    <td className="px-3 py-1.5 font-mono text-[11px] text-slate-800">
                      {r.actual_summary}
                      {r.status === 'FAIL' && (
                        <div className="text-red-700 font-sans mt-0.5">{r.details.join('; ')}</div>
                      )}
                    </td>
                    <td className="px-3 py-1.5">
                      <PassFailChip status={r.status} />
                    </td>
                    <td className="px-3 py-1.5 text-right whitespace-nowrap">
                      {r.primary_txn_id ? (
                        <Link
                          to={`/lane/${r.lane_id}/txn/${r.primary_txn_id}`}
                          className="text-blue-700 hover:underline font-medium"
                        >
                          View decision →
                        </Link>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                      {r.txn_ids.length > 1 && <div className="flex flex-wrap gap-2 mt-1 justify-end">{r.txn_ids.map((tid, i) => <Link key={tid} to={`/lane/${r.lane_id}/txn/${tid}`} className="text-blue-700 underline">Txn {i + 1}</Link>)}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 8 Grouped Sections */}
      <div className="space-y-4">
        {CASE_GROUPS.map((grp) => (
          <section key={grp.group} className="bg-white border border-slate-200 rounded">
            <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                {grp.title}
              </h2>
              <span className="text-[11px] font-mono text-slate-500">
                {grp.cases.length} cases
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-600">
                    <th className="px-3 py-1.5 text-left font-semibold w-14">ID</th>
                    <th className="px-3 py-1.5 text-left font-semibold w-52">Name</th>
                    <th className="px-3 py-1.5 text-left font-semibold">What it demonstrates</th>
                    <th className="px-3 py-1.5 text-left font-semibold w-56">Expected Outcome</th>
                    <th className="px-3 py-1.5 text-left font-semibold w-44">Actual / Status</th>
                    <th className="px-3 py-1.5 text-right font-semibold w-28">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {grp.cases.map((c) => {
                    const isRunning = activeCases.some((ac) => ac.caseDef.id === c.id);
                    const res = caseResults[c.id];
                    return (
                      <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-3 py-2 font-mono font-bold text-slate-900">{c.id}</td>
                        <td className="px-3 py-2 font-semibold text-slate-900">{c.name}</td>
                        <td className="px-3 py-2 text-slate-700">{c.summary}</td>
                        <td className="px-3 py-2 font-mono text-[11px] text-slate-700">
                          {c.expected_summary}
                        </td>
                        <td className="px-3 py-2">
                          {isRunning ? (
                            <PassFailChip status="RUNNING" />
                          ) : res ? (
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                <PassFailChip status={res.status} />
                                {res.primary_txn_id && (
                                  <Link
                                    to={`/lane/${res.lane_id}/txn/${res.primary_txn_id}`}
                                    className="text-[11px] text-blue-700 hover:underline"
                                  >
                                    Decision →
                                  </Link>
                                )}
                              </div>
                              <div className="text-[10px] font-mono text-slate-500">
                                {res.actual_summary}
                              </div>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400">Not run yet</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          <button
                            type="button"
                            disabled={isRunning}
                            onClick={() => runLibraryCaseLive(c.id, selectedLane)}
                            title={
                              isRunning
                                ? 'Case is currently executing on the demo clock'
                                : `Run ${c.id} on ${selectedLane}`
                            }
                            className="px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 font-semibold text-slate-800 disabled:opacity-40 cursor-pointer"
                          >
                            Run ({selectedLane})
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
