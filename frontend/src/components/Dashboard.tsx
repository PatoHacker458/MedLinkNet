import { Package, AlertTriangle, TrendingDown, User } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// CORRECCIÓN: Agregar 'type'
import type { DashboardStats, Product, Batch } from '../types';

interface DashboardProps {
  stats: DashboardStats;
  products: Product[];
  setFilterType: (type: 'all' | 'low_stock' | 'expiring') => void;
  setCurrentView: (view: 'dashboard' | 'inventory') => void;
}

export default function Dashboard({ stats, products, setFilterType, setCurrentView }: DashboardProps) {
  const getTotalStock = (batches: Batch[]) => batches.reduce((acc, b) => acc + b.quantity, 0);
  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('es-MX', {day: '2-digit', month: '2-digit', hour: '2-digit', minute:'2-digit'});

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ marginBottom: '30px' }}>
        <h1 style={{ fontSize: '1.8rem', color: '#1e293b' }}>Resumen General</h1>
        <p style={{ color: '#64748b' }}>Estado del inventario en tiempo real</p>
      </header>

      {/* KPI CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '40px' }}>
        <div className="card" onClick={() => { setFilterType('all'); setCurrentView('inventory'); }} style={{ display: 'flex', alignItems: 'center', gap: '20px', borderLeft: '4px solid var(--primary)', cursor: 'pointer' }}>
          <div style={{ background: '#e0f2fe', padding: '15px', borderRadius: '50%', color: 'var(--primary)' }}><Package size={24} /></div>
          <div><h3 style={{ margin: 0, fontSize: '2rem' }}>{stats.total_products}</h3><span style={{ color: '#64748b', fontSize: '0.9rem' }}>Inventario Total</span></div>
        </div>
        <div className="card" onClick={() => { setFilterType('low_stock'); setCurrentView('inventory'); }} style={{ display: 'flex', alignItems: 'center', gap: '20px', borderLeft: '4px solid var(--warning)', cursor: 'pointer' }}>
          <div style={{ background: '#fef3c7', padding: '15px', borderRadius: '50%', color: 'var(--warning)' }}><AlertTriangle size={24} /></div>
          <div><h3 style={{ margin: 0, fontSize: '2rem' }}>{stats.low_stock}</h3><span style={{ color: '#64748b', fontSize: '0.9rem' }}>Bajo Stock (Ver)</span></div>
        </div>
        <div className="card" onClick={() => { setFilterType('expiring'); setCurrentView('inventory'); }} style={{ display: 'flex', alignItems: 'center', gap: '20px', borderLeft: '4px solid var(--danger)', cursor: 'pointer' }}>
          <div style={{ background: '#fee2e2', padding: '15px', borderRadius: '50%', color: 'var(--danger)' }}><TrendingDown size={24} /></div>
          <div><h3 style={{ margin: 0, fontSize: '2rem' }}>{stats.expiring_batches}</h3><span style={{ color: '#64748b', fontSize: '0.9rem' }}>Por Vencer (Ver)</span></div>
        </div>
      </div>

      {/* CHARTS */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        <div className="card">
          <h3 style={{ marginBottom: '20px' }}>Top Stock Actual</h3>
          <div style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={products.slice(0, 5).map(p => ({ name: p.name, stock: getTotalStock(p.batches) }))}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{fontSize: 12}} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="stock" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: '20px' }}>Actividad Reciente</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {stats.recent_transactions.length === 0 ? <p style={{color:'#999'}}>Sin movimientos</p> : (
              stats.recent_transactions.map(t => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem' }}>
                  <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: t.transaction_type === 'IN' ? 'var(--success-bg)' : 'var(--danger-bg)', color: t.transaction_type === 'IN' ? 'var(--success)' : 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                    {t.transaction_type === 'IN' ? '+' : '-'}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600 }}>{t.transaction_type === 'IN' ? 'Ingreso' : 'Salida'} de {t.quantity}u</div>
                    <div style={{ color: '#64748b', fontSize: '0.8rem' }}><User size={12} style={{display:'inline', marginRight:'4px'}}/>{t.username} • {formatDate(t.timestamp)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}