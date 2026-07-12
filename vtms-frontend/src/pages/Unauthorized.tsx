import { ShieldOff } from 'lucide-react';

export default function Unauthorized() {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <ShieldOff className="w-10 h-10 text-gray-300 mb-3" />
      <p className="text-lg font-semibold text-gray-700">Access restricted</p>
      <p className="text-sm text-gray-400 mt-1">Your role doesn't have permission to view this page.</p>
    </div>
  );
}
