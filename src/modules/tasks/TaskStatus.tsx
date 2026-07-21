import React, { useEffect, useState } from 'react';
import { useTasks } from '../../hooks/tasks/useTasks';
import { Card } from '../../components/ui/Card';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import type { Department, DepartmentSection } from '../../types';
import { departmentService } from '../../services/departmentService';
import { supabase } from '../../lib/supabase';

export const TaskStatus: React.FC = () => {
  const { tasks, isLoading, fetchTasks, archiveTask, toggleTaskItem, updateTaskStatus } = useTasks();
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [taskToArchive, setTaskToArchive] = useState<string | null>(null);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [sections, setSections] = useState<DepartmentSection[]>([]);

  useEffect(() => {
    fetchTasks();
    
    // Load mapping data
    const loadMappings = async () => {
      try {
        const { data: depts } = await departmentService.getAllDepartments();
        if (depts) setDepartments(depts);
        
        const { data: secs } = await departmentService.getAllSections();
        if (secs) setSections(secs);
      } catch (err) {
        console.error('Failed to load mappings in TaskStatus:', err);
      }
    };
    loadMappings();
  }, [fetchTasks]);

  const getDeptName = (id: string | number) => {
    if (!id) return '-';
    const match = departments.find(d => String(d.id) === String(id));
    return match ? match.department_name : String(id);
  };

  const getSectionName = (id: string | number) => {
    if (!id) return '-';
    const match = sections.find(s => String(s.id) === String(id));
    return match ? match.section_name : String(id);
  };

  const handleArchive = (id: string) => {
    setTaskToArchive(id);
    setIsConfirmOpen(true);
  };

  const executeArchive = async () => {
    if (taskToArchive) {
      await archiveTask(taskToArchive);
      setTaskToArchive(null);
    }
  };

  const handleToggleItem = async (taskId: string, itemId: string, currentCompleted: boolean, totalItems: number, completedItems: number) => {
    const isNowCompleted = !currentCompleted;
    await toggleTaskItem(itemId, isNowCompleted);
    
    // Auto-update task status based on progress
    const newCompletedCount = isNowCompleted ? completedItems + 1 : completedItems - 1;
    let newStatus = 'In Progress';
    
    if (newCompletedCount === 0) {
      newStatus = 'Pending';
    } else if (newCompletedCount === totalItems && totalItems > 0) {
      newStatus = 'Completed';
    }
    
    // If the status has changed, update it
    const task = tasks.find(t => t.id === taskId);
    if (task && task.status !== newStatus && task.status !== 'Archived') {
      await updateTaskStatus(taskId, newStatus);
    }
  };

  const filteredTasks = tasks.filter(t => {
    const title = (t.task_title || '').toLowerCase();
    const assignedTo = (t.assigned_to || '').toLowerCase();
    const resolvedDept = getDeptName(t.department).toLowerCase();
    const resolvedSection = getSectionName(t.sub_category1 || '').toLowerCase();

    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return title.includes(term) || assignedTo.includes(term) || resolvedDept.includes(term) || resolvedSection.includes(term);
  });

  return (
    <div className="w-full flex flex-col gap-6 animate-in">
      <div className="flex flex-col md:flex-row justify-between items-center bg-card p-5 rounded-lg border border-border gap-4">
        <span className="font-semibold text-main">
          Task Status
          {searchTerm && <span className="text-muted ml-2 text-sm font-normal">({filteredTasks.length} results)</span>}
        </span>
        <div className="relative w-full md:w-64">
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-transparent border border-border text-main rounded-lg pl-10 pr-4 py-2 text-sm transition-velmora focus:outline-none focus:border-primary"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">🔍</span>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center p-10 text-muted">Loading task status...</div>
      ) : filteredTasks.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredTasks.map(task => {
            const pColor = task.priority === 'High' ? '#ef4444' : task.priority === 'Medium' ? '#f59e0b' : '#22c55e';
            const pBg = task.priority === 'High' ? 'rgba(239,68,68,0.12)' : task.priority === 'Medium' ? 'rgba(245,158,11,0.12)' : 'rgba(34,197,94,0.12)';
            
            let sColor = '#f59e0b'; // Pending
            let sBg = 'rgba(245,158,11,0.12)';
            if (task.status === 'Completed') {
              sColor = '#22c55e';
              sBg = 'rgba(34,197,94,0.12)';
            } else if (task.status === 'In Progress') {
              sColor = '#3b82f6';
              sBg = 'rgba(59,130,246,0.12)';
            }
            
            let fDate = task.due_date || '-';
            if (fDate !== '-') {
              try { fDate = new Date(fDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }); } catch { /* ignore */ }
            }
            
            let fTime = task.due_time || '-';
            if (fTime !== '-') {
              try {
                const [h, m] = fTime.split(':');
                const ap = parseInt(h) >= 12 ? 'PM' : 'AM';
                fTime = `${parseInt(h) % 12 || 12}:${m} ${ap}`;
              } catch { /* ignore */ }
            }

            const categoryParts = [getDeptName(task.department)];
            if (task.sub_category1) categoryParts.push(getSectionName(task.sub_category1));
            if (task.sub_category2) categoryParts.push(task.sub_category2);
            const categoryBreadcrumb = categoryParts.filter(Boolean).join(' › ');

            const totalItems = task.task_items?.length || 0;
            const completedItems = task.task_items?.filter(i => i.is_completed).length || 0;
            const progress = totalItems > 0 ? (completedItems / totalItems) * 100 : (task.status === 'Completed' ? 100 : 0);

            return (
              <Card key={task.id} className="p-5 flex flex-col h-full border border-border shadow-sm hover:-translate-y-1 hover:shadow-md transition-all">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="text-[11px] font-bold text-primary uppercase tracking-wider mb-1.5">{categoryBreadcrumb}</div>
                    <h4 className="text-lg font-bold text-main">{task.task_title}</h4>
                  </div>
                  <div className="text-right ml-4 shrink-0">
                    <div className="text-[13px] font-semibold text-main mb-1">📅 {fDate}</div>
                    <div className="text-[12px] font-medium text-muted">⏰ {fTime}</div>
                  </div>
                </div>

                {task.task_description && (
                  <div className="text-sm text-muted mb-4 line-clamp-3">
                    {task.task_description}
                  </div>
                )}

                <div className="flex justify-between text-sm py-1.5 border-t border-border">
                  <span className="text-muted font-medium">Assigned By</span>
                  <span className="text-main font-medium">{task.assigned_by || '-'}</span>
                </div>
                <div className="flex justify-between text-sm py-1.5 border-b border-border mb-4">
                  <span className="text-muted font-medium">Assigned To</span>
                  <span className="text-main font-medium">{task.assigned_to || '-'}</span>
                </div>

                {totalItems > 0 && (
                  <div className="mb-4">
                    <div className="flex justify-between items-center text-xs text-muted mb-1.5">
                      <span>Sub Tasks Progress</span>
                      <div className="text-xs font-medium text-primary">{completedItems} / {totalItems}</div>
                    </div>
                    <div className="w-full bg-border h-1.5 rounded-full overflow-hidden">
                      <div className="bg-primary h-full transition-all" style={{ width: `${progress}%` }}></div>
                    </div>

                    <div className="mt-3 space-y-2">
                      {task.task_items?.map((st) => (
                        <label key={st.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card-alt hover:bg-border/30 border border-border/50 cursor-pointer transition-colors text-sm text-main">
                          <input 
                            type="checkbox" 
                            checked={st.is_completed}
                            onChange={() => handleToggleItem(task.id, st.id, st.is_completed, totalItems, completedItems)}
                            className="w-[18px] h-[18px] rounded border-border text-primary focus:ring-primary/20 cursor-pointer"
                          />
                          <span className={st.is_completed ? 'line-through text-muted' : ''}>{st.sub_task}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-center mt-auto pt-3 border-t border-border">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ color: sColor, backgroundColor: sBg }}>
                    {task.status || 'Pending'}
                  </span>
                  <button 
                    type="button" 
                    onClick={() => handleArchive(task.id)}
                    className="text-xs px-3 py-1.5 rounded-md border border-border bg-transparent text-muted hover:border-red-500 hover:text-red-500 transition-colors"
                  >
                    Archive
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-center p-16 bg-card rounded-lg border border-dashed border-border text-muted">
          <div className="text-4xl mb-4">📋</div>
          <h3 className="text-lg font-semibold text-main mb-2">No tasks status</h3>
          <p>You have no active tasks status details currently.</p>
        </div>
      )}

      <ConfirmModal
        isOpen={isConfirmOpen}
        title="Archive Task"
        message="Are you sure you want to archive this task?"
        confirmText="Archive"
        onConfirm={executeArchive}
        onClose={() => {
          setIsConfirmOpen(false);
          setTaskToArchive(null);
        }}
      />
    </div>
  );
};
