import React, { useEffect, useState } from 'react';
import { useTasks } from '../../hooks/tasks/useTasks';
import { Card } from '../../components/ui/Card';
import { ConfirmModal } from '../../components/ui/ConfirmModal';

export const ViewCreatedTasks: React.FC = () => {
  const { tasks, isLoading, fetchTasks, archiveTask } = useTasks();
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [taskToArchive, setTaskToArchive] = useState<string | null>(null);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

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

  const filteredTasks = tasks.filter(t => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const title = (t.task_title || '').toLowerCase();
    const assignedTo = (t.assigned_to || '').toLowerCase();
    const dept = (t.department || '').toLowerCase();
    return title.includes(term) || assignedTo.includes(term) || dept.includes(term);
  });

  return (
    <div className="w-full flex flex-col gap-6 animate-in">
      <div className="flex flex-col md:flex-row justify-between items-center bg-card p-5 rounded-lg border border-border gap-4">
        <span className="font-semibold text-main">
          Created Tasks
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
        <div className="text-center p-10 text-muted">Loading tasks...</div>
      ) : filteredTasks.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredTasks.map(task => {
            const pColor = task.priority === 'High' ? '#ef4444' : task.priority === 'Medium' ? '#f59e0b' : '#22c55e';
            const pBg = task.priority === 'High' ? 'rgba(239,68,68,0.12)' : task.priority === 'Medium' ? 'rgba(245,158,11,0.12)' : 'rgba(34,197,94,0.12)';
            const sColor = '#22c55e';
            const sBg = 'rgba(34,197,94,0.12)';
            
            let fDate = task.due_date || '-';
            if (fDate !== '-') {
              try { fDate = new Date(fDate + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { /* ignore */ }
            }
            
            let fTime = task.due_time || '-';
            if (fTime !== '-') {
              try {
                const [h, m] = fTime.split(':');
                const ap = parseInt(h) >= 12 ? 'PM' : 'AM';
                fTime = `${parseInt(h) % 12 || 12}:${m} ${ap}`;
              } catch { /* ignore */ }
            }

            return (
              <Card key={task.id} className="p-5 flex flex-col h-full border border-border shadow-sm hover:-translate-y-1 hover:shadow-md transition-all">
                <div className="flex justify-between items-start mb-4">
                  <h4 className="text-lg font-bold text-main flex-1 pr-2">{task.task_title}</h4>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap" style={{ color: pColor, backgroundColor: pBg }}>
                    {task.priority || 'Low'}
                  </span>
                </div>
                
                <div className="border-b border-border pb-3 mb-3">
                  <div className="flex justify-between text-sm py-1">
                    <span className="text-muted font-medium">Department</span>
                    <span className="text-main font-medium">{task.department || '-'}</span>
                  </div>
                  <div className="flex justify-between text-sm py-1">
                    <span className="text-muted font-medium">Sub Category 1</span>
                    <span className="text-main font-medium">{task.sub_category1 || '-'}</span>
                  </div>
                  <div className="flex justify-between text-sm py-1">
                    <span className="text-muted font-medium">Sub Category 2</span>
                    <span className="text-main font-medium">{task.sub_category2 || '-'}</span>
                  </div>
                </div>

                {task.task_description && (
                  <div className="text-sm text-muted mb-3 line-clamp-3">
                    {task.task_description}
                  </div>
                )}

                <div className="flex justify-between text-sm py-1">
                  <span className="text-muted font-medium">Assigned By</span>
                  <span className="text-main font-medium">{task.assigned_by || '-'}</span>
                </div>
                <div className="flex justify-between text-sm py-1">
                  <span className="text-muted font-medium">Assigned To</span>
                  <span className="text-main font-medium">{task.assigned_to || '-'}</span>
                </div>

                <div className="flex gap-4 text-xs text-muted mt-2 mb-3">
                  <span>📅 {fDate}</span>
                  <span>⏰ {fTime}</span>
                </div>

                {task.task_items && task.task_items.length > 0 && (
                  <div className="mt-2 mb-3">
                    <div className="text-[11px] font-semibold text-muted mb-1 uppercase tracking-wide">Selected Sub Tasks</div>
                    <ul className="list-disc pl-4">
                      {task.task_items.map((st, idx) => (
                        <li key={idx} className="text-sm text-main py-0.5">{st.sub_task}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex justify-between items-center mt-auto border-t border-border pt-3">
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
          <h3 className="text-lg font-semibold text-main mb-2">No active tasks</h3>
          <p>You haven't created any tasks yet, or they have all been archived.</p>
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
