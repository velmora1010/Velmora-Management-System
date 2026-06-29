"use client";

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db';
import styles from '../tracking/sync.module.css';

export default function TamilNaduPage() {
  const shipments = useLiveQuery(() => 
    db.shipments.filter(s => s.department === 'Tamil Nadu').toArray()
  ) || [];

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1>Tamil Nadu Department</h1>
          <p>Showing all shipments routed to Tamil Nadu.</p>
        </div>
        <div className={styles.actions}>
          <div className="badge badge-success" style={{fontSize: '1rem', padding: '0.5rem 1rem'}}>
            Total: {shipments.length}
          </div>
        </div>
      </header>

      <div className={`glass-panel ${styles.tableWrapper}`}>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Order ID</th>
                <th>AWB Number</th>
                <th>Status</th>
                <th>Location</th>
                <th>Tracking Date/Time</th>
                <th>Last Synced</th>
              </tr>
            </thead>
            <tbody>
              {shipments.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{textAlign: 'center', padding: '2rem'}}>
                    No shipments found in Tamil Nadu department.
                  </td>
                </tr>
              ) : shipments.map((item) => (
                <tr key={item.awb}>
                  <td>{item.orderId || '-'}</td>
                  <td style={{fontFamily: 'monospace'}}>{item.awb}</td>
                  <td>
                    <span className={`badge ${
                      item.status.includes('Delivered') ? 'badge-success' : 
                      (item.status.includes('Transit') || item.status.includes('Out for Delivery')) ? 'badge-warning' : 
                      item.status.includes('Failed') || item.status.includes('Not Found') ? 'badge-danger' : 'badge-neutral'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                  <td>{item.lastLocation}</td>
                  <td>{item.trackingDateTime}</td>
                  <td style={{fontSize: '0.85rem', color: 'var(--text-secondary)'}}>
                    {item.lastSyncedAt > 0 ? new Date(item.lastSyncedAt).toLocaleString() : 'Never'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
