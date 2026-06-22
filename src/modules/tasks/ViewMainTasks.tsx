import React, { useEffect } from 'react';
import { useMainTasks } from '../../hooks/tasks/useMainTasks';
import { Card } from '../../components/ui/Card';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { useState } from 'react';

export const ViewMainTasks: React.FC = () => {
  const { mainTasks, subTasks, isLoading, fetchMainTasks, deleteMainTask } = useMainTasks();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);

  useEffect(() => {
    fetchMainTasks();
  }, [fetchMainTasks]);

  const handleDelete = (id: string) => {
    setTaskToDelete(id);
    setIsConfirmOpen(true);
  };

  const executeDelete = async () => {
    if (taskToDelete) {
      await deleteMainTask(taskToDelete);
      setTaskToDelete(null);
    }
  };

  return (
    <div className="w-full flex flex-col gap-6 animate-in">
      <div className="flex justify-between items-center bg-card p-5 rounded-lg border border-border">
        <span className="font-semibold text-main">Saved Main Task Groups</span>
      </div>

      {isLoading ? (
        <div className="text-center p-10 text-muted">Loading main tasks...</div>
      ) : mainTasks.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {mainTasks.map(mainTask => {
            const groupSubTasks = subTasks.filter(st => st.main_task_id === mainTask.id);
            return (
              <Card key={mainTask.id} className="p-5 flex flex-col h-full border border-border shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="font-bold text-lg text-main">{mainTask.task_title}</h3>
                  <button 
                    onClick={() => handleDelete(mainTask.id)}
                    className="text-red-500 hover:text-red-700 text-xs px-2 py-1 bg-red-50 rounded"
                  >
                    Delete
                  </button>
                </div>
                
                <div className="text-sm text-muted mb-2 font-medium">Sub Tasks ({groupSubTasks.length})</div>
                <ul className="list-disc pl-5 flex-1 flex flex-col gap-1 text-sm text-muted">
                  {groupSubTasks.map(st => (
                    <li key={st.id}>{st.sub_task}</li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-center p-16 bg-card rounded-lg border border-dashed border-border text-muted">
          <div className="text-4xl mb-4">📋</div>
          <h3 className="text-lg font-semibold text-main mb-2">No Main Tasks yet</h3>
          <p>Click "+ Add Main Task" above to create your first task group.</p>
        </div>
      )}

      <ConfirmModal
        isOpen={isConfirmOpen}
        title="Delete Main Task Group"
        message="Are you sure you want to delete this main task group?"
        confirmText="Delete"
        onConfirm={executeDelete}
        onClose={() => {
          setIsConfirmOpen(false);
          setTaskToDelete(null);
        }}
      />
    </div>
  );
};
