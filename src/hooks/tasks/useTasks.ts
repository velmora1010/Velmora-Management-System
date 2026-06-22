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
        .from('Task_row')
        .select('*')
        .neq('status', 'archived')
        .order('created_at', { ascending: false });

      let baseTasks = tasksData;

      if (tasksError) {
        console.error('Task_row fetch error:', tasksError.message);
        const fallback = localStorage.getItem('tasks');
        if (fallback) baseTasks = JSON.parse(fallback);
        else throw tasksError;
      }

      // Then fetch all related task items
      const { data: itemsData, error: itemsError } = await supabase
        .from('Task_item_rows')
        .select('*');

      let baseItems = itemsData;

      if (itemsError) {
        console.error('Task_item_rows fetch error:', itemsError.message);
        const fallback = localStorage.getItem('task_items');
        if (fallback) baseItems = JSON.parse(fallback);
      }

      // Map snake_case to camelCase
      const mappedTasks = (baseTasks || []).map((t: any) => ({
        ...t,
        createdAt: t.created_at || t.createdAt,
        createdBy: t.created_by || t.createdBy,
        taskTitle: t.task_title || t.taskTitle || t.title,
        taskDescription: t.task_description || t.taskDescription || t.description,
      }));

      const mappedItems = (baseItems || []).map((i: any) => ({
        ...i,
        taskId: i.task_id || i.taskId,
        subTask: i.sub_task || i.subTask,
        isCompleted: i.is_completed !== undefined ? i.is_completed : i.isCompleted,
        createdAt: i.created_at || i.createdAt,
      }));

      // Map items to tasks
      const enrichedTasks = mappedTasks.map((t: any) => ({
        ...t,
        task_items: mappedItems.filter((i: any) => i.taskId === t.id)
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
        .from('Task_row')
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
              .from('Task_item_rows')
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
        .from('Task_row')
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
        .from('Task_item_rows')
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
        .from('Task_row')
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
