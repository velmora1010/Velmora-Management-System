"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './Sidebar.module.css';
import { LayoutDashboard, Image as ImageIcon, RefreshCcw, MapPin, Globe, Download } from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Image Upload & Extract', path: '/extract', icon: ImageIcon },
    { name: 'Tracking Sync', path: '/tracking', icon: RefreshCcw },
    { name: 'Tamil Nadu', path: '/tamil-nadu', icon: MapPin },
    { name: 'Other State', path: '/other-state', icon: Globe },
    { name: 'Export Data', path: '/export', icon: Download },
  ];

  return (
    <aside className={`${styles.sidebar} glass-panel`}>
      <div className={styles.logo}>
        <div className={styles.logoIcon}>ST</div>
        <h2>ST Courier <span>Analysis</span></h2>
      </div>
      <nav className={styles.nav}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.path;
          return (
            <Link 
              key={item.path} 
              href={item.path}
              className={`${styles.navItem} ${isActive ? styles.active : ''}`}
            >
              <Icon size={20} className={styles.icon} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
