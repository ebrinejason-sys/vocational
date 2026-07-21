import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { RequireAuth, RequireRole } from './components/RouteGuards';
import { rolesWithAccess } from './lib/permissions';
import Layout from './components/Layout';
import Login from './pages/Login';
import Welcome from './pages/Welcome';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Unauthorized from './pages/Unauthorized';
import Dashboard from './pages/Dashboard';
import Batches from './pages/Batches';
import BatchDetail from './pages/BatchDetail';
import Trainees from './pages/Trainees';
import TraineeProfile from './pages/TraineeProfile';
import Attendance from './pages/Attendance';
import Competency from './pages/Competency';
import CaseManagement from './pages/CaseManagement';
import Inventory from './pages/Inventory';
import Procurement from './pages/Procurement';
import Financials from './pages/Financials';
import Graduation from './pages/Graduation';
import Alumni from './pages/Alumni';
import AdminStaff from './pages/AdminStaff';
import AdminCurrency from './pages/AdminCurrency';
import Interviews from './pages/Interviews';
import Trainers from './pages/Trainers';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/unauthorized" element={<Unauthorized />} />
          <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
            <Route index element={<Dashboard />} />
            <Route path="batches" element={<Batches />} />
            <Route path="batches/:id" element={<BatchDetail />} />
            <Route path="trainees" element={<Trainees />} />
            <Route path="trainees/:id" element={<TraineeProfile />} />
            <Route path="interviews" element={<RequireRole roles={rolesWithAccess('trainees')}><Interviews /></RequireRole>} />
            <Route path="attendance" element={<RequireRole roles={rolesWithAccess('attendance')}><Attendance /></RequireRole>} />
            <Route path="competency" element={<RequireRole roles={rolesWithAccess('competency')}><Competency /></RequireRole>} />
            <Route path="case-management" element={<RequireRole roles={rolesWithAccess('case_notes')}><CaseManagement /></RequireRole>} />
            <Route path="inventory" element={<RequireRole roles={rolesWithAccess('inventory')}><Inventory /></RequireRole>} />
            <Route path="procurement" element={<RequireRole roles={rolesWithAccess('inventory')}><Procurement /></RequireRole>} />
            <Route path="financials" element={<RequireRole roles={rolesWithAccess('financials')}><Financials /></RequireRole>} />
            <Route path="graduation" element={<RequireRole roles={rolesWithAccess('graduation')}><Graduation /></RequireRole>} />
            <Route path="alumni" element={<RequireRole roles={rolesWithAccess('alumni')}><Alumni /></RequireRole>} />
            <Route path="trainers" element={<RequireRole roles={rolesWithAccess('batches')}><Trainers /></RequireRole>} />
            <Route path="admin/staff" element={<RequireRole roles={['admin']}><AdminStaff /></RequireRole>} />
            <Route path="admin/currency" element={<RequireRole roles={['admin', 'director', 'finance_officer']}><AdminCurrency /></RequireRole>} />
            <Route path="more" element={<div className="p-6 text-gray-500 text-sm">Settings coming soon</div>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
