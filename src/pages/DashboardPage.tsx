import { useState, useMemo, useCallback } from 'react';
import { RotateCcw, Building2, Layers, X } from 'lucide-react';
import { useExecutiveDashboard } from '../hooks/analytics/useExecutiveDashboard';
import { KPICards } from '../modules/dashboard/KPICards';
import { ExecCharts } from '../modules/dashboard/ExecCharts';
import { RecentActivity } from '../modules/dashboard/RecentActivity';

// ── Helpers ───────────────────────────────────────────────────────────────────

const SELECT_STYLE: React.CSSProperties = {
  padding: '8px 14px',
  borderRadius: 12,
  border: '1px solid #334155',
  background: '#1e293b',
  color: 'white',
  fontSize: 13,
  outline: 'none',
  cursor: 'pointer',
  minWidth: 155,
};

const BTN_STYLE: React.CSSProperties = {
  padding: '8px 14px',
  borderRadius: 12,
  border: '1px solid #334155',
  background: '#1e293b',
  color: '#94a3b8',
  fontSize: 13,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  transition: 'color 0.15s',
};

// ── DeptSection Panel ─────────────────────────────────────────────────────────

interface DeptPanelProps {
  departments: { id: number; department_name: string; status: string }[];
  sections: { id: number; department_id: number; section_name: string; section_code?: string | null; status: string }[];
  selectedDeptId: string;
  selectedSectionId: string;
  onSelectDept: (id: string) => void;
  onSelectSection: (id: string) => void;
  isLoading: boolean;
}

