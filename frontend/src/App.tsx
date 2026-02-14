import { useEffect, useState } from 'react'
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
}

interface Product {
  id: number;
  name: string;
  sku: string;
  min_stock: number;
  batches: Batch[];
}

const API_URL = "http://100.78.67.58:8800";

function App() {
  // --- STATES ---
  const [token, setToken] = useState<string | null>(localStorage.getItem('hospital_token'))
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')

  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  
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
      if (response.status === 401) {
        logout()
        return null
      }
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
    formData.append('username', username)
    formData.append('password', password)

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
      setUsername('')
      setPassword('')
    } catch (err) {
      setLoginError('Acceso denegado. Verifique sus credenciales.')
    }
  }

  const logout = () => {
    localStorage.removeItem('hospital_token')
    setToken(null)
    setProducts([])
  }

  // --- BUSINESS LOGIC ---
  const fetchProducts = async () => {
    setLoading(true)
    const response = await authFetch('/products/')
    if (response && response.ok) {
      const data = await response.json()
      setProducts(data)
    }
    setLoading(false)
  }

  const fetchHistory = async (productId: number) => {
    if (showHistory[productId]) {
      setShowHistory({ ...showHistory, [productId]: false })
      return
    }
    const response = await authFetch(`/transactions/${productId}`)
    if (response && response.ok) {
      const data = await response.json()
      setHistory({ ...history, [productId]: data })
      setShowHistory({ ...showHistory, [productId]: true })
    }
  }

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newProd.name || !newProd.sku) return;
    await authFetch('/products/', { method: 'POST', body: JSON.stringify(newProd) })
    setNewProd({ name: '', sku: '', min_stock: 10 }) 
    fetchProducts()
  }

  const handleAddBatch = async (productId: number) => {
    const form = batchForms[productId]
    if (!form?.qty || !form?.exp || !form?.num) return alert("Datos incompletos")

    await authFetch(`/products/${productId}/batches/`, {
      method: 'POST',
      body: JSON.stringify({
        batch_number: form.num,
        expiration_date: form.exp,
        quantity: parseInt(form.qty)
      })
    })

    setBatchForms({ ...batchForms, [productId]: { qty: '', exp: '', num: '' } })
    fetchProducts()
    if (showHistory[productId]) fetchHistory(productId)
  }

  const handleDispense = async (productId: number) => {
    const qty = dispenseQty[productId]
    if (!qty || parseInt(qty) <= 0) return alert("Cantidad inválida")

    const response = await authFetch(`/products/${productId}/dispense/`, {
      method: 'POST',
      body: JSON.stringify({ quantity: parseInt(qty) })
    })

    if (response && response.ok) {
      setDispenseQty({ ...dispenseQty, [productId]: '' })
      fetchProducts()
      if (showHistory[productId]) fetchHistory(productId)
    } else if (response) {
      const error = await response.json()
      alert(`Error: ${error.detail}`)
    }
  }

  // --- UTILS ---
  const handleBatchInput = (pid: number, field: string, value: string) => {
    setBatchForms(prev => ({ ...prev, [pid]: { ...prev[pid], [field]: value } }))
  }

  const getTotalStock = (batches: Batch[]) => batches.reduce((acc, b) => acc + b.quantity, 0)
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('es-MX', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
    })
  }

  useEffect(() => { if (token) fetchProducts() }, [token])

  // --- RENDER ---

  if (!token) {
    return (
      <div className="login-container">
        <div className="login-card">
          <h2 style={{ color: 'var(--primary)', marginBottom: '1.5rem' }}>🏥 Hospital SaaS</h2>
          <form onSubmit={handleLogin}>
            <input 
              className="login-input"
              type="text" 
              placeholder="Usuario ID" 
              value={username} 
              onChange={e => setUsername(e.target.value)}
            />
            <input 
              className="login-input"
              type="password" 
              placeholder="Contraseña" 
              value={password} 
              onChange={e => setPassword(e.target.value)}
            />
            {loginError && <p style={{ color: 'var(--danger)', fontSize: '0.9rem' }}>{loginError}</p>}
            <button type="submit" className="btn-primary">Acceder al Sistema</button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-title">
          <h1>Farmacia Central</h1>
          <div className="header-meta">Nodo Seguro: mcserver | 🔒 SSL Encryption</div>
        </div>
        <button onClick={logout} className="btn-logout">
          Cerrar Sesión
        </button>
      </header>

      {/* CREATION CARD */}
      <section className="card">
        <form onSubmit={handleCreateProduct} className="form-grid">
          <div className="form-group">
            <label>Nombre del Medicamento</label>
            <input className="input-field" type="text" value={newProd.name} onChange={e => setNewProd({...newProd, name: e.target.value})} placeholder="Ej. Paracetamol 500mg"/>
          </div>
          <div className="form-group">
            <label>Código SKU</label>
            <input className="input-field" type="text" value={newProd.sku} onChange={e => setNewProd({...newProd, sku: e.target.value})} placeholder="Ej. PAR-500"/>
          </div>
          <div className="form-group">
            <label>Stock Mínimo</label>
            <input className="input-field" type="number" value={newProd.min_stock} onChange={e => setNewProd({...newProd, min_stock: parseInt(e.target.value)})}/>
          </div>
          <button type="submit" className="btn-primary">Registrar</button>
        </form>
      </section>

      {/* DATA TABLE */}
      {loading ? <p style={{textAlign:'center', color:'var(--secondary)'}}>Sincronizando inventario...</p> : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th style={{width: '15%'}}>Código</th>
                <th style={{width: '25%'}}>Descripción</th>
                <th style={{width: '10%'}}>Stock Total</th>
                <th style={{width: '30%'}}>Gestión de Lotes (Entradas)</th>
                <th style={{width: '20%'}}>Dispensación (Salidas)</th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => {
                const totalStock = getTotalStock(p.batches)
                const isLowStock = totalStock < p.min_stock
                
                return (
                  <tr key={p.id}>
                    <td><span className="sku-badge">{p.sku}</span></td>
                    
                    <td>
                      <strong>{p.name}</strong>
                      {isLowStock && <div className="low-stock-alert">⚠ BAJO STOCK</div>}
                      
                      <div style={{marginTop: '10px'}}>
                        <button onClick={() => fetchHistory(p.id)} className="btn-audit">
                          {showHistory[p.id] ? 'Ocultar Auditoría' : '📋 Ver Auditoría'}
                        </button>

                        {showHistory[p.id] && history[p.id] && (
                          <div className="audit-log">
                            {history[p.id].map(h => (
                              <div key={h.id} className="audit-entry">
                                <div>
                                  <span style={{color:'#94a3b8'}}>{formatDate(h.timestamp)}</span>
                                  <br/>
                                  <small>👤 {h.username}</small>
                                </div>
                                <div className={h.transaction_type === 'IN' ? 'audit-in' : 'audit-out'}>
                                  {h.transaction_type === 'IN' ? '+ Entrada' : '- Salida'}
                                  <span style={{marginLeft:'5px'}}>{h.quantity}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>

                    <td>
                      <span className={`stock-indicator ${totalStock === 0 ? 'stock-low' : 'stock-high'}`}>
                        {totalStock}
                      </span>
                    </td>
                    
                    <td>
                      <div className="batch-list">
                        {p.batches.length === 0 ? <div style={{padding:'10px', color:'#ccc', textAlign:'center'}}>Sin lotes activos</div> : (
                          p.batches.map(b => (
                            <div key={b.id} className="batch-item">
                              <span>📦 <strong>{b.batch_number}</strong> (Vence: {b.expiration_date})</span>
                              <strong>{b.quantity}u</strong>
                            </div>
                          ))
                        )}
                      </div>
                      
                      <div className="action-row">
                        <input className="input-field" style={{padding:'6px'}} placeholder="# Lote" value={batchForms[p.id]?.num || ''} onChange={e => handleBatchInput(p.id, 'num', e.target.value)} />
                        <input className="input-field" style={{padding:'6px'}} type="date" value={batchForms[p.id]?.exp || ''} onChange={e => handleBatchInput(p.id, 'exp', e.target.value)} />
                        <input className="input-field" style={{padding:'6px', width:'60px'}} type="number" placeholder="Cant." value={batchForms[p.id]?.qty || ''} onChange={e => handleBatchInput(p.id, 'qty', e.target.value)} />
                        <button onClick={() => handleAddBatch(p.id)} className="btn-small btn-add">Ingresar</button>
                      </div>
                    </td>

                    <td>
                      <div className="action-row" style={{background:'#fee2e2'}}>
                        <input className="input-field" style={{padding:'6px'}} type="number" placeholder="Cant." value={dispenseQty[p.id] || ''} onChange={e => setDispenseQty({...dispenseQty, [p.id]: e.target.value})} />
                        <button onClick={() => handleDispense(p.id)} className="btn-small btn-dispense">Dispensar</button>
                      </div>
                      <small style={{display:'block', marginTop:'5px', color:'#b91c1c', fontSize:'0.75rem'}}>
                        * Prioridad FEFO Automática
                      </small>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default App