// src/components/Sidebar.tsx
import { Activity, LayoutDashboard, Package, LogOut } from 'lucide-react';

interface SidebarProps {
  currentView: 'dashboard' | 'inventory';
  setCurrentView: (view: 'dashboard' | 'inventory') => void;
  setFilterType: (type: 'all' | 'low_stock' | 'expiring') => void;
  logout: () => void;
}

export default function Sidebar({ currentView, setCurrentView, setFilterType, logout }: SidebarProps) {
  return (
    <aside style={{ 
      width: '250px', 
      minWidth: '250px',
      background: 'white', 
      borderRight: '1px solid var(--border)', 
      padding: '20px', 
      display: 'flex', 
      flexDirection: 'column',
      height: '100%' 
    }}>
      <h3 style={{ color: 'var(--primary)', marginBottom: '30px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Activity size={24} /> MedLinkNet
      </h3>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <button 
          onClick={() => { setCurrentView('dashboard'); setFilterType('all'); }}
          style={{ 
            display: 'flex', gap: '10px', padding: '10px', border: 'none', background: currentView === 'dashboard' ? '#e0f2fe' : 'transparent', 
            color: currentView === 'dashboard' ? 'var(--primary)' : '#64748b', borderRadius: '8px', cursor: 'pointer', fontWeight: 600
          }}
        >
          <LayoutDashboard size={20} /> Dashboard
        </button>
        <button 
          onClick={() => { setCurrentView('inventory'); setFilterType('all'); }}
          style={{ 
            display: 'flex', gap: '10px', padding: '10px', border: 'none', background: currentView === 'inventory' ? '#e0f2fe' : 'transparent', 
            color: currentView === 'inventory' ? 'var(--primary)' : '#64748b', borderRadius: '8px', cursor: 'pointer', fontWeight: 600
          }}
        >
          <Package size={20} /> Inventario
        </button>
      </nav>
      <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
        <button onClick={logout} style={{ display: 'flex', gap: '10px', alignItems: 'center', background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
          <LogOut size={18} /> Cerrar Sesión
        </button>
      </div>
    </aside>
  );
}