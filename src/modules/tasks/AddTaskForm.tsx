import React, { useState, useEffect } from 'react';
import { useTaskCategories } from '../../hooks/tasks/useTaskCategories';
import { useMainTasks } from '../../hooks/tasks/useMainTasks';
import type { Task } from '../../types';
import { useTasks } from '../../hooks/tasks/useTasks';
import toast from 'react-hot-toast';

interface AddTaskFormProps {
  onSuccess?: () => void;
}

export const AddTaskForm: React.FC<AddTaskFormProps> = ({ onSuccess }) => {
  const {
    mainCategory, subCategory1, subCategory2,
    mainOptions, sub1Options, sub2Options, sub3Options,
    handleMainChange, handleSub1Change, handleSub2Change
  } = useTaskCategories();

  const { mainTasks, fetchMainTasks } = useMainTasks();
  const { saveTask, isLoading } = useTasks();

  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState('');
  const [subCategory3, setSubCategory3] = useState<string[]>([]);
  const [isSub3DropdownOpen, setIsSub3DropdownOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedBy, setAssignedBy] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [priority, setPriority] = useState('');
  const [selectedMainTask, setSelectedMainTask] = useState('');

  const sortedSub3Options = [...sub3Options].sort();

  useEffect(() => {
    fetchMainTasks();
  }, [fetchMainTasks]);

  const toggleSub3Option = (opt: string) => {
    if (subCategory3.includes(opt)) {
      setSubCategory3(subCategory3.filter(v => v !== opt));
    } else {
      setSubCategory3([...subCategory3, opt]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mainCategory || !date || !time || !title || !priority) {
      toast.error('Please fill out all required fields (*)');
      return;
    }

    const payload: Partial<Task> = {
      department: mainCategory,
      due_date: date,
      due_time: time,
      sub_category1: subCategory1,
      sub_category2: subCategory2,
      task_title: title,
      task_description: description,
      assigned_by: assignedBy,
      assigned_to: assignedTo,
      priority,
      status: 'pending'
    };

    const success = await saveTask(payload, selectedMainTask);
    if (success) {
      toast.success('Task created successfully!');
      // Reset form
      handleMainChange('');
      setDate(new Date().toISOString().split('T')[0]);
      setTime('');
      setSubCategory3([]);
      setTitle('');
      setDescription('');
      setAssignedBy('');
      setAssignedTo('');
      setPriority('');
      setSelectedMainTask('');
      if (onSuccess) onSuccess();
    }
  };

  const inputClass = "bg-transparent border border-border text-main rounded-lg px-[14px] py-[10px] text-[0.95rem] w-full focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed";
  const labelClass = "text-[0.85rem] font-medium text-muted";

  return (
    <div className="w-full max-w-[1100px] mx-auto bg-card rounded-2xl shadow-sm border border-border p-[30px] flex flex-col gap-[24px] animate-in">
      <div className="text-[1.25rem] font-bold text-main">Add New Task</div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-[24px]">
        <div className="flex flex-col gap-[16px]">
          <div className="bg-black/5 dark:bg-white/5 px-[14px] py-[8px] rounded-lg font-semibold text-[0.95rem] text-main inline-block self-start">
            Task Details
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-[20px]">
            <div className="flex flex-col gap-[8px] md:col-span-2">
              <label className={labelClass}>Department <span className="text-red-500">*</span></label>
              <select className={inputClass} value={mainCategory} onChange={(e) => handleMainChange(e.target.value)} required>
                <option value="">Select Category</option>
                {mainOptions.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-[8px] md:col-span-1">
              <label className={labelClass}>📅 Date <span className="text-red-500">*</span></label>
              <input type="date" className={`${inputClass} [color-scheme:light] dark:[color-scheme:dark]`} value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-[8px] md:col-span-1">
              <label className={labelClass}>⏰ Time <span className="text-red-500">*</span></label>
              <input type="time" className={`${inputClass} [color-scheme:light] dark:[color-scheme:dark]`} value={time} onChange={(e) => setTime(e.target.value)} required />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-[20px]">
            <div className="flex flex-col gap-[8px]">
              <label className={labelClass}>Sub Category 1</label>
              <select className={inputClass} value={subCategory1} onChange={(e) => handleSub1Change(e.target.value)} disabled={!mainCategory || sub1Options.length === 0}>
                <option value="">Select Sub Category 1</option>
                {sub1Options.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-[8px]">
              <label className={labelClass}>Sub Category 2</label>
              <select className={inputClass} value={subCategory2} onChange={(e) => handleSub2Change(e.target.value)} disabled={!subCategory1 || sub2Options.length === 0}>
                <option value="">Select Sub Category 2</option>
                {sub2Options.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-[8px] relative">
              <label className={labelClass}>Sub Category 3</label>
              <div 
                className={inputClass}
                style={{ cursor: subCategory2 ? 'pointer' : 'not-allowed', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                onClick={() => { if(subCategory2) setIsSub3DropdownOpen(!isSub3DropdownOpen); }}
              >
                <span className="truncate">
                  {subCategory3.length > 0 ? subCategory3.join(', ') : 'Select Sub Category 3'}
                </span>
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none" className="shrink-0"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </div>
              {isSub3DropdownOpen && (
                <div className="absolute top-full left-0 right-0 bg-card border border-border rounded-lg max-h-[200px] overflow-y-auto z-10 shadow-lg mt-1">
                  {sortedSub3Options.map((opt: string) => (
                    <div key={opt} className="px-3 py-2 cursor-pointer flex items-center gap-2 hover:bg-card-alt" onClick={() => toggleSub3Option(opt)}>
                      <input type="checkbox" checked={subCategory3.includes(opt)} readOnly className="cursor-pointer w-[18px] h-[18px] rounded border-border text-primary focus:ring-primary/20" />
                      <span className="text-[13px] text-main">{opt}</span>
                    </div>
                  ))}
                  {sortedSub3Options.length === 0 && <div className="px-3 py-2 text-[13px] text-muted">No options available</div>}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-[20px]">
            <div className="flex flex-col gap-[8px] md:col-span-2">
              <label className={labelClass}>Task Title <span className="text-red-500">*</span></label>
              <input type="text" className={inputClass} placeholder="Enter Task Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-[8px] md:col-span-2">
              <label className={labelClass}>Task Description</label>
              <textarea className={inputClass} rows={3} placeholder="Enter task description..." value={description} onChange={(e) => setDescription(e.target.value)}></textarea>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-[20px]">
            <div className="flex flex-col gap-[8px]">
              <label className={labelClass}>Assigned By</label>
              <select className={inputClass} value={assignedBy} onChange={(e) => setAssignedBy(e.target.value)}>
                <option value="">Select Assigner</option>
                <option value="Jack">Jack</option>
                <option value="Thomos">Thomos</option>
                <option value="Dave">Dave</option>
              </select>
            </div>
            <div className="flex flex-col gap-[8px]">
              <label className={labelClass}>Assigned To</label>
              <select className={inputClass} value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
                <option value="">Select Assignee</option>
                <option value="Inventory">Inventory</option>
                <option value="Sales">Sales</option>
                <option value="Document Room">Document Room</option>
                <option value="Marketing">Marketing</option>
                <option value="Task Manager">Task Manager</option>
                <option value="Expense Tracker">Expense Tracker</option>
                <option value="Vendor Management">Vendor Management</option>
                <option value="Category">Category</option>
                <option value="Research & Development">Research & Development</option>
                <option value="Human Resources">Human Resources</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-[20px]">
            <div className="flex flex-col gap-[8px]">
              <label className={labelClass}>Priority <span className="text-red-500">*</span></label>
              <select className={inputClass} value={priority} onChange={(e) => setPriority(e.target.value)} required>
                <option value="">Select Priority</option>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>
            <div className="flex flex-col gap-[8px]">
              <label className={labelClass}>Add Task</label>
              <select className={inputClass} value={selectedMainTask} onChange={(e) => setSelectedMainTask(e.target.value)}>
                <option value="">Select Task</option>
                {mainTasks.map(mt => <option key={mt.id} value={mt.task_title}>{mt.task_title}</option>)}
              </select>
            </div>
          </div>
        </div>

        <button 
          type="submit" 
          disabled={isLoading}
          className="mt-[10px] h-[48px] bg-primary hover:bg-primary/90 text-white rounded-[12px] text-[1rem] font-semibold transition-all w-full flex items-center justify-center shadow-md hover:shadow-lg hover:-translate-y-[2px]"
        >
          {isLoading ? 'Creating...' : 'Create Task'}
        </button>
      </form>
    </div>
  );
};
