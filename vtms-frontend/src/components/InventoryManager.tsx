import { Package, Plus, Minus, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';

const InventoryManager = () => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold">Tool & Material Inventory</h3>
        <button className="bg-primary-600 text-white p-2 rounded-full shadow-lg">
          <Plus className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {[
          { name: 'Carpentry Hammers', qty: 12, unit: 'pcs', level: 'good', reorder: 5 },
          { name: 'Timber (Pine 4x2)', qty: 4, unit: 'm', level: 'low', reorder: 10 },
          { name: 'Wood Glue', qty: 2.5, unit: 'liters', level: 'good', reorder: 1 },
        ].map((item, i) => (
          <div key={i} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={clsx(
                "p-2 rounded-lg",
                item.level === 'low' ? "bg-red-50" : "bg-primary-50"
              )}>
                <Package className={clsx("w-5 h-5", item.level === 'low' ? "text-red-600" : "text-primary-600")} />
              </div>
              <div>
                <p className="font-bold text-gray-900">{item.name}</p>
                <p className="text-xs text-gray-500">{item.qty} {item.unit} in stock</p>
              </div>
            </div>
            {item.level === 'low' && (
              <div className="text-red-600 flex items-center space-x-1">
                <AlertCircle className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase">Restock</span>
              </div>
            )}
            <div className="flex items-center space-x-2">
              <button className="p-1 border rounded bg-gray-50"><Minus className="w-4 h-4" /></button>
              <button className="p-1 border rounded bg-gray-50"><Plus className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-gray-100 p-4 rounded-xl border-2 border-dashed border-gray-300">
        <p className="text-sm font-medium text-gray-600 text-center">Log Inventory Usage for Today</p>
      </div>
    </div>
  );
};

export default InventoryManager;
