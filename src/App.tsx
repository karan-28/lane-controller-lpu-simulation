import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { CaseLibraryScreen } from './screens/CaseLibraryScreen';
import { DebugScreen } from './screens/DebugScreen';
import { DecisionViewScreen } from './screens/DecisionViewScreen';
import { HealthScreen } from './screens/HealthScreen';
import { LaneDetailScreen } from './screens/LaneDetailScreen';
import { LanesOverviewScreen } from './screens/LanesOverviewScreen';
import { OutcomesScreen } from './screens/OutcomesScreen';

const routerBasename = import.meta.env.BASE_URL.replace(/\/$/, '');

export default function App() {
  return (
    <BrowserRouter basename={routerBasename || undefined}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/lanes" replace />} />
          <Route path="/lanes" element={<LanesOverviewScreen />} />
          <Route path="/lane/:id" element={<LaneDetailScreen />} />
          <Route path="/lane/:id/txn/:txnId" element={<DecisionViewScreen />} />
          <Route path="/outcomes" element={<OutcomesScreen />} />
          <Route path="/health" element={<HealthScreen />} />
          <Route path="/cases" element={<CaseLibraryScreen />} />
          <Route path="/debug" element={<DebugScreen />} />
          <Route path="*" element={<Navigate to="/lanes" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
