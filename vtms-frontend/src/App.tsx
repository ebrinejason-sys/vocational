import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Batches from './pages/Batches';
import BatchDetail from './pages/BatchDetail';
import Trainees from './pages/Trainees';
import TraineeProfile from './pages/TraineeProfile';
import Attendance from './pages/Attendance';
import Competency from './pages/Competency';
import CaseManagement from './pages/CaseManagement';
import Inventory from './pages/Inventory';
import Financials from './pages/Financials';
import Graduation from './pages/Graduation';
import Alumni from './pages/Alumni';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="batches" element={<Batches />} />
          <Route path="batches/:id" element={<BatchDetail />} />
          <Route path="trainees" element={<Trainees />} />
          <Route path="trainees/:id" element={<TraineeProfile />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="competency" element={<Competency />} />
          <Route path="case-management" element={<CaseManagement />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="financials" element={<Financials />} />
          <Route path="graduation" element={<Graduation />} />
          <Route path="alumni" element={<Alumni />} />
          <Route path="more" element={<div className="p-6 text-gray-500 text-sm">Settings coming soon</div>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
