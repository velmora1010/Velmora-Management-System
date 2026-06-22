import React, { useState } from 'react';
import { AddTaskForm } from './AddTaskForm';
import { ViewCreatedTasks } from './ViewCreatedTasks';
import { TaskStatus } from './TaskStatus';
import { AddMainTaskForm } from './AddMainTaskForm';
import { ViewMainTasks } from './ViewMainTasks';
import { AddTaskCategory } from './AddTaskCategory';
import { LayoutDashboard } from 'lucide-react';

export const TaskManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'add' | 'view' | 'status' | 'addMain' | 'viewMain' | 'category'>('add');

  const navButtonClass = (isActive: boolean) => 
    `px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
      isActive 
        ? 'bg-primary text-white shadow-sm' 
        : 'bg-card-alt text-main hover:bg-border'
    }`;

  return (
    <div className="w-full flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-primary/10 rounded-lg text-primary">
          <LayoutDashboard size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-main">Task Management</h1>
          <p className="text-sm text-muted">Manage your tasks, subtasks, and categories</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 p-1 bg-card rounded-xl border border-border sticky top-0 z-10 w-fit">
        <button onClick={() => setActiveTab('add')} className={navButtonClass(activeTab === 'add')}>
          + Add New Task
        </button>
        <button onClick={() => setActiveTab('view')} className={navButtonClass(activeTab === 'view')}>
          View Created Task
        </button>
        <button onClick={() => setActiveTab('status')} className={navButtonClass(activeTab === 'status')}>
          Task Status
        </button>
        <div className="w-px bg-border mx-1 self-stretch my-1"></div>
        <button onClick={() => setActiveTab('addMain')} className={navButtonClass(activeTab === 'addMain')}>
          + Add Main Task
        </button>
        <button onClick={() => setActiveTab('viewMain')} className={navButtonClass(activeTab === 'viewMain')}>
          View Main Task
        </button>
        <div className="w-px bg-border mx-1 self-stretch my-1"></div>
        <button onClick={() => setActiveTab('category')} className={navButtonClass(activeTab === 'category')}>
          + Add Task Category
        </button>
      </div>

      <div className="mt-4">
        {activeTab === 'add' && <AddTaskForm onSuccess={() => setActiveTab('view')} />}
        {activeTab === 'view' && <ViewCreatedTasks />}
        {activeTab === 'status' && <TaskStatus />}
        {activeTab === 'addMain' && <AddMainTaskForm onSuccess={() => setActiveTab('viewMain')} />}
        {activeTab === 'viewMain' && <ViewMainTasks />}
        {activeTab === 'category' && <AddTaskCategory />}
      </div>
    </div>
  );
};
