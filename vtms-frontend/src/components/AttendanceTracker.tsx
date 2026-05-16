import React from 'react';
import { Check, X, Clock, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';

const trainees = [
  { id: '1', name: 'John Doe' },
  { id: '2', name: 'Jane Smith' },
  { id: '3', name: 'Peter Pan' },
];

const AttendanceTracker = () => {
  const [attendance, setAttendance] = React.useState<Record<string, string>>({});

  const mark = (id: string, status: string) => {
    setAttendance(prev => ({ ...prev, [id]: status }));
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center px-2">
        <h3 className="text-lg font-bold">Daily Attendance</h3>
        <p className="text-sm text-gray-500">{new Date().toLocaleDateString()}</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="divide-y">
          {trainees.map((t) => (
            <div key={t.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className="font-medium text-gray-900">{t.name}</span>
              <div className="flex space-x-1">
                {[
                  { status: 'present', icon: Check, color: 'bg-green-100 text-green-700 border-green-200' },
                  { status: 'absent', icon: X, color: 'bg-red-100 text-red-700 border-red-200' },
                  { status: 'late', icon: Clock, color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
                  { status: 'excused', icon: AlertCircle, color: 'bg-blue-100 text-blue-700 border-blue-200' },
                ].map((s) => (
                  <button
                    key={s.status}
                    onClick={() => mark(t.id, s.status)}
                    className={clsx(
                      "flex-1 sm:flex-none p-2 rounded-lg border transition-all flex items-center justify-center space-x-1",
                      attendance[t.id] === s.status ? s.color : "bg-white text-gray-400 border-gray-100"
                    )}
                  >
                    <s.icon className="w-5 h-5" />
                    <span className="text-[10px] uppercase font-bold sm:hidden">{s.status}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <button className="w-full bg-primary-600 text-white py-4 rounded-xl font-bold shadow-lg mt-4">
        Submit Attendance Report
      </button>
    </div>
  );
};

export default AttendanceTracker;
