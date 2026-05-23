import { COMPETENCY_LEVEL_LABELS } from '../types';
import { cn } from '../lib/utils';
import { useState } from 'react';

const CompetencyAssessment = () => {
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
      <h3 className="text-lg font-bold border-b pb-2">Practical Competency Assessment</h3>
      <p className="text-sm text-gray-500">Module: Introduction to Carpentry Hand Tools</p>
      <div className="space-y-3">
        {([1, 2, 3, 4] as const).map((lvl) => {
          const info = COMPETENCY_LEVEL_LABELS[lvl];
          return (
            <div
              key={lvl}
              onClick={() => setSelectedLevel(lvl)}
              className={cn(
                'p-4 border-2 rounded-lg cursor-pointer transition-all',
                selectedLevel === lvl ? 'border-primary-600 bg-primary-50' : 'border-gray-100 hover:border-gray-200'
              )}
            >
              <p className="font-bold text-gray-900">{lvl}. {info.label}</p>
              <p className="text-xs text-gray-600">{info.description}</p>
            </div>
          );
        })}
      </div>
      <button className="w-full bg-primary-600 text-white py-3 rounded-lg font-bold shadow-md">
        Record Assessment
      </button>
    </div>
  );
};

export default CompetencyAssessment;
