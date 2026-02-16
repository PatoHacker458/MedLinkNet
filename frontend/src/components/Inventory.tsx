import { useState } from 'react';
import type { FormEvent } from 'react'; // <--- Importamos el tipo específico
import { Search, Plus, Trash2, RotateCcw, XCircle } from 'lucide-react';

// CORRECCIÓN: Usamos 'import type'
import type { Product, Batch, Transaction } from '../types';

interface InventoryProps {
  products: Product[];
  filterType: 'all' | 'low_stock' | 'expiring';
  setFilterType: (type: 'all' | 'low_stock' | 'expiring') => void;
  fetchData: () => void;
  authFetch: (endpoint: string, options?: RequestInit) => Promise<Response | null>;
}

export default function Inventory({ products, filterType, setFilterType, fetchData, authFetch }: InventoryProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [newProd, setNewProd] = useState({ name: '', sku: '', min_stock: 10 });
  const [batchForms, setBatchForms] = useState<{ [key: number]: { qty: string, exp: string, num: string } }>({});
  const [dispenseQty, setDispenseQty] = useState<{ [key: number]: string }>({});
  const [history, setHistory] = useState<{ [key: number]: Transaction[] }>({});
  const [showHistory, setShowHistory] = useState<{ [key: number]: boolean }>({});

  const getTotalStock = (batches: Batch[]) => batches.reduce((acc, b) => acc + b.quantity, 0);
  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('es-MX', {day: '2-digit', month: '2-digit', hour: '2-digit', minute:'2-digit'});

  // --- ACTIONS ---
  // CORRECCIÓN: Usamos 'FormEvent' directamente, sin 'React.'
  const handleCreateProduct = async (e: FormEvent) => {
    e.preventDefault();
    if (!newProd.name) return;
    await authFetch('/products/', { method: 'POST', body: JSON.stringify(newProd) });
    setNewProd({ name: '', sku: '', min_stock: 10 }); fetchData();
  };

  const handleDeleteProduct = async (id: number) => {
    if(!confirm("¿Seguro que deseas eliminar este producto y todo su historial?")) return;
    await authFetch(`/products/${id}`, { method: 'DELETE' });
    fetchData();
  };

  const handleAddBatch = async (productId: number) => {
    const form = batchForms[productId];
    if (!form?.qty) return;
    await authFetch(`/products/${productId}/batches/`, {
      method: 'POST',
      body: JSON.stringify({ batch_number: form.num, expiration_date: form.exp, quantity: parseInt(form.qty) })
    });
    setBatchForms({ ...batchForms, [productId]: { qty: '', exp: '', num: '' } }); fetchData();
  };

  const handleDeleteBatch = async (batchId: number) => {
    if(!confirm("¿Eliminar este lote?")) return;
    await authFetch(`/batches/${batchId}`, { method: 'DELETE' });
    fetchData();
  };

  const handleDispense = async (productId: number) => {
    const qty = dispenseQty[productId];
    if (!qty) return;
    await authFetch(`/products/${productId}/dispense/`, {
      method: 'POST',
      body: JSON.stringify({ quantity: parseInt(qty) })
    });
    setDispenseQty({ ...dispenseQty, [productId]: '' }); fetchData();
    if (showHistory[productId]) fetchHistory(productId);
  };

  const fetchHistory = async (productId: number) => {
    if (showHistory[productId]) { setShowHistory({ ...showHistory, [productId]: false }); return; }
    const response = await authFetch(`/transactions/${productId}`);
    if (response?.ok) {
      const data = await response.json();
      setHistory({ ...history, [productId]: data });
      setShowHistory({ ...showHistory, [productId]: true });
    }
  };

  const handleRevert = async (txId: number, productId: number) => {
    if(!confirm("¿Revertir esta salida?")) return;
    const res = await authFetch(`/transactions/${txId}/revert`, { method: 'POST' });
    if(res?.ok) { alert("Revertido"); fetchHistory(productId); fetchData(); }
  };

  return (
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
                <input type="text" placeholder="Buscar SKU o Nombre..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ padding: '10px 10px 10px 35px', borderRadius: '8px', border: '1px solid var(--border)', width: '250px' }}/>
            </div>
            {filterType !== 'all' && (
                <button onClick={() => setFilterType('all')} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '0 15px', borderRadius: '8px', cursor: 'pointer' }}>Limpiar Filtros</button>
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
            <thead><tr><th>SKU / Producto</th><th>Stock</th><th>Gestión de Lotes</th><th>Dispensar</th></tr></thead>
            <tbody>
            {products.filter(p => {
                const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku.toLowerCase().includes(searchTerm.toLowerCase());
                let matchesType = true;
                const totalStock = getTotalStock(p.batches);
                if (filterType === 'low_stock') matchesType = totalStock < p.min_stock;
                else if (filterType === 'expiring') {
                    const thirtyDays = new Date(); thirtyDays.setDate(thirtyDays.getDate() + 30);
                    matchesType = p.batches.some(b => new Date(b.expiration_date) <= thirtyDays && b.quantity > 0);
                }
                return matchesSearch && matchesType;
            }).map(p => {
                const totalStock = getTotalStock(p.batches);
                const isLow = totalStock < p.min_stock;
                return (
                    <tr key={p.id}>
                        <td>
                            <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
                                <div><div style={{fontWeight:'bold'}}>{p.name}</div><div style={{fontSize:'0.85rem', color:'#64748b'}}>{p.sku}</div>{isLow && <span className="low-stock-alert">Bajo Stock</span>}</div>
                                <button onClick={() => handleDeleteProduct(p.id)} style={{background:'none', border:'none', cursor:'pointer', color:'#cbd5e1'}}><Trash2 size={16} /></button>
                            </div>
                            <button onClick={() => fetchHistory(p.id)} className="btn-audit" style={{marginTop:'5px'}}>{showHistory[p.id] ? 'Ocultar' : 'Historial'}</button>
                            {showHistory[p.id] && history[p.id] && (
                                <div className="audit-log">
                                {history[p.id].map(h => (
                                    <div key={h.id} className="audit-entry">
                                    <div style={{display:'flex', alignItems:'center', gap:'5px'}}><span>{h.transaction_type === 'IN' ? '📥' : '📤'} {h.quantity}</span>{h.transaction_type === 'OUT' && (<button onClick={() => handleRevert(h.id, p.id)} style={{border:'none', background:'none', cursor:'pointer', color:'#f59e0b'}}><RotateCcw size={12}/></button>)}</div>
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
                                <div key={b.id} className="batch-item"><span>📦 {b.batch_number} ({b.expiration_date})</span><div style={{display:'flex', gap:'10px', alignItems:'center'}}><b>{b.quantity}</b><button onClick={() => handleDeleteBatch(b.id)} style={{border:'none', background:'none', cursor:'pointer', color:'#ef4444', padding:0}}><XCircle size={14} /></button></div></div>
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
  );
}