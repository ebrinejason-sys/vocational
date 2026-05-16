
const Reporting = () => {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Reporting & Accountability</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="font-bold mb-4 text-gray-700 uppercase text-xs tracking-wider">Attendance Trends</h3>
          <div className="h-48 bg-gray-50 rounded-lg flex items-end justify-between p-4 space-x-2">
            {[65, 80, 45, 90, 85, 95, 88].map((h, i) => (
              <div key={i} className="flex-1 bg-primary-400 rounded-t-sm" style={{ height: `${h}%` }}></div>
            ))}
          </div>
          <div className="mt-4 flex justify-between text-[10px] text-gray-400 font-bold">
            <span>MON</span><span>TUE</span><span>WED</span><span>THU</span><span>FRI</span><span>SAT</span><span>SUN</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="font-bold mb-4 text-gray-700 uppercase text-xs tracking-wider">Competency Progress</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium">Carpentry (Batch 5)</span>
                <span className="text-primary-600 font-bold">72% Proficient</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div className="bg-primary-600 h-2 rounded-full" style={{ width: '72%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium">Tailoring (Batch 5)</span>
                <span className="text-primary-600 font-bold">58% Proficient</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div className="bg-primary-600 h-2 rounded-full" style={{ width: '58%' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="font-bold mb-4 text-gray-700 uppercase text-xs tracking-wider">Financial Overview</h3>
        <table className="w-full text-sm">
          <thead className="text-gray-500 border-b">
            <tr>
              <th className="text-left py-2 font-medium">Category</th>
              <th className="text-right py-2 font-medium">Budget</th>
              <th className="text-right py-2 font-medium">Actual</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            <tr>
              <td className="py-3">Training Materials</td>
              <td className="text-right">,400</td>
              <td className="text-right text-red-600">,150</td>
            </tr>
            <tr>
              <td className="py-3">Trainee Stipends</td>
              <td className="text-right">,000</td>
              <td className="text-right text-gray-900">,800</td>
            </tr>
            <tr>
              <td className="py-3">Production Sales</td>
              <td className="text-right">—</td>
              <td className="text-right text-green-600">+40</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Reporting;
