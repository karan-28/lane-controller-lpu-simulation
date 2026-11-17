import { useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { formatDemoDateTime } from '../domain/clock';
import type { ClockSpeed } from '../domain/types';
import { useLpuStore } from '../store/useLpuStore';
import { DemoControlPanel } from './DemoControlPanel';
import { DemoRulesDrawer } from './DemoRulesDrawer';
import { GuidedCallOverlay } from './GuidedCallOverlay';

const SPEEDS: ClockSpeed[] = [1, 5, 20];

export function AppShell() {
  const location = useLocation();
  const clock = useLpuStore((s) => s.clock);
  const linkState = useLpuStore((s) => s.engine.linkState);
  const activeCasesCount = useLpuStore((s) => s.activeCases.length);
  const toasts = useLpuStore((s) => s.toasts);
  const tick = useLpuStore((s) => s.tick);
  const setClockSpeed = useLpuStore((s) => s.setClockSpeed);
  const toggleClockPause = useLpuStore((s) => s.toggleClockPause);
  const setRulesDrawerOpen = useLpuStore((s) => s.setRulesDrawerOpen);
  const setDemoPanelOpen = useLpuStore((s) => s.setDemoPanelOpen);
  const setGuidedModeOpen = useLpuStore((s) => s.setGuidedModeOpen);
  const dismissToast = useLpuStore((s) => s.dismissToast);

  // Drive simulated demo clock smoothly at ~20Hz
  useEffect(() => {
    let last = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const dt = now - last;
      last = now;
      tick(dt);
    }, 50);
    return () => window.clearInterval(timer);
  }, [tick]);

  // Open Demo Control Panel via ?demo=1 query param
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('demo') === '1') {
      setDemoPanelOpen(true);
    }
  }, [location.search, setDemoPanelOpen]);

  // Keyboard shortcuts: Shift+D (Demo Control Panel), Shift+G (Guided Call Mode)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT');
      if (isInput) return;

      if (e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        e.preventDefault();
        setDemoPanelOpen(!useLpuStore.getState().demoPanelOpen);
      } else if (e.shiftKey && (e.key === 'G' || e.key === 'g')) {
        e.preventDefault();
        setGuidedModeOpen(!useLpuStore.getState().guidedModeOpen);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setDemoPanelOpen, setGuidedModeOpen]);

  // Auto-dismiss toasts
  useEffect(() => {
    if (toasts.length === 0) return;
    const t = window.setTimeout(() => {
      dismissToast(toasts[0].id);
    }, 3800);
    return () => window.clearTimeout(t);
  }, [toasts, dismissToast]);

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 text-xs font-semibold border-b-2 whitespace-nowrap shrink-0 transition-colors ${
      isActive
        ? 'border-blue-700 text-blue-700'
        : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
    }`;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top operational navigation bar */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
        <div className="max-w-[1440px] mx-auto px-4 flex flex-wrap items-center justify-between gap-3 min-h-[48px]">
          {/* Left: Title + Mandatory Badges */}
          <div className="flex items-center gap-2.5 py-1.5">
            <span className="text-sm font-bold tracking-tight text-slate-900 whitespace-nowrap">
              LANE CONTROLLER - DEMO
            </span>
            <span className="rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-amber-900 whitespace-nowrap">
              SIMULATED DEVICES
            </span>
            <button
              type="button"
              onClick={() => setRulesDrawerOpen(true)}
              title="Inspect live provisional fusion rules and presets"
              className="rounded border border-slate-300 bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-slate-800 whitespace-nowrap cursor-pointer"
            >
              DEMO RULES - PROVISIONAL
            </button>
          </div>

          <button type="button" onClick={() => setDemoPanelOpen(true)} title="Presenter controls (Shift+D)" className="text-[10px] text-slate-500 border border-slate-200 rounded px-2 py-1">Presenter</button>
          {/* Center: 4 Main Tabs */}
          <nav className="flex items-center gap-1" aria-label="Main navigation">
            <NavLink to="/lanes" className={navLinkClass}>
              Lanes
            </NavLink>
            <NavLink to="/outcomes" className={navLinkClass}>
              Outcomes
            </NavLink>
            <NavLink to="/health" className={navLinkClass}>
              Health
            </NavLink>
            <NavLink to="/cases" className={navLinkClass}>
              Case Library
            </NavLink>
          </nav>

          {/* Right: Demo Clock + Speed Controls + Plaza Link & Buffer */}
          <div className="flex items-center gap-3 py-1.5 text-xs">
            <div className="flex items-center gap-1.5 border border-slate-200 rounded bg-slate-50 px-2 py-1">
              <span className="font-mono text-[11px] font-medium text-slate-800 tabular-nums whitespace-nowrap">
                {formatDemoDateTime(clock.nowMs)}
              </span>
              <div className="h-3.5 w-px bg-slate-300 mx-0.5" />
              <div className="flex items-center gap-0.5">
                {SPEEDS.map((spd) => (
                  <button
                    key={spd}
                    type="button"
                    onClick={() => setClockSpeed(spd)}
                    className={`px-1.5 py-0.5 text-[11px] font-mono rounded cursor-pointer ${
                      clock.speed === spd
                        ? 'bg-blue-700 text-white font-semibold'
                        : 'text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
                <button
                  type="button"
                  onClick={toggleClockPause}
                  className={`ml-0.5 px-1.5 py-0.5 text-[11px] font-medium rounded border cursor-pointer ${
                    clock.paused
                      ? 'bg-amber-100 border-amber-300 text-amber-900'
                      : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {clock.paused ? 'Resume' : 'Pause'}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 border border-slate-200 rounded bg-slate-50 px-2 py-1 whitespace-nowrap">
              <span className="text-[11px] text-slate-600">
                Link to plaza (Simulated):{' '}
                <strong
                  className={
                    linkState.status === 'UP' ? 'text-emerald-700' : 'text-red-700'
                  }
                >
                  {linkState.status}
                </strong>
              </span>
              <span className="text-slate-300">|</span>
              <span className="font-mono text-[11px] text-slate-800 tabular-nums">
                Buffer: <strong>{linkState.buffer_depth}</strong>
                {linkState.replay_in_progress && (
                  <span className="ml-1 text-blue-700">
                    (Replaying {linkState.replay_completed}/{linkState.replay_total})
                  </span>
                )}
              </span>
            </div>

            {activeCasesCount > 0 && (
              <span className="rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[11px] font-semibold text-blue-800 whitespace-nowrap">
                Case running
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main content area */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 py-4">
        <Outlet />
      </main>

      {/* Drawers & Overlays */}
      <DemoRulesDrawer />
      <DemoControlPanel />
      <GuidedCallOverlay />

      {/* Toast notifications */}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-1.5 max-w-sm">
          {toasts.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between gap-3 rounded border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm"
            >
              <span>{t.text}</span>
              <button
                type="button"
                onClick={() => dismissToast(t.id)}
                className="text-slate-400 hover:text-slate-700 font-bold cursor-pointer"
                aria-label="Dismiss notification"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
