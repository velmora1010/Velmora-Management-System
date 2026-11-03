import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { useHRMS } from '../../context/HRMSContext';
import { Clock } from 'lucide-react';

interface ShiftFormModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SHIFT_COLORS = ['#206DA6', '#18A999', '#8B5CF6', '#F59E0B', '#EC4899', '#10B981'];

export const ShiftFormModal: React.FC<ShiftFormModalProps> = ({ isOpen, onClose }) => {
  const { addShiftTemplate } = useHRMS();

  const [name, setName] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [workHours, setWorkHours] = useState(8);
  const [color, setColor] = useState(SHIFT_COLORS[0]);
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Shift name is required');
      return;
    }

    addShiftTemplate({
      name: name.trim(),
      startTime,
      endTime,
      workHours: Number(workHours) || 8,
      color,
      description: description.trim() || `${name} working window`,
    });

    setName('');
    setDescription('');
    setError('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Shift"
      subtitle="Define operational work hours and daily shift schedule"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
            Shift Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Regular Day Shift"
            className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#206DA6]"
          />
          {error && <p className="text-[11px] text-rose-500 mt-1">{error}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Start Time
            </label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              End Time
            </label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl font-mono"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
            Total Working Hours
          </label>
          <input
            type="number"
            step="0.5"
            value={workHours}
            onChange={(e) => setWorkHours(Number(e.target.value))}
            className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl font-mono"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
            Description
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Standard office rotation with 1-hour lunch break"
            className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase mb-2">
            Badge Accent Color
          </label>
          <div className="flex items-center gap-2">
            {SHIFT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-7 h-7 rounded-xl transition-transform ${
                  color === c ? 'scale-125 ring-2 ring-slate-800 ring-offset-2' : 'hover:scale-110'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2 text-xs font-bold text-white bg-[#206DA6] hover:bg-[#1A5987] rounded-xl shadow-xs"
          >
            Create Shift
          </button>
        </div>
      </form>
    </Modal>
  );
};