const DeptSectionPanel = ({
  departments, sections, selectedDeptId, selectedSectionId,
  onSelectDept, onSelectSection, isLoading,
}: DeptPanelProps) => {
  const filteredSections = useMemo(
    () => sections.filter(s => String(s.department_id) === selectedDeptId),
    [sections, selectedDeptId],
  );

  return (
    <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 20, padding: 24, display: 'flex', flexDirection: 'column', minHeight: 320 }}>
      <h3 style={{ color: '#f1f5f9', fontSize: 15, fontWeight: 700, margin: '0 0 18px 0' }}>
        {selectedDeptId
          ? `${departments.find(d => String(d.id) === selectedDeptId)?.department_name ?? 'Department'} — Sections`
          : 'Department Overview'}
      </h3>

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ height: 46, borderRadius: 12, background: '#0f172a', animation: 'pulse 2s ease infinite' }} />
          ))}
        </div>
      ) : !selectedDeptId ? (
        /* ── Department List ── */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', maxHeight: 480 }}>
          {departments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: '#475569', fontSize: 13 }}>No departments found</div>
          ) : departments.map(d => {
            const secCount = sections.filter(s => String(s.department_id) === String(d.id)).length;
            return (
              <button
                key={d.id}
                id={`dept-panel-btn-${d.id}`}
                onClick={() => onSelectDept(String(d.id))}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 16px', background: '#0f172a', borderRadius: 12, border: '1px solid #1e293b', cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left', width: '100%' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#334155'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#1e293b'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.status === 'Active' ? '#4ade80' : '#64748b', flexShrink: 0 }} />
                  <span style={{ color: '#f1f5f9', fontSize: 13, fontWeight: 500 }}>{d.department_name}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: '#64748b', fontSize: 12 }}>{secCount} sec{secCount !== 1 ? 's' : ''}</span>
                  <Building2 size={13} color="#475569" />
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        /* ── Section List ── */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={() => { onSelectDept(''); onSelectSection(''); }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 12, marginBottom: 4 }}
          >
            ← All Departments
          </button>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', maxHeight: 440 }}>
            {filteredSections.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 32, color: '#475569', fontSize: 13 }}>No sections in this department</div>
            ) : filteredSections.map(s => {
              const isActive = selectedSectionId === String(s.id);
              return (
                <button
                  key={s.id}
                  id={`sec-panel-btn-${s.id}`}
                  onClick={() => onSelectSection(isActive ? '' : String(s.id))}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 16px', background: isActive ? 'rgba(96,165,250,0.08)' : '#0f172a', borderRadius: 12, border: `1px solid ${isActive ? 'rgba(96,165,250,0.35)' : '#1e293b'}`, cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left', width: '100%' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Layers size={14} color={isActive ? '#60a5fa' : '#475569'} />
                    <span style={{ color: isActive ? '#93c5fd' : '#f1f5f9', fontSize: 13, fontWeight: isActive ? 600 : 400 }}>{s.section_name}</span>
                  </div>
                  <span style={{ color: '#475569', fontSize: 11 }}>{s.section_code ?? ''}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────

export const DashboardPage = () => {
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState('');

  // ── THE single hook call — all data comes from here ──
  const { data, isLoading, error, refresh } = useExecutiveDashboard(selectedDeptId, selectedSectionId);

  const { departments, sections } = data;

  // Sections matching current dept dropdown
  const filteredSections = useMemo(
    () => sections.filter(s => String(s.department_id) === selectedDeptId),
    [sections, selectedDeptId],
  );

  const handleDeptChange = useCallback((deptId: string) => {
    setSelectedDeptId(deptId);
    setSelectedSectionId(''); // Reset section when dept changes
  }, []);

  const clearFilters = useCallback(() => {
    setSelectedDeptId('');
    setSelectedSectionId('');
  }, []);

  const selectedDept    = departments.find(d => String(d.id) === selectedDeptId);
  const selectedSection = sections.find(s => String(s.id) === selectedSectionId);
  const hasFilter       = Boolean(selectedDeptId || selectedSectionId);

  return (
    <div className="w-full max-w-screen-2xl mx-auto space-y-7 pb-10 animate-in fade-in duration-300">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Executive Dashboard</h1>
          <p className="text-sm mt-1" style={{ color: '#64748b' }}>
            {selectedDept
              ? `${selectedDept.department_name}${selectedSection ? ` › ${selectedSection.section_name}` : ''} — Live Overview`
              : 'All Departments — Live Business Overview'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Dept dropdown */}
          <label htmlFor="exec-dept-filter" className="sr-only">Department</label>
          <select
            id="exec-dept-filter"
            value={selectedDeptId}
            onChange={e => handleDeptChange(e.target.value)}
            disabled={isLoading}
            style={{ ...SELECT_STYLE, opacity: isLoading ? 0.6 : 1 }}
          >
            <option value="">All Departments</option>
            {departments.map(d => (
              <option key={d.id} value={String(d.id)}>{d.department_name}</option>
            ))}
          </select>

          {/* Section dropdown */}
          <label htmlFor="exec-section-filter" className="sr-only">Section</label>
          <select
            id="exec-section-filter"
            value={selectedSectionId}
            onChange={e => setSelectedSectionId(e.target.value)}
            disabled={!selectedDeptId || isLoading}
            style={{ ...SELECT_STYLE, opacity: !selectedDeptId || isLoading ? 0.5 : 1 }}
          >
            <option value="">{selectedDeptId ? 'All Sections' : 'Select Dept First'}</option>
            {filteredSections.map(s => (
              <option key={s.id} value={String(s.id)}>{s.section_name}</option>
            ))}
          </select>

          {/* Refresh */}
          <button
            id="exec-dashboard-refresh"
            onClick={refresh}
            disabled={isLoading}
            style={{ ...BTN_STYLE, opacity: isLoading ? 0.6 : 1 }}
            title="Refresh dashboard"
          >
            <RotateCcw
              size={14}
              style={{ animation: isLoading ? 'spin 0.8s linear infinite' : 'none' }}
            />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 12, padding: '14px 18px', color: '#fca5a5', fontSize: 13 }}>
          ⚠️ {error}
        </div>
      )}

      {/* ── Active filter chips ── */}
      {hasFilter && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#64748b' }}>Filtered by:</span>
          {selectedDept && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 12px', borderRadius: 20, background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.25)', color: '#93c5fd', fontSize: 12, fontWeight: 600 }}>
              <Building2 size={12} /> {selectedDept.department_name}
            </span>
          )}
          {selectedSection && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 12px', borderRadius: 20, background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.25)', color: '#c4b5fd', fontSize: 12, fontWeight: 600 }}>
              <Layers size={12} /> {selectedSection.section_name}
            </span>
          )}
          <button
            id="exec-clear-filters"
            onClick={clearFilters}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20, background: 'transparent', border: '1px solid #334155', color: '#64748b', fontSize: 12, cursor: 'pointer' }}
          >
            <X size={11} /> Clear
          </button>
        </div>
      )}

      {/* ── 14 KPI Cards ── */}
      <KPICards kpis={data.kpis} isLoading={isLoading} />

      {/* ── 7 Charts ── */}
      <ExecCharts charts={data.charts} isLoading={isLoading} />

      {/* ── Bottom row: Recent Activity + Dept/Section Panel ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <RecentActivity items={data.recentActivity} isLoading={isLoading} />
        <DeptSectionPanel
          departments={departments}
          sections={sections}
          selectedDeptId={selectedDeptId}
          selectedSectionId={selectedSectionId}
          onSelectDept={handleDeptChange}
          onSelectSection={setSelectedSectionId}
          isLoading={isLoading}
        />
      </div>

    </div>
  );
};
