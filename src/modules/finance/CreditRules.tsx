import { useState, useMemo } from 'react';
import { Plus, Trash2, Edit2, Power, PowerOff, Save, X } from 'lucide-react';
import { useCreditRules } from '../../hooks/finance/useCreditRules';
import { useFinanceCategories } from '../../hooks/finance/useFinanceCategories';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { CreditRule } from '../../utils/rules/CreditRuleEngine';
import toast from 'react-hot-toast';

export const CreditRules = () => {
  const { rules, isLoading: rulesLoading, saveRule, deleteRule, toggleRuleActive } = useCreditRules();
  const { categories, isLoading: catLoading } = useFinanceCategories();

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<Partial<CreditRule & { is_active: boolean }>>({
    keyword: '',
    main_category: '',
    sub_category1: '',
    sub_category2: '',
    priority: 100,
    is_active: true
  });

  const [ruleToDelete, setRuleToDelete] = useState<string | null>(null);

  // Cascading Categories from master tree
  const departments = useMemo(() => Array.from(new Set(categories.map(c => c.main).filter(Boolean))) as string[], [categories]);
  
  const currentSections = useMemo(() => {
    if (!formData.main_category) return [];
    return Array.from(new Set(categories.filter(c => c.main === formData.main_category).map(c => c.sub1).filter(Boolean))) as string[];
  }, [categories, formData.main_category]);

  const currentSub2s = useMemo(() => {
    if (!formData.main_category || !formData.sub_category1) return [];
    return Array.from(new Set(
      categories.filter(c => c.main === formData.main_category && c.sub1 === formData.sub_category1).map(c => c.sub2).filter(Boolean)
    )) as string[];
  }, [categories, formData.main_category, formData.sub_category1]);

  const handleEdit = (rule: any) => {
    setFormData({
      keyword: rule.keyword,
      main_category: rule.main_category || '',
      sub_category1: rule.sub_category1 || '',
      sub_category2: rule.sub_category2 || '',
      priority: rule.priority,
      is_active: rule.is_active
    });
    setEditingId(rule.id);
    setIsAdding(false);
  };

  const handleAddNew = () => {
    setFormData({
      keyword: '',
      main_category: '',
      sub_category1: '',
      sub_category2: '',
      priority: 100,
      is_active: true
    });
    setIsAdding(true);
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!formData.keyword?.trim()) {
      toast.error('Keyword is required');
      return;
    }
    try {
      await saveRule(editingId, formData);
      toast.success('Rule saved successfully');
      setIsAdding(false);
      setEditingId(null);
    } catch (e: any) {
      toast.error(e.message || 'Failed to save rule');
    }
  };

  const executeDelete = async () => {
    if (ruleToDelete) {
      await deleteRule(ruleToDelete);
      setRuleToDelete(null);
      toast.success('Rule deleted');
    }
  };

  if (rulesLoading || catLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-main">Credit Automation Rules</h3>
          <p className="text-sm text-muted mt-1">Manage keywords that automatically categorize incoming credits.</p>
        </div>
        {!isAdding && !editingId && (
          <button 
            onClick={handleAddNew}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium shadow-md shadow-primary/20 hover:brightness-110 transition-all"
          >
            <Plus size={16} /> Add Rule
          </button>
        )}
      </div>

      {(isAdding || editingId) && (
        <div className="bg-card border border-border/50 rounded-xl p-5 shadow-sm fade-in">
          <h4 className="text-sm font-semibold text-primary uppercase tracking-wider mb-4">
            {isAdding ? 'Create New Rule' : 'Edit Rule'}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted uppercase tracking-wider">Keyword *</label>
              <input
                type="text"
                placeholder="E.g. FLIPKART"
                value={formData.keyword}
                onChange={e => setFormData({ ...formData, keyword: e.target.value })}
                className="w-full bg-background border border-border text-main text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-primary"
              />
            </div>
            
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted uppercase tracking-wider">Main Category</label>
              <select
                value={formData.main_category || ''}
                onChange={e => setFormData({ ...formData, main_category: e.target.value, sub_category1: '', sub_category2: '' })}
                className="w-full bg-background border border-border text-main text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-primary"
              >
                <option value="">Select Main Category...</option>
                {departments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted uppercase tracking-wider">Sub Category 1</label>
              <select
                value={formData.sub_category1 || ''}
                onChange={e => setFormData({ ...formData, sub_category1: e.target.value, sub_category2: '' })}
                disabled={!formData.main_category}
                className="w-full bg-background border border-border text-main text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-primary disabled:opacity-50"
              >
                <option value="">Select Sub Category 1...</option>
                {currentSections.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted uppercase tracking-wider">Sub Category 2</label>
              <select
                value={formData.sub_category2 || ''}
                onChange={e => setFormData({ ...formData, sub_category2: e.target.value })}
                disabled={!formData.sub_category1}
                className="w-full bg-background border border-border text-main text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-primary disabled:opacity-50"
              >
                <option value="">Select Sub Category 2...</option>
                {currentSub2s.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted uppercase tracking-wider">Priority (Lower = Higher)</label>
              <input
                type="number"
                value={formData.priority}
                onChange={e => setFormData({ ...formData, priority: parseInt(e.target.value) || 100 })}
                className="w-full bg-background border border-border text-main text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-primary"
              />
            </div>
            
            <div className="flex items-end gap-2 pt-1 lg:col-span-1">
              <button 
                onClick={handleSave}
                className="flex-1 flex items-center justify-center gap-2 bg-primary text-white py-2 rounded-lg text-sm font-medium shadow-md shadow-primary/20 hover:brightness-110 transition-all"
              >
                <Save size={16} /> Save
              </button>
              <button 
                onClick={() => { setIsAdding(false); setEditingId(null); }}
                className="flex-1 flex items-center justify-center gap-2 bg-background border border-border text-main py-2 rounded-lg text-sm font-medium hover:bg-black/5 dark:hover:bg-white/5 transition-all"
              >
                <X size={16} /> Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {rules.length === 0 && !isAdding && (
        <div className="flex flex-col items-center justify-center p-12 text-center bg-card rounded-2xl border border-border/50 shadow-sm">
           <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center text-3xl mb-4">
             🤖
           </div>
           <h3 className="text-xl font-semibold text-main mb-2">No rules found</h3>
           <p className="text-muted max-w-md mb-6">
             Create rules to automatically categorize credit transactions based on their descriptions.
           </p>
           <button 
             onClick={handleAddNew}
             className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-primary/20 hover:brightness-110 transition-all"
           >
             <Plus size={18} /> Create First Rule
           </button>
        </div>
      )}

      {rules.length > 0 && (
        <div className="bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border/50 bg-background/50">
                  <th className="py-3 px-4 text-xs font-bold text-muted uppercase tracking-wider">Priority</th>
                  <th className="py-3 px-4 text-xs font-bold text-muted uppercase tracking-wider">Keyword</th>
                  <th className="py-3 px-4 text-xs font-bold text-muted uppercase tracking-wider">Mapping</th>
                  <th className="py-3 px-4 text-xs font-bold text-muted uppercase tracking-wider">Status</th>
                  <th className="py-3 px-4 text-xs font-bold text-muted uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule: any) => (
                  <tr key={rule.id} className="border-b border-border/10 hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4">
                      <span className="text-xs font-mono font-medium bg-background px-2 py-1 rounded text-muted border border-border/50">
                        {rule.priority}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-main">{rule.keyword}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-main">{rule.main_category || <span className="text-muted italic">Uncategorized</span>}</span>
                        {(rule.sub_category1 || rule.sub_category2) && (
                          <span className="text-xs text-muted mt-0.5 flex items-center gap-1">
                            {rule.sub_category1} 
                            {rule.sub_category2 && <span className="opacity-50">›</span>} 
                            {rule.sub_category2}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md border ${
                        rule.is_active 
                          ? 'bg-green-500/10 text-green-500 border-green-500/20' 
                          : 'bg-red-500/10 text-red-500 border-red-500/20'
                      }`}>
                        {rule.is_active ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => toggleRuleActive(rule.id, rule.is_active)}
                          title={rule.is_active ? "Disable Rule" : "Enable Rule"}
                          className={`p-1.5 rounded-md transition-colors ${
                            rule.is_active 
                              ? 'text-muted hover:text-orange-400 hover:bg-orange-400/10' 
                              : 'text-muted hover:text-green-400 hover:bg-green-400/10'
                          }`}
                        >
                          {rule.is_active ? <PowerOff size={16} /> : <Power size={16} />}
                        </button>
                        <button 
                          onClick={() => handleEdit(rule)}
                          title="Edit Rule"
                          className="p-1.5 text-muted hover:text-primary rounded-md hover:bg-primary/10 transition-colors"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => { setRuleToDelete(rule.id); }}
                          title="Delete Rule"
                          className="p-1.5 text-muted hover:text-red-500 rounded-md hover:bg-red-500/10 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!ruleToDelete}
        title="Delete Rule"
        message="Are you sure you want to delete this credit rule? This cannot be undone."
        confirmText="Delete"
        onConfirm={executeDelete}
        onClose={() => setRuleToDelete(null)}
      />
    </div>
  );
};
