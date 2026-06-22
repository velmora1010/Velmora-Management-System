import { useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import type { Task } from '../../types';
import { useAuth } from '../useAuth';

export const useTasks = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { user } = useAuth();

  const fetchTasks = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      // First fetch tasks
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .neq('status', 'archived')
        .order('created_at', { ascending: false });

      if (tasksError) throw tasksError;

      // Then fetch all related task items (not ideal for huge datasets, but matches old JS simplicity)
      const { data: itemsData, error: itemsError } = await supabase
        .from('task_items')
        .select('*');

      if (itemsError) throw itemsError;

      // Map items to tasks
      const enrichedTasks = (tasksData || []).map((t: Record<string, unknown>) => ({
        ...t,
        task_items: (itemsData || []).filter((i: Record<string, unknown>) => i.task_id === t.id)
      })) as Task[];

      setTasks(enrichedTasks);
    } catch (err: unknown) {
      console.error('Error fetching tasks:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage || 'Failed to fetch tasks');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveTask = async (taskPayload: Partial<Task>, selectedSubTaskTitle?: string) => {
    setIsLoading(true);
    setError('');
    try {
      // 1. Insert Task
      const { data: newTask, error: taskError } = await supabase
        .from('tasks')
        .insert([{
          ...taskPayload,
          status: 'pending',
          created_by: user?.id || null
        }])
        .select()
        .single();

      if (taskError) throw taskError;

      // 2. If selectedSubTaskTitle is provided, we need to fetch main_task and its sub_tasks
      if (selectedSubTaskTitle) {
        const { data: mainTaskData, error: mainError } = await supabase
          .from('main_tasks')
          .select('id')
          .eq('task_title', selectedSubTaskTitle)
          .single();
          
        if (!mainError && mainTaskData) {
          const { data: subTasksData, error: subError } = await supabase
            .from('sub_tasks')
            .select('sub_task')
            .eq('main_task_id', mainTaskData.id);
            
          if (!subError && subTasksData && subTasksData.length > 0) {
            const itemsPayload = subTasksData.map(st => ({
              task_id: newTask.id,
              sub_task: st.sub_task,
              is_completed: false,
              status: 'pending'
            }));
            
            const { error: insertItemsError } = await supabase
              .from('task_items')
              .insert(itemsPayload);
              
            if (insertItemsError) throw insertItemsError;
          }
        }
      }

      await fetchTasks();
      return true;
    } catch (err: unknown) {
      console.error('Error saving task:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage || 'Failed to save task');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus })
        .eq('id', taskId);
        
      if (error) throw error;
      await fetchTasks();
      return true;
    } catch (err: unknown) {
      console.error('Error updating task status:', err);
      return false;
    }
  };

  const toggleTaskItem = async (itemId: string, completed: boolean) => {
    try {
      const { error } = await supabase
        .from('task_items')
        .update({ is_completed: completed })
        .eq('id', itemId);
        
      if (error) throw error;
      await fetchTasks(); // Refresh to get updated task progress
      return true;
    } catch (err: unknown) {
      console.error('Error toggling task item:', err);
      return false;
    }
  };

  const archiveTask = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: 'archived' })
        .eq('id', taskId);
        
      if (error) throw error;
      await fetchTasks();
      return true;
    } catch (err: unknown) {
      console.error('Error archiving task:', err);
      return false;
    }
  };

  return {
    tasks,
    isLoading,
    error,
    fetchTasks,
    saveTask,
    updateTaskStatus,
    toggleTaskItem,
    archiveTask
  };
};
