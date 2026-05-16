import { Shield, AlertTriangle } from 'lucide-react';

const CaseNotes = () => {
  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-start space-x-3">
        <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
        <p className="text-xs text-blue-800">
          Sensitive Information: Case notes are only visible to authorized staff. Please ensure confidentiality in accordance with safeguarding policies.
        </p>
      </div>

      <div className="space-y-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h4 className="font-bold">New Entry</h4>
              <p className="text-xs text-gray-500">Trainee: John Doe</p>
            </div>
            <select className="text-xs p-1 border rounded bg-gray-50">
              <option>Trauma Healing</option>
              <option>Mentorship</option>
              <option>Safeguarding</option>
              <option>Home Visit</option>
            </select>
          </div>
          <textarea
            rows={4}
            placeholder="Document session details, observations, and progress..."
            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-primary-500 focus:border-primary-500"
          ></textarea>
          <div className="mt-3 flex items-center space-x-2">
            <input type="checkbox" id="critical" className="rounded text-primary-600" />
            <label htmlFor="critical" className="text-xs font-medium text-red-600 flex items-center">
              <AlertTriangle className="w-3 h-3 mr-1" /> Critical Issue (requires immediate attention)
            </label>
          </div>
          <button className="mt-4 w-full bg-primary-600 text-white py-2 rounded-lg font-bold text-sm">
            Save Case Note
          </button>
        </div>

        <div className="space-y-3">
          <h5 className="text-sm font-bold text-gray-500 uppercase tracking-wider px-1">Recent Activity</h5>
          {[
            { date: 'May 15', category: 'Mentorship', note: 'John showed great improvement in concentration today during practicals.', author: 'Sarah W.' },
            { date: 'May 12', category: 'Trauma Healing', note: 'Conducted group session on resilience. Participating well.', author: 'David K.' },
          ].map((note, i) => (
            <div key={i} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-gray-100 rounded-full">{note.category}</span>
                <span className="text-[10px] text-gray-400">{note.date}</span>
              </div>
              <p className="text-sm text-gray-700">{note.note}</p>
              <p className="text-[10px] text-gray-500 mt-2 italic">— {note.author}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CaseNotes;
