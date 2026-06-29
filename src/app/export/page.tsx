"use client";

import { useState } from 'react';
import { db } from '../../lib/db';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { Download, FileSpreadsheet, FileText, Database } from 'lucide-react';
import styles from '../dashboard/dashboard.module.css'; // Reusing dashboard grid styles for simplicity

export default function ExportPage() {
  const [isExporting, setIsExporting] = useState(false);

  const exportData = async (departmentFilter: string | null, format: 'csv' | 'excel') => {
    setIsExporting(true);
    try {
      let data = await db.shipments.toArray();
      
      if (departmentFilter) {
        data = data.filter(d => d.department === departmentFilter);
      }

      const formattedData = data.map(d => ({
        'Order ID': d.orderId,
        'AWB Number': d.awb,
        'Status': d.status,
        'State': d.state,
        'Location': d.lastLocation,
        'Tracking Date/Time': d.trackingDateTime,
        'Department': d.department,
        'Last Synced': d.lastSyncedAt > 0 ? new Date(d.lastSyncedAt).toLocaleString() : 'Never'
      }));

      const filename = `ST_Courier_${departmentFilter ? departmentFilter.replace(' ', '_') : 'All_Data'}_${new Date().toISOString().split('T')[0]}`;

      if (format === 'csv') {
        const csv = Papa.unparse(formattedData);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${filename}.csv`;
        link.click();
      } else {
        const worksheet = XLSX.utils.json_to_sheet(formattedData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Shipments");
        XLSX.writeFile(workbook, `${filename}.xlsx`);
      }
    } catch (e) {
      console.error('Export failed', e);
      alert('Failed to export data.');
    }
    setIsExporting(false);
  };

  const exportOptions = [
    { title: 'All Data', filter: null, icon: Database, color: 'var(--accent-color)' },
    { title: 'Tamil Nadu Only', filter: 'Tamil Nadu', icon: Database, color: '#8b5cf6' },
    { title: 'Other State Only', filter: 'Other State', icon: Database, color: '#ec4899' },
  ];

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1>Export Data</h1>
          <p>Download your tracking data in CSV or Excel format.</p>
        </div>
      </header>

      <div className={styles.grid}>
        {exportOptions.map((opt, i) => {
          const Icon = opt.icon;
          return (
            <div key={i} className={`glass-panel ${styles.card}`} style={{flexDirection: 'column', alignItems: 'flex-start', gap: '1rem'}}>
              <div style={{display: 'flex', alignItems: 'center', gap: '1rem'}}>
                <div className={styles.cardIcon} style={{ background: `${opt.color}20`, color: opt.color }}>
                  <Icon size={24} />
                </div>
                <h3>{opt.title}</h3>
              </div>
              <div style={{display: 'flex', gap: '0.5rem', width: '100%', marginTop: '1rem'}}>
                <button 
                  className="btn" 
                  style={{flex: 1, justifyContent: 'center'}}
                  onClick={() => exportData(opt.filter, 'csv')}
                  disabled={isExporting}
                >
                  <FileText size={18} /> CSV
                </button>
                <button 
                  className="btn" 
                  style={{flex: 1, justifyContent: 'center', background: '#10b981'}}
                  onClick={() => exportData(opt.filter, 'excel')}
                  disabled={isExporting}
                >
                  <FileSpreadsheet size={18} /> Excel
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
