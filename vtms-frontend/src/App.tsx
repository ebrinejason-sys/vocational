import Reporting from './pages/Reporting';
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import TraineeForm from './components/TraineeForm';
import CompetencyAssessment from './components/CompetencyAssessment';
import AttendanceTracker from './components/AttendanceTracker';
import CaseNotes from './components/CaseNotes';
import InventoryManager from './components/InventoryManager';
import { clsx } from 'clsx';

const Dashboard = () => (
  <div className="space-y-6">
    <div className="flex justify-between items-center">
      <h2 className="text-2xl font-bold">Project Overview</h2>
      <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold">Online</span>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <p className="text-sm text-gray-500 font-medium">Active Trainees</p>
        <p className="text-3xl font-bold text-primary-600">124</p>
      </div>
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <p className="text-sm text-gray-500 font-medium">Current Batch</p>
        <p className="text-3xl font-bold text-primary-600">Batch 5</p>
      </div>
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <p className="text-sm text-gray-500 font-medium">Graduation Rate</p>
        <p className="text-3xl font-bold text-green-600">88%</p>
      </div>
    </div>

    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
      <h3 className="font-bold mb-4">Upcoming Assessments</h3>
      <div className="space-y-3">
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div>
            <p className="text-sm font-bold">Module 4: Wood Joint Techniques</p>
            <p className="text-xs text-gray-500">Carpentry • 12 trainees pending</p>
          </div>
          <button className="text-primary-600 text-xs font-bold uppercase">Log Results</button>
        </div>
      </div>
    </div>
  </div>
);

const TraineeList = () => {
  const [showForm, setShowForm] = React.useState(false);

  if (showForm) return (
    <div className="space-y-4">
      <button onClick={() => setShowForm(false)} className="text-primary-600 font-bold text-sm">← Back to List</button>
      <TraineeForm />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Trainees</h2>
        <button onClick={() => setShowForm(true)} className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium">Add New</button>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <ul className="divide-y">
          {[
            { name: 'John Doe', batch: 'Batch 5', status: 'Enrolled', vuln: 85 },
            { name: 'Jane Smith', batch: 'Batch 5', status: 'Enrolled', vuln: 92 },
            { name: 'Peter Pan', batch: 'Batch 4', status: 'Graduated', vuln: 70 },
          ].map((t, i) => (
            <li key={i} className="p-4 flex items-center justify-between hover:bg-gray-50 cursor-pointer">
              <div>
                <p className="font-semibold text-gray-900">{t.name}</p>
                <p className="text-xs text-gray-500">{t.batch} • {t.status}</p>
              </div>
              <div className="flex items-center space-x-2">
                <span className={clsx(
                  "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                  t.vuln > 80 ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                )}>
                  Vuln: {t.vuln}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="trainees" element={<TraineeList />} />
          <Route path="batches" element={<div className="p-4"><CompetencyAssessment /></div>} />
          <Route path="attendance" element={<div className="p-4"><AttendanceTracker /></div>} />
          <Route path="case-management" element={<div className="p-4"><CaseNotes /></div>} />
          <Route path="inventory" element={<div className="p-4"><InventoryManager /></div>} />
          <Route path="financials" element={<Reporting />} />
          <Route path="more" element={<div className="p-4">Settings & User Management</div>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;
