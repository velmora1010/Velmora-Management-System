"use client";

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db';
import { Package, Truck, CheckCircle, AlertCircle, MapPin, Globe, Clock } from 'lucide-react';
import styles from './dashboard.module.css';
import { useEffect, useState } from 'react';

export default function Dashboard() {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  const stats = useLiveQuery(async () => {
    const all = await db.shipments.toArray();
    
    let delivered = 0;
    let inTransit = 0;
    let pending = 0;
    let tnCount = 0;
    let otherCount = 0;
    let lastSync = 0;

    all.forEach(s => {
      const status = s.status.toLowerCase();
      if (status.includes('delivered')) delivered++;
      else if (status.includes('transit') || status.includes('dispatched') || status.includes('out for delivery')) inTransit++;
      else pending++;

      if (s.department === 'Tamil Nadu') tnCount++;
      else if (s.department === 'Other State') otherCount++;

      if (s.lastSyncedAt > lastSync) lastSync = s.lastSyncedAt;
    });

    return {
      total: all.length,
      delivered,
      inTransit,
      pending,
      tnCount,
      otherCount,
      lastSync
    };
  });

  if (!mounted) return null;

  const data = stats || { total: 0, delivered: 0, inTransit: 0, pending: 0, tnCount: 0, otherCount: 0, lastSync: 0 };

  const cards = [
    { title: 'Total Uploaded', value: data.total, icon: Package, color: 'var(--accent-color)' },
    { title: 'Delivered', value: data.delivered, icon: CheckCircle, color: 'var(--success)' },
    { title: 'In Transit', value: data.inTransit, icon: Truck, color: 'var(--warning)' },
    { title: 'Pending / Not Found', value: data.pending, icon: AlertCircle, color: 'var(--danger)' },
    { title: 'Tamil Nadu Orders', value: data.tnCount, icon: MapPin, color: '#8b5cf6' },
    { title: 'Other State Orders', value: data.otherCount, icon: Globe, color: '#ec4899' },
  ];

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1>Dashboard Overview</h1>
          <p>Real-time analytics for ST Courier tracking.</p>
        </div>
        {data.lastSync > 0 && (
          <div className={styles.lastSync}>
            <Clock size={16} />
            Last Sync: {new Date(data.lastSync).toLocaleString()}
          </div>
        )}
      </header>

      <div className={styles.grid}>
        {cards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div key={i} className={`glass-panel ${styles.card}`}>
              <div className={styles.cardIcon} style={{ background: `${card.color}20`, color: card.color }}>
                <Icon size={24} />
              </div>
              <div className={styles.cardInfo}>
                <h3>{card.title}</h3>
                <p className={styles.value}>{card.value}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
