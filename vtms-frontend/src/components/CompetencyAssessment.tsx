import React from 'react';
import { COMPETENCY_LEVELS } from '../types';
import { clsx } from 'clsx';

const CompetencyAssessment = () => {
  const [selectedLevel, setSelectedLevel] = React.useState<number | null>(null);

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
      <h3 className="text-lg font-bold border-b pb-2">Practical Competency Assessment</h3>
      <p className="text-sm text-gray-500">Module: Introduction to Carpentry Hand Tools</p>

      <div className="space-y-3">
        {COMPETENCY_LEVELS.map((level) => (
          <div
            key={level.id}
            onClick={() => setSelectedLevel(level.id)}
            className={clsx(
              "p-4 border-2 rounded-lg cursor-pointer transition-all",
              selectedLevel === level.id
                ? "border-primary-600 bg-primary-50"
                : "border-gray-100 hover:border-gray-200"
            )}
          >
            <p className="font-bold text-gray-900">{level.id}. {level.label}</p>
            <p className="text-xs text-gray-600">{level.description}</p>
          </div>
        ))}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Feedback / Observational Notes</label>
        <textarea rows={3} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 bg-gray-50 p-2 border" />
      </div>

      <button className="w-full bg-primary-600 text-white py-3 rounded-lg font-bold shadow-md">
        Record Assessment
      </button>
    </div>
  );
};

export default CompetencyAssessment;
