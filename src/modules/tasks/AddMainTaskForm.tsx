import React, { useState } from 'react';
import { useMainTasks } from '../../hooks/tasks/useMainTasks';
import { Card } from '../../components/ui/Card';
import { FormSection } from '../../components/ui/FormSection';
import { Button } from '../../components/ui/Button';
import toast from 'react-hot-toast';

interface AddMainTaskFormProps {
  onSuccess?: () => void;
}

export const AddMainTaskForm: React.FC<AddMainTaskFormProps> = ({ onSuccess }) => {
  const { saveMainTask, isLoading } = useMainTasks();
  
  const [title, setTitle] = useState('');
  const [subTasks, setSubTasks] = useState<string[]>(['']); // Array of sub task titles, starts with 1 empty input

  const handleSubTaskChange = (index: number, value: string) => {
    const newSubTasks = [...subTasks];
    newSubTasks[index] = value;
    setSubTasks(newSubTasks);
  };

  const addSubTaskInput = () => {
    setSubTasks([...subTasks, '']);
  };

  const removeSubTaskInput = (index: number) => {
    const newSubTasks = [...subTasks];
    newSubTasks.splice(index, 1);
    setSubTasks(newSubTasks);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Please enter a Main Task Title');
      return;
    }

    const validSubTasks = subTasks.filter(st => st.trim() !== '');
    if (validSubTasks.length === 0) {
      toast.error('Please enter at least one valid sub task');
      return;
    }

    const success = await saveMainTask(title.trim(), validSubTasks);
    if (success) {
      toast.success('Main Task Group saved successfully!');
      setTitle('');
      setSubTasks(['']);
      if (onSuccess) onSuccess();
    }
  };

  const inputClass = "w-full bg-transparent border-2 border-border text-main rounded-lg px-4 py-2 text-base transition-velmora focus:outline-none focus:border-primary";

  return (
    <Card className="w-full max-w-3xl mx-auto flex flex-col gap-8 animate-in">
      <div className="border-b border-border pb-4">
        <h2 className="text-xl font-bold text-main">Add Main Task</h2>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <FormSection title="">
          <div className="flex flex-col gap-1 w-full mb-4">
            <label className="text-sm font-semibold text-muted ml-1">Main Task Title <span style={{color: 'red'}}>*</span></label>
            <input 
              type="text" 
              className={inputClass}
              placeholder="Enter Title (e.g. Planning Phase)"
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
              required 
            />
          </div>

          <div className="flex flex-col gap-3 w-full">
            {subTasks.map((st, index) => (
              <div key={index} className="flex items-end gap-2 w-full">
                <div className="flex flex-col gap-1 w-full">
                  <label className="text-sm font-semibold text-muted ml-1">Sub Task {index + 1} <span style={{color: 'red'}}>*</span></label>
                  <input 
                    type="text" 
                    className={inputClass}
                    placeholder="Enter sub task details"
                    value={st} 
                    onChange={(e) => handleSubTaskChange(index, e.target.value)} 
                    required 
                  />
                </div>
                {index > 0 && (
                  <button type="button" onClick={() => removeSubTaskInput(index)} className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors" style={{ height: '42px' }}>
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>

          <button 
            type="button" 
            onClick={addSubTaskInput}
            className="w-full py-2 mt-4 text-sm font-medium border border-dashed border-border rounded-lg text-muted hover:text-main hover:border-primary transition-colors"
          >
            + Add Another Sub Task
          </button>
        </FormSection>

        <div className="flex justify-end pt-4 border-t border-border mt-4">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Saving...' : 'Save Main Task'}
          </Button>
        </div>
      </form>
    </Card>
  );
};
