import { useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import type { MainTask, SubTask } from '../../types';

export const useMainTasks = () => {
  const [mainTasks, setMainTasks] = useState<MainTask[]>([]);
  const [subTasks, setSubTasks] = useState<SubTask[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchMainTasks = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      console.log('Loading main_tasks...');
      const { data: mDataResult, error: mError } = await supabase
        .from('main_tasks')
        .select('*')
        .order('created_at', { ascending: false });

      let mData = mDataResult;
      if (mError) {
        console.error('main_tasks fetch error:', mError.message);
        const fallback = localStorage.getItem('main_tasks');
        if (fallback) mData = JSON.parse(fallback);
        else throw mError;
      }
      console.log('Loaded main_tasks:', mData?.length);
      
      console.log('Loading sub_tasks_rows...');
      const { data: sDataResult, error: sError } = await supabase
        .from('sub_tasks_rows')
        .select('*');
        
      let sData = sDataResult;
      if (sError) {
        console.error('sub_tasks_rows fetch error:', sError.message);
        const fallback = localStorage.getItem('sub_tasks');
        if (fallback) sData = JSON.parse(fallback);
        else throw sError;
      }
      console.log('Loaded sub_tasks_rows:', sData?.length);

      setMainTasks(mData || []);
      setSubTasks(sData || []);
    } catch (err: unknown) {
      console.error('Error fetching main tasks:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage || 'Failed to fetch main tasks');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveMainTask = async (title: string, subTaskTitles: string[]) => {
    setIsLoading(true);
    setError('');
    try {
      // 1. Insert Main Task
      const { data: mainTask, error: mainError } = await supabase
        .from('main_tasks')
        .insert([{ task_title: title, status: 'active' }])
        .select()
        .single();

      if (mainError) throw mainError;

      // 2. Insert Sub Tasks
      const subTaskPayload = subTaskTitles.map(st => ({
        main_task_id: mainTask.id,
        sub_task: st,
        status: 'active'
      }));

      const { error: subError } = await supabase
        .from('sub_tasks_rows')
        .insert(subTaskPayload);

      if (subError) throw subError;

      await fetchMainTasks();
      return true;
    } catch (err: unknown) {
      console.error('Error saving main task:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage || 'Failed to save main task');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const getSubTasksForMainTask = (mainTaskId: string) => {
    return subTasks.filter(st => st.main_task_id === mainTaskId);
  };

  const deleteMainTask = async (mainTaskId: string) => {
    try {
      // Cascade delete is usually handled by DB, but we can do it manually just in case
      await supabase.from('sub_tasks_rows').delete().eq('main_task_id', mainTaskId);
      const { error } = await supabase.from('main_tasks').delete().eq('id', mainTaskId);
      if (error) throw error;
      
      await fetchMainTasks();
      return true;
    } catch (err: unknown) {
      console.error('Error deleting main task:', err);
      return false;
    }
  };

  return {
    mainTasks,
    subTasks,
    isLoading,
    error,
    fetchMainTasks,
    saveMainTask,
    deleteMainTask,
    getSubTasksForMainTask
  };
};
