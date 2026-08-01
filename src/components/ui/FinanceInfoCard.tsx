import { Edit2, Trash2 } from 'lucide-react';

export interface FinanceInfoCardField {
  label: string;
  value: React.ReactNode;
}

export interface FinanceInfoCardProps {
  title: string;
  subtitle: string;
  badges?: string[];
  fields: FinanceInfoCardField[];
  onEdit?: () => void;
  onDelete?: () => void;
  editTooltip?: string;
  deleteTooltip?: string;
  
  // Edit Mode
  isEditing?: boolean;
  onCancelEdit?: () => void;
  renderEditForm?: () => React.ReactNode;
  formId?: string;
  className?: string;
}

export const FinanceInfoCard = ({
  title,
  subtitle,
  badges = [],
  fields,
  onEdit,
  onDelete,
  editTooltip = "Edit",
  deleteTooltip = "Delete",
  isEditing = false,
  onCancelEdit,
  renderEditForm,
  formId,
  className = ""
}: FinanceInfoCardProps) => {
  
  // Split fields into two columns for desktop/tablet layout
  const midPoint = Math.ceil(fields.length / 2);
  const leftColFields = fields.slice(0, midPoint);
  const rightColFields = fields.slice(midPoint);

  return (
    <div className={`bg-card border border-border/50 rounded-2xl shadow-sm hover:border-border transition-colors group p-6 fade-in ${className}`}>
      {/* Top Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="text-lg font-bold text-main leading-tight">
            {isEditing ? `Edit Mode` : title}
          </h3>
          {!isEditing && <p className="text-sm text-muted mt-1 font-medium">{subtitle}</p>}
        </div>
        
        <div className="flex items-center gap-2 shrink-0">
          {!isEditing ? (
            <>
              {onEdit && (
                <button
                  onClick={onEdit}
                  className="p-2 text-muted hover:text-primary bg-background border border-transparent hover:border-primary/20 rounded-lg hover:bg-primary/10 transition-colors"
                  title={editTooltip}
                >
                  <Edit2 size={18} />
                </button>
              )}
              {onDelete && (
                <button
                  onClick={onDelete}
                  className="p-2 text-muted hover:text-red-500 bg-background border border-transparent hover:border-red-500/20 rounded-lg hover:bg-red-500/10 transition-colors"
                  title={deleteTooltip}
                >
                  <Trash2 size={18} />
                </button>
              )}
            </>
          ) : (
            <>
              <button
                type="submit"
                form={formId}
                className="px-4 py-1.5 rounded-lg text-sm font-medium bg-primary text-white shadow-md shadow-primary/20 hover:brightness-110 transition-colors"
              >
                Save
              </button>
              <button
                type="button"
                onClick={onCancelEdit}
                className="px-4 py-1.5 rounded-lg text-sm font-medium bg-background border border-border text-main hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {isEditing && renderEditForm ? (
        <div className="mt-6 border-t border-border/50 pt-6 fade-in">
          {renderEditForm()}
        </div>
      ) : (
        <>
          {/* Badges */}
      {badges.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-6">
          {badges.map((badge, idx) => (
            <span
              key={idx}
              className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider rounded-md bg-primary/10 text-primary border border-primary/20"
            >
              {badge}
            </span>
          ))}
        </div>
      )}

      {/* Divider */}
      <div className="h-px bg-border/50 w-full mb-6"></div>

      {/* Content - 2 Column Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
        {/* Left Column */}
        <div className="flex flex-col gap-6">
          {leftColFields.map((field, idx) => (
            <div key={`left-${idx}`}>
              <div className="text-[11px] font-bold text-muted uppercase tracking-wider mb-1.5">{field.label}</div>
              <div className="text-base font-semibold text-main break-words leading-tight">{field.value || '-'}</div>
            </div>
          ))}
        </div>
        
        {/* Right Column */}
        <div className="flex flex-col gap-6">
          {rightColFields.map((field, idx) => (
            <div key={`right-${idx}`}>
              <div className="text-[11px] font-bold text-muted uppercase tracking-wider mb-1.5">{field.label}</div>
              <div className="text-base font-semibold text-main break-words leading-tight">{field.value || '-'}</div>
            </div>
          ))}
        </div>
      </div>
        </>
      )}
    </div>
  );
};
