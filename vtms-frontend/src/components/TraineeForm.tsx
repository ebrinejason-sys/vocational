
const TraineeForm = () => {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
      <h3 className="text-lg font-bold border-b pb-2">Trainee Registration</h3>
      <div className="grid grid-cols-1 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">First Name</label>
          <input type="text" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-gray-50 p-2 border" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Last Name</label>
          <input type="text" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-gray-50 p-2 border" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Gender</label>
            <select className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-gray-50 p-2 border">
              <option>Male</option>
              <option>Female</option>
              <option>Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">DOB</label>
            <input type="date" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-gray-50 p-2 border" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Mobilization Source</label>
          <input type="text" placeholder="e.g. Local Church, Community Leader" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-gray-50 p-2 border" />
        </div>
      </div>
      <div className="pt-4">
        <button className="w-full bg-primary-600 text-white py-3 rounded-lg font-bold shadow-lg hover:bg-primary-700 transition-colors">
          Save Trainee
        </button>
      </div>
    </div>
  );
};

export default TraineeForm;
