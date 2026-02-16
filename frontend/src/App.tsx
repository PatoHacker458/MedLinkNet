// src/App.tsx
import { useEffect, useState } from 'react';
import './App.css';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Inventory from './components/Inventory';
import { DashboardStats, Product } from './types';

const API_URL = "http://100.78.67.58:8800";

function App() {
  // --- GLOBAL STATE ---
  const [token, setToken] = useState<string | null>(localStorage.getItem('hospital_token'));
  const [currentView, setCurrentView] = useState<'dashboard' | 'inventory'>('dashboard');
  const [filterType, setFilterType] = useState<'all' | 'low_stock' | 'expiring'>('all');

  // --- DATA STATE ---
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  
  // --- LOGIN STATE ---
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // --- AUTH FETCH WRAPPER (Se pasa a los componentes) ---
  const authFetch = async (endpoint: string, options: RequestInit = {}) => {
    const headers = { ...options.headers, 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
    try {
      const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
      if (response.status === 401) { logout(); return null; }
      return response;
    } catch (error) { console.error("Network error", error); return null; }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    const formData = new URLSearchParams();
    formData.append('username', username); formData.append('password', password);
    try {
      const response = await fetch(`${API_URL}/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: formData });
      if (!response.ok) throw new Error('Credenciales inválidas');
      const data = await response.json();
      localStorage.setItem('hospital_token', data.access_token);
      setToken(data.access_token);
    } catch (err) { setLoginError('Acceso denegado'); }
  };

  const logout = () => { localStorage.removeItem('hospital_token'); setToken(null); };

  const fetchData = async () => {
    const prodRes = await authFetch('/products/');
    if (prodRes?.ok) setProducts(await prodRes.json());

    const statsRes = await authFetch('/dashboard');
    if (statsRes?.ok) setStats(await statsRes.json());
  };

  useEffect(() => { if (token) fetchData(); }, [token]);

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
    );
  }

  // --- RENDER MAIN LAYOUT ---
  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', background: 'var(--bg-app)', overflow: 'hidden' }}>
      <Sidebar 
        currentView={currentView} 
        setCurrentView={setCurrentView} 
        setFilterType={setFilterType} 
        logout={logout} 
      />

      <main style={{ flex: 1, padding: '30px', overflowY: 'auto', height: '100%' }}>
        {currentView === 'dashboard' && stats && (
          <Dashboard 
            stats={stats} 
            products={products} 
            setFilterType={setFilterType} 
            setCurrentView={setCurrentView} 
          />
        )}

        {currentView === 'inventory' && (
          <Inventory 
            products={products} 
            filterType={filterType} 
            setFilterType={setFilterType} 
            fetchData={fetchData} 
            authFetch={authFetch} 
          />
        )}
      </main>
    </div>
  );
}

export default App;