import React, { useState, useEffect } from 'react';
import { useMainTasks } from '../../hooks/tasks/useMainTasks';
import type { Task } from '../../types';
import { useTasks } from '../../hooks/tasks/useTasks';
import { useDepartmentSelection } from '../../hooks/tasks/useDepartmentSelection';
import toast from 'react-hot-toast';

interface AddTaskFormProps {
  initialTask?: Task;
  onSuccess?: () => void;
}

export const AddTaskForm: React.FC<AddTaskFormProps> = ({ initialTask, onSuccess }) => {
  const { mainTasks, fetchMainTasks } = useMainTasks();
  const { saveTask, updateTask, isLoading } = useTasks();

  const {
    departments,
    sections,
    selectedDeptId,
    selectedSectionId,
    setSelectedSectionId,
    handleDepartmentChange,
    isDeptsLoading,
    isSectionsLoading,
    deptsError,
    sectionsError
  } = useDepartmentSelection(
    initialTask?.department,
    initialTask?.sub_category1
  );

  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedBy, setAssignedBy] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [priority, setPriority] = useState('');
  const [selectedMainTask, setSelectedMainTask] = useState('');

  // Populate form fields in Edit Mode
  useEffect(() => {
    if (initialTask) {
      setDate(initialTask.due_date || '');
      setTime(initialTask.due_time || '');
      setTitle(initialTask.task_title || '');
      setDescription(initialTask.task_description || '');
      setAssignedBy(initialTask.assigned_by || '');
      setAssignedTo(initialTask.assigned_to || '');
      setPriority(initialTask.priority || '');
    }
  }, [initialTask]);

  useEffect(() => {
    fetchMainTasks();
  }, [fetchMainTasks]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeptId || !selectedSectionId || !date || !time || !title || !priority) {
      toast.error('Please fill out all required fields (*)');
      return;
    }

    const payload: Partial<Task> = {
      department: selectedDeptId,
      sub_category1: selectedSectionId,
      due_date: date,
      due_time: time,
      task_title: title,
      task_description: description,
      assigned_by: assignedBy,
      assigned_to: assignedTo,
      priority,
      status: initialTask?.status || 'pending'
    };

    let success = false;
    if (initialTask?.id) {
      success = await updateTask(initialTask.id, payload);
      if (success) {
        toast.success('Task updated successfully!');
      }
    } else {
      success = await saveTask(payload, selectedMainTask);
      if (success) {
        toast.success('Task created successfully!');
      }
    }

    if (success) {
      // Reset form if not editing
      if (!initialTask) {
        handleDepartmentChange('');
        setDate(new Date().toISOString().split('T')[0]);
        setTime('');
        setTitle('');
        setDescription('');
        setAssignedBy('');
        setAssignedTo('');
        setPriority('');
        setSelectedMainTask('');
      }
      if (onSuccess) onSuccess();
    }
  };

  const inputClass = "bg-transparent border border-border text-main rounded-lg px-[14px] py-[10px] text-[0.95rem] w-full focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed";
  const labelClass = "text-[0.85rem] font-medium text-muted";

  return (
    <div className="w-full max-w-[1100px] mx-auto bg-card rounded-2xl shadow-sm border border-border p-[30px] flex flex-col gap-[24px] animate-in">
      <div className="text-[1.25rem] font-bold text-main">{initialTask ? 'Edit Task' : 'Add New Task'}</div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-[24px]">
        <div className="flex flex-col gap-[16px]">
          <div className="bg-black/5 dark:bg-white/5 px-[14px] py-[8px] rounded-lg font-semibold text-[0.95rem] text-main inline-block self-start">
            Task Details
          </div>

          {/* Department and Date/Time */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-[20px]">
            <div className="flex flex-col gap-[8px] md:col-span-2">
              <label className={labelClass}>Department <span className="text-red-500">*</span></label>
              <select 
                className={inputClass} 
                value={selectedDeptId} 
                onChange={(e) => handleDepartmentChange(e.target.value)} 
                required
                disabled={isDeptsLoading}
              >
                <option value="">{isDeptsLoading ? 'Loading departments...' : 'Select Department'}</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.department_name}</option>
                ))}
              </select>
              {deptsError && <span className="text-xs text-red-500 mt-1">{deptsError}</span>}
            </div>
            
            <div className="flex flex-col gap-[8px] md:col-span-1">
              <label className={labelClass}>📅 Date <span className="text-red-500">*</span></label>
              <input 
                type="date" 
                className={`${inputClass} [color-scheme:light] dark:[color-scheme:dark]`} 
                value={date} 
                onChange={(e) => setDate(e.target.value)} 
                required 
              />
            </div>
            
            <div className="flex flex-col gap-[8px] md:col-span-1">
              <label className={labelClass}>⏰ Time <span className="text-red-500">*</span></label>
              <input 
                type="time" 
                className={`${inputClass} [color-scheme:light] dark:[color-scheme:dark]`} 
                value={time} 
                onChange={(e) => setTime(e.target.value)} 
                required 
              />
            </div>
          </div>

          {/* Section dropdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-[20px]">
            <div className="flex flex-col gap-[8px]">
              <label className={labelClass}>Section <span className="text-red-500">*</span></label>
              <select 
                className={inputClass} 
                value={selectedSectionId} 
                onChange={(e) => setSelectedSectionId(e.target.value)} 
                disabled={!selectedDeptId || isSectionsLoading}
                required
              >
                <option value="">
                  {!selectedDeptId 
                    ? 'Select a department first' 
                    : isSectionsLoading 
                    ? 'Loading sections...' 
                    : sections.length === 0 
                    ? 'No sections available' 
                    : 'Select Section'
                  }
                </option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>{s.section_name}</option>
                ))}
              </select>
              {sectionsError && <span className="text-xs text-red-500 mt-1">{sectionsError}</span>}
              {selectedDeptId && !isSectionsLoading && sections.length === 0 && (
                <span className="text-xs text-amber-500 mt-1">This department does not have any sections defined yet.</span>
              )}
            </div>
          </div>

          {/* Title and Description */}
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

          {/* Assigner and Assignee */}
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

          {/* Priority and Add to main task */}
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
          {isLoading ? 'Saving...' : (initialTask ? 'Save Task' : 'Create Task')}
        </button>
      </form>
    </div>
  );
};
