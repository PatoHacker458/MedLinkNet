import { useEffect, useState } from 'react'
import { 
  LayoutDashboard, Package, AlertTriangle, TrendingDown, 
  Activity, Search, LogOut, Plus, User, Trash2, RotateCcw, XCircle
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import './App.css'

// --- INTERFACES ---
interface Batch {
  id: number;
  batch_number: string;
  expiration_date: string;
  quantity: number;
}

interface Transaction {
  id: number;
  transaction_type: string;
  quantity: number;
  timestamp: string;
  batch_id: number;
  username: string;
  product_id: number;
}

interface Product {
  id: number;
  name: string;
  sku: string;
  min_stock: number;
  batches: Batch[];
}

interface DashboardStats {
  total_products: number;
  low_stock: number;
  expiring_batches: number;
  recent_transactions: Transaction[];
}

const API_URL = "http://100.78.67.58:8800";

function App() {
  // --- STATES ---
  const [token, setToken] = useState<string | null>(localStorage.getItem('hospital_token'))
  const [currentView, setCurrentView] = useState<'dashboard' | 'inventory'>('dashboard')
  
  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'low_stock' | 'expiring'>('all')

  // Login States
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')

  // Data States
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  
  // Forms States
  const [newProd, setNewProd] = useState({ name: '', sku: '', min_stock: 10 })
  const [batchForms, setBatchForms] = useState<{ [key: number]: { qty: string, exp: string, num: string } }>({})
  const [dispenseQty, setDispenseQty] = useState<{ [key: number]: string }>({})
  const [history, setHistory] = useState<{ [key: number]: Transaction[] }>({})
  const [showHistory, setShowHistory] = useState<{ [key: number]: boolean }>({})

  // --- API HELPERS ---
  const authFetch = async (endpoint: string, options: RequestInit = {}) => {
    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    }
    try {
      const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers })
      if (response.status === 401) { logout(); return null; }
      return response
    } catch (error) {
      console.error("Network error", error)
      return null
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError('')
    const formData = new URLSearchParams()
    formData.append('username', username); formData.append('password', password)

    try {
      const response = await fetch(`${API_URL}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData
      })
      if (!response.ok) throw new Error('Credenciales inválidas')
      const data = await response.json()
      localStorage.setItem('hospital_token', data.access_token)
      setToken(data.access_token)
    } catch (err) { setLoginError('Acceso denegado') }
  }

  const logout = () => {
    localStorage.removeItem('hospital_token')
    setToken(null)
  }

  // --- DATA FETCHING ---
  const fetchData = async () => {
    setLoading(true)
    const prodRes = await authFetch('/products/')
    if (prodRes?.ok) setProducts(await prodRes.json())

    const statsRes = await authFetch('/dashboard')
    if (statsRes?.ok) setStats(await statsRes.json())
    setLoading(false)
  }

  const fetchHistory = async (productId: number) => {
    if (showHistory[productId]) {
      setShowHistory({ ...showHistory, [productId]: false }); return
    }
    const response = await authFetch(`/transactions/${productId}`)
    if (response?.ok) {
      const data = await response.json()
      setHistory({ ...history, [productId]: data })
      setShowHistory({ ...showHistory, [productId]: true })
    }
  }

  // --- ACTIONS (CREATE, DELETE, REVERT) ---
  
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newProd.name) return;
    await authFetch('/products/', { method: 'POST', body: JSON.stringify(newProd) })
    setNewProd({ name: '', sku: '', min_stock: 10 }); fetchData()
  }

  // 1. ELIMINAR PRODUCTO
  const handleDeleteProduct = async (id: number) => {
    if(!confirm("¿Seguro que deseas eliminar este producto y todo su historial?")) return;
    await authFetch(`/products/${id}`, { method: 'DELETE' })
    fetchData()
  }

  const handleAddBatch = async (productId: number) => {
    const form = batchForms[productId]
    if (!form?.qty) return;
    await authFetch(`/products/${productId}/batches/`, {
      method: 'POST',
      body: JSON.stringify({ batch_number: form.num, expiration_date: form.exp, quantity: parseInt(form.qty) })
    })
    setBatchForms({ ...batchForms, [productId]: { qty: '', exp: '', num: '' } }); fetchData()
  }

  // 2. ELIMINAR LOTE
  const handleDeleteBatch = async (batchId: number) => {
    if(!confirm("¿Eliminar este lote? Se ajustará el stock total.")) return;
    await authFetch(`/batches/${batchId}`, { method: 'DELETE' })
    fetchData()
  }

  const handleDispense = async (productId: number) => {
    const qty = dispenseQty[productId]
    if (!qty) return;
    await authFetch(`/products/${productId}/dispense/`, {
      method: 'POST',
      body: JSON.stringify({ quantity: parseInt(qty) })
    })
    setDispenseQty({ ...dispenseQty, [productId]: '' }); fetchData()
    // Si el historial está abierto, refrescarlo para ver la salida
    if (showHistory[productId]) fetchHistory(productId)
  }

  // 3. REVERTIR TRANSACCIÓN
  const handleRevert = async (txId: number, productId: number) => {
    if(!confirm("¿Revertir esta salida? El stock volverá al lote original.")) return;
    const res = await authFetch(`/transactions/${txId}/revert`, { method: 'POST' })
    if(res?.ok) {
      alert("Transacción revertida exitosamente")
      fetchHistory(productId) // Refrescar historial
      fetchData() // Refrescar stock global
    } else {
      alert("No se pudo revertir (quizás el lote ya no existe)")
    }
  }

  // --- UTILS ---
  const getTotalStock = (batches: Batch[]) => batches.reduce((acc, b) => acc + b.quantity, 0)
  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('es-MX', {day: '2-digit', month: '2-digit', hour: '2-digit', minute:'2-digit'})

  useEffect(() => { if (token) fetchData() }, [token])

  // --- RENDER LOGIN ---
  if (!token) {
    return (
      <div className="login-container">
        <div className="login-card">
          <h2 style={{color:'var(--primary)'}}>🏥 MedLinkNet</h2>
          <form onSubmit={handleLogin}>
            <input className="login-input" type="text" placeholder="Usuario" value={username} onChange={e => setUsername(e.target.value)}/>
            <input className="login-input" type="password" placeholder="Contraseña" value={password} onChange={e => setPassword(e.target.value)}/>
            {loginError && <p style={{color:'var(--danger)'}}>{loginError}</p>}
            <button type="submit" className="btn-primary">Entrar</button>
          </form>
        </div>
      </div>
    )
  }

  // --- RENDER APP ---
  return (
    // FIX 1: Layout Container con Altura Fija y Hidden Overflow
    <div style={{ display: 'flex', height: '100vh', width: '100vw', background: 'var(--bg-app)', overflow: 'hidden' }}>
      
      {/* SIDEBAR FIJO (Solo tiene scroll interno si es necesario) */}
      <aside style={{ 
        width: '250px', 
        minWidth: '250px',
        background: 'white', 
        borderRight: '1px solid var(--border)', 
        padding: '20px', 
        display: 'flex', 
        flexDirection: 'column',
        overflowY: 'auto',
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

      {/* MAIN CONTENT CON SCROLL INDEPENDIENTE */}
      <main style={{ flex: 1, padding: '30px', overflowY: 'auto', height: '100%' }}>
        
        {/* VISTA DASHBOARD */}
        {currentView === 'dashboard' && stats && (
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <header style={{ marginBottom: '30px' }}>
              <h1 style={{ fontSize: '1.8rem', color: '#1e293b' }}>Resumen General</h1>
              <p style={{ color: '#64748b' }}>Estado del inventario en tiempo real</p>
            </header>

            {/* KPI CARDS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '40px' }}>
              
              <div 
                className="card" 
                onClick={() => { setFilterType('all'); setCurrentView('inventory'); }}
                style={{ display: 'flex', alignItems: 'center', gap: '20px', borderLeft: '4px solid var(--primary)', cursor: 'pointer' }}
              >
                <div style={{ background: '#e0f2fe', padding: '15px', borderRadius: '50%', color: 'var(--primary)' }}><Package size={24} /></div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '2rem' }}>{stats.total_products}</h3>
                  <span style={{ color: '#64748b', fontSize: '0.9rem' }}>Inventario Total</span>
                </div>
              </div>

              <div 
                className="card" 
                onClick={() => { setFilterType('low_stock'); setCurrentView('inventory'); }}
                style={{ display: 'flex', alignItems: 'center', gap: '20px', borderLeft: '4px solid var(--warning)', cursor: 'pointer' }}
              >
                <div style={{ background: '#fef3c7', padding: '15px', borderRadius: '50%', color: 'var(--warning)' }}><AlertTriangle size={24} /></div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '2rem' }}>{stats.low_stock}</h3>
                  <span style={{ color: '#64748b', fontSize: '0.9rem' }}>Bajo Stock (Ver)</span>
                </div>
              </div>

              <div 
                className="card" 
                onClick={() => { setFilterType('expiring'); setCurrentView('inventory'); }}
                style={{ display: 'flex', alignItems: 'center', gap: '20px', borderLeft: '4px solid var(--danger)', cursor: 'pointer' }}
              >
                <div style={{ background: '#fee2e2', padding: '15px', borderRadius: '50%', color: 'var(--danger)' }}><TrendingDown size={24} /></div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '2rem' }}>{stats.expiring_batches}</h3>
                  <span style={{ color: '#64748b', fontSize: '0.9rem' }}>Por Vencer (Ver)</span>
                </div>
              </div>
            </div>

            {/* CHARTS & ACTIVITY */}
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
                        <div style={{ 
                          width: '30px', height: '30px', borderRadius: '50%', 
                          background: t.transaction_type === 'IN' ? 'var(--success-bg)' : 'var(--danger-bg)',
                          color: t.transaction_type === 'IN' ? 'var(--success)' : 'var(--danger)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold'
                        }}>
                          {t.transaction_type === 'IN' ? '+' : '-'}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600 }}>
                            {t.transaction_type === 'IN' ? 'Ingreso' : 'Salida'} de {t.quantity}u
                          </div>
                          <div style={{ color: '#64748b', fontSize: '0.8rem' }}>
                            <User size={12} style={{display:'inline', marginRight:'4px'}}/>
                            {t.username} • {formatDate(t.timestamp)}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VISTA INVENTARIO */}
        {currentView === 'inventory' && (
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
              <div>
                <h1 style={{ fontSize: '1.8rem', color: '#1e293b' }}>Inventario</h1>
                <p style={{ color: '#64748b', fontWeight: 'bold' }}>
                  {filterType === 'all' && 'Vista General'}
                  {filterType === 'low_stock' && '⚠️ Filtrando: Bajo Stock'}
                  {filterType === 'expiring' && '🚨 Filtrando: Lotes por Vencer'}
                </p>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ position: 'relative' }}>
                   <Search size={18} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                   <input 
                    type="text" 
                    placeholder="Buscar SKU o Nombre..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ padding: '10px 10px 10px 35px', borderRadius: '8px', border: '1px solid var(--border)', width: '250px' }}
                   />
                </div>
                {filterType !== 'all' && (
                  <button 
                    onClick={() => setFilterType('all')}
                    style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '0 15px', borderRadius: '8px', cursor: 'pointer' }}
                  >
                    Limpiar Filtros
                  </button>
                )}
              </div>
            </header>

            {/* CREATE PRODUCT */}
            <div className="card" style={{ marginBottom: '30px' }}>
               <h4 style={{marginTop:0, display:'flex', alignItems:'center', gap:'10px'}}><Plus size={16}/> Nuevo Producto</h4>
               <form onSubmit={handleCreateProduct} className="form-grid">
                  <div className="form-group"><label>Nombre</label><input className="input-field" value={newProd.name} onChange={e => setNewProd({...newProd, name: e.target.value})} placeholder="Ej. Aspirina"/></div>
                  <div className="form-group"><label>SKU</label><input className="input-field" value={newProd.sku} onChange={e => setNewProd({...newProd, sku: e.target.value})} placeholder="Ej. ASP-100"/></div>
                  <div className="form-group"><label>Mínimo</label><input className="input-field" type="number" value={newProd.min_stock} onChange={e => setNewProd({...newProd, min_stock: parseInt(e.target.value)})}/></div>
                  <button className="btn-primary">Crear</button>
               </form>
            </div>

            {/* TABLE */}
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>SKU / Producto</th>
                    <th>Stock</th>
                    <th>Gestión de Lotes</th>
                    <th>Dispensar</th>
                  </tr>
                </thead>
                <tbody>
                  {products
                    .filter(p => {
                      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku.toLowerCase().includes(searchTerm.toLowerCase());
                      let matchesType = true;
                      const totalStock = getTotalStock(p.batches);
                      
                      if (filterType === 'low_stock') {
                        matchesType = totalStock < p.min_stock;
                      } else if (filterType === 'expiring') {
                        const thirtyDays = new Date();
                        thirtyDays.setDate(thirtyDays.getDate() + 30);
                        matchesType = p.batches.some(b => new Date(b.expiration_date) <= thirtyDays && b.quantity > 0);
                      }
                      return matchesSearch && matchesType;
                    })
                    .map(p => {
                      const totalStock = getTotalStock(p.batches)
                      const isLow = totalStock < p.min_stock
                      return (
                        <tr key={p.id}>
                          <td>
                            <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
                              <div>
                                <div style={{fontWeight:'bold'}}>{p.name}</div>
                                <div style={{fontSize:'0.85rem', color:'#64748b'}}>{p.sku}</div>
                                {isLow && <span className="low-stock-alert">Bajo Stock</span>}
                              </div>
                              {/* DELETE PRODUCT BUTTON */}
                              <button onClick={() => handleDeleteProduct(p.id)} style={{background:'none', border:'none', cursor:'pointer', color:'#cbd5e1'}} title="Eliminar Producto">
                                <Trash2 size={16} />
                              </button>
                            </div>
                            
                            <button onClick={() => fetchHistory(p.id)} className="btn-audit" style={{marginTop:'5px'}}>
                              {showHistory[p.id] ? 'Ocultar Historial' : 'Ver Historial'}
                            </button>

                            {/* AUDIT LOG WITH REVERT BUTTON */}
                            {showHistory[p.id] && history[p.id] && (
                              <div className="audit-log">
                                {history[p.id].map(h => (
                                  <div key={h.id} className="audit-entry">
                                    <div style={{display:'flex', alignItems:'center', gap:'5px'}}>
                                      <span>{h.transaction_type === 'IN' ? '📥' : '📤'} {h.quantity}</span>
                                      {/* REVERT BUTTON (Solo para salidas) */}
                                      {h.transaction_type === 'OUT' && (
                                        <button onClick={() => handleRevert(h.id, p.id)} style={{border:'none', background:'none', cursor:'pointer', color:'#f59e0b'}} title="Revertir Salida (Deshacer)">
                                          <RotateCcw size={12}/>
                                        </button>
                                      )}
                                    </div>
                                    <span style={{fontSize:'0.75em', color:'#999'}}>{formatDate(h.timestamp)} ({h.username})</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                          <td><span className={`stock-indicator ${totalStock===0?'stock-low':'stock-high'}`}>{totalStock}</span></td>
                          <td>
                            <div className="batch-list">
                              {p.batches.map(b => (
                                <div key={b.id} className="batch-item">
                                  <span>📦 {b.batch_number} ({b.expiration_date})</span>
                                  <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
                                    <b>{b.quantity}</b>
                                    {/* DELETE BATCH BUTTON */}
                                    <button onClick={() => handleDeleteBatch(b.id)} style={{border:'none', background:'none', cursor:'pointer', color:'#ef4444', padding:0}}>
                                      <XCircle size={14} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="action-row">
                              <input className="input-field" style={{padding:'5px', width:'60px'}} placeholder="Lote" value={batchForms[p.id]?.num||''} onChange={e=>setBatchForms({...batchForms, [p.id]:{...batchForms[p.id], num:e.target.value}})}/>
                              <input className="input-field" type="date" style={{padding:'5px'}} value={batchForms[p.id]?.exp||''} onChange={e=>setBatchForms({...batchForms, [p.id]:{...batchForms[p.id], exp:e.target.value}})}/>
                              <input className="input-field" type="number" style={{padding:'5px', width:'50px'}} placeholder="#" value={batchForms[p.id]?.qty||''} onChange={e=>setBatchForms({...batchForms, [p.id]:{...batchForms[p.id], qty:e.target.value}})}/>
                              <button className="btn-small btn-add" onClick={()=>handleAddBatch(p.id)}>+</button>
                            </div>
                          </td>
                          <td>
                            <div className="action-row" style={{background:'#fee2e2'}}>
                              <input className="input-field" type="number" placeholder="#" style={{width:'60px'}} value={dispenseQty[p.id]||''} onChange={e=>setDispenseQty({...dispenseQty, [p.id]:e.target.value})}/>
                              <button className="btn-small btn-dispense" onClick={()=>handleDispense(p.id)}>Salida</button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default App