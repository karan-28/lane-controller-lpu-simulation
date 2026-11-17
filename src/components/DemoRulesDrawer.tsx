import { getActivePreset } from '../domain/config';
import { useLpuStore } from '../store/useLpuStore';

export function DemoRulesDrawer() {
  const open = useLpuStore((s) => s.rulesDrawerOpen);
  const setOpen = useLpuStore((s) => s.setRulesDrawerOpen);
  const config = useLpuStore((s) => s.config);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/25">
      <div className="w-full max-w-xl bg-white h-full border-l border-slate-300 flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Demo Rules &amp; Configuration (Read-Only · Provisional)
            </h2>
            <p className="text-[11px] text-slate-600 mt-0.5">
              All values below are live from the engine config and labelled provisional until site calibration.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="px-2.5 py-1 text-xs font-medium border border-slate-300 rounded bg-white hover:bg-slate-100 cursor-pointer"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {/* Memory reset notice */}
          <div className="border border-slate-200 bg-slate-50 rounded px-3 py-2 text-slate-700">
            All simulation state runs in browser memory and resets on page refresh.
          </div>

          {/* Calibration note */}
          <div className="border border-amber-200 bg-amber-50 rounded px-3 py-2 text-amber-900">
            <strong>Provisional Calibration Note:</strong> {config.presetDisagreementNote}
          </div>

          {/* Window Presets */}
          <section>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-2">
              Matching Window Presets (provisional)
            </h3>
            <div className="space-y-2">
              {Object.values(config.presets).map((preset) => {
                const isActive = preset.id === getActivePreset(config).id;
                return (
                  <div
                    key={preset.id}
                    className={`border rounded p-2.5 ${
                      isActive ? 'border-blue-600 bg-blue-50/40' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-slate-900">
                        {preset.name}{' '}
                        <span className="text-[11px] font-normal text-slate-500">
                          ({preset.provisionalLabel})
                        </span>
                      </span>
                      {isActive && (
                        <span className="rounded border border-blue-200 bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-800">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 mb-2">{preset.description}</p>
                    <table className="w-full border-collapse border border-slate-200 text-[11px] font-mono">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700">
                          <th className="border border-slate-200 px-2 py-1 text-left">Source</th>
                          <th className="border border-slate-200 px-2 py-1 text-right">Start (ms)</th>
                          <th className="border border-slate-200 px-2 py-1 text-right">End (ms)</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="border border-slate-200 px-2 py-1">FANPR (provisional)</td>
                          <td className="border border-slate-200 px-2 py-1 text-right">{preset.windows.FANPR.startMs}</td>
                          <td className="border border-slate-200 px-2 py-1 text-right">+{preset.windows.FANPR.endMs}</td>
                        </tr>
                        <tr>
                          <td className="border border-slate-200 px-2 py-1">RFID (provisional)</td>
                          <td className="border border-slate-200 px-2 py-1 text-right">{preset.windows.RFID.startMs}</td>
                          <td className="border border-slate-200 px-2 py-1 text-right">+{preset.windows.RFID.endMs}</td>
                        </tr>
                        <tr>
                          <td className="border border-slate-200 px-2 py-1">
                            RANPR (provisional{preset.speedScaleRear ? ', speed-scaled' : ''})
                          </td>
                          <td className="border border-slate-200 px-2 py-1 text-right">+{preset.windows.RANPR.startMs}</td>
                          <td className="border border-slate-200 px-2 py-1 text-right">+{preset.windows.RANPR.endMs}</td>
                        </tr>
                        <tr>
                          <td className="border border-slate-200 px-2 py-1">Close grace (provisional)</td>
                          <td className="border border-slate-200 px-2 py-1 text-right" colSpan={2}>
                            Longest window + {preset.closeGraceMs} ms
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Plate Normalisation & Edit Distance */}
          <section>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-2">
              Plate Comparison Rules (provisional)
            </h3>
            <table className="w-full border-collapse border border-slate-200 text-xs">
              <tbody>
                <tr>
                  <td className="border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-medium w-48">
                    Character normalisation
                  </td>
                  <td className="border border-slate-200 px-2.5 py-1.5 font-mono">
                    O → 0, I → 1, B → 8, strip spaces/hyphens (provisional)
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-medium">
                    Edit distance rule
                  </td>
                  <td className="border border-slate-200 px-2.5 py-1.5">
                    Distance ≤ {config.plateNormalisation.maxEditDistance} fuses with -{config.plateNormalisation.editDistancePenalty.toFixed(2)} confidence penalty; &gt;{config.plateNormalisation.maxEditDistance} routes to AUDIT_REQUIRED (provisional).
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-medium">
                    Open design note
                  </td>
                  <td className="border border-slate-200 px-2.5 py-1.5 text-slate-600">
                    {config.plateNormalisation.provisionalNote}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* Thresholds & Health Limits */}
          <section>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-2">
              Confidence, Health &amp; Request Tag Limits (provisional)
            </h3>
            <table className="w-full border-collapse border border-slate-200 text-xs">
              <tbody>
                <tr>
                  <td className="border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-medium w-56">
                    Straight-through confidence threshold
                  </td>
                  <td className="border border-slate-200 px-2.5 py-1.5 font-mono">
                    {config.straightThroughConfidenceThreshold.toFixed(2)} (provisional)
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-medium">
                    Low ANPR read threshold
                  </td>
                  <td className="border border-slate-200 px-2.5 py-1.5 font-mono">
                    {config.lowPlateConfidenceThreshold.toFixed(2)} (provisional)
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-medium">
                    Heartbeat interval / silent timeout
                  </td>
                  <td className="border border-slate-200 px-2.5 py-1.5 font-mono">
                    {config.heartbeatIntervalMs / 1000}s / {config.heartbeatTimeoutMs / 1000}s → DOWN (provisional)
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-medium">
                    Clock drift warning limit
                  </td>
                  <td className="border border-slate-200 px-2.5 py-1.5 font-mono">
                    &gt; {config.driftWarningMs} ms (-{config.driftConfidencePenalty.toFixed(2)} penalty, provisional)
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-medium">
                    Duplicate plate window
                  </td>
                  <td className="border border-slate-200 px-2.5 py-1.5 font-mono">
                    {config.duplicatePlateWindowMs / 60000} minutes (provisional)
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-medium">
                    Request Tag cache TTL &amp; timeout
                  </td>
                  <td className="border border-slate-200 px-2.5 py-1.5 font-mono">
                    {config.requestTag.cacheTtlMs / 60000}m cache · {config.requestTag.timeoutMs} ms timeout + 1 retry (provisional)
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-medium">
                    Multi-tag selection
                  </td>
                  <td className="border border-slate-200 px-2.5 py-1.5">
                    RFID windshield: strongest RSSI · Request Tag: valid first, else latest issue date (provisional)
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* LiDAR & Vendor Class Crosswalk */}
          <section>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-2">
              LiDAR Anchor &amp; Sample Vendor Crosswalk (provisional)
            </h3>
            <p className="text-[11px] text-slate-600 mb-2">{config.lidarAnchorNote}</p>
            <table className="w-full border-collapse border border-slate-200 text-xs font-mono">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-200 px-2 py-1 text-left">Vendor Class ID (Agnibaan VehicleEventV1)</th>
                  <th className="border border-slate-200 px-2 py-1 text-left">Mapped Toll Class (provisional)</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(config.vendorClassCrosswalk).map(([vendor, vc]) => (
                  <tr key={vendor}>
                    <td className="border border-slate-200 px-2 py-1">{vendor}</td>
                    <td className="border border-slate-200 px-2 py-1">{vc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      </div>
    </div>
  );
}
