import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import styles from './AppShell.module.css';

export default function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className={styles.shell}>
      <Navbar onToggleSidebar={() => setSidebarOpen(s => !s)} />
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className={styles.main}>
        <div className={styles.content}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
