// Sidebar navigation component

import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Upload, Database, FlaskConical, BarChart3, Settings } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useState, useEffect } from 'react';

export default function Sidebar() {
  const { cases, apiKey, setApiKey } = useData();
  const [showSettings, setShowSettings] = useState(false);
  const [tempKey, setTempKey] = useState(apiKey);

  // Update tempKey when apiKey loads from database
  useEffect(() => {
    if (apiKey) {
      setTempKey(apiKey);
    }
  }, [apiKey]);

  const completeCases = cases.filter(c => c.status === 'complete').length;
  const totalCases = cases.length;

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/ingestion', icon: Upload, label: 'Data Ingestion' },
    { to: '/cases', icon: Database, label: 'Case Database' },
    { to: '/tester', icon: FlaskConical, label: 'Prompt Tester' },
    { to: '/analytics', icon: BarChart3, label: 'Analytics' }
  ];

  const handleSaveKey = () => {
    setApiKey(tempKey);
    setShowSettings(false);
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1>Medical Coder</h1>
        <p className="subtitle">Truth Database</p>
      </div>

      <nav className="sidebar-nav">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `nav-item ${isActive ? 'active' : ''}`
            }
          >
            <Icon size={20} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-stats">
        <div className="stat">
          <span className="stat-value">{totalCases}</span>
          <span className="stat-label">Total Cases</span>
        </div>
        <div className="stat">
          <span className="stat-value">{completeCases}</span>
          <span className="stat-label">Complete</span>
        </div>
      </div>

      <div className="sidebar-footer">
        <button
          className="settings-btn"
          onClick={() => setShowSettings(!showSettings)}
        >
          <Settings size={18} />
          <span>Settings</span>
        </button>

        {showSettings && (
          <div className="settings-panel">
            <label>Gemini API Key</label>
            <input
              type="password"
              value={tempKey}
              onChange={(e) => setTempKey(e.target.value)}
              placeholder="Enter API key..."
            />
            <button onClick={handleSaveKey} className="save-btn">
              Save
            </button>
            {apiKey && (
              <span className="key-status">Key saved</span>
            )}
          </div>
        )}
      </div>

      <style>{`
        .sidebar {
          width: 260px;
          height: 100vh;
          background: #1e293b;
          color: white;
          display: flex;
          flex-direction: column;
          position: fixed;
          left: 0;
          top: 0;
        }

        .sidebar-header {
          padding: 24px;
          border-bottom: 1px solid #334155;
        }

        .sidebar-header h1 {
          font-size: 1.5rem;
          font-weight: 700;
          margin: 0;
        }

        .subtitle {
          font-size: 0.875rem;
          color: #94a3b8;
          margin: 4px 0 0;
        }

        .sidebar-nav {
          flex: 1;
          padding: 16px 12px;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          border-radius: 8px;
          color: #94a3b8;
          text-decoration: none;
          transition: all 0.2s;
          margin-bottom: 4px;
        }

        .nav-item:hover {
          background: #334155;
          color: white;
        }

        .nav-item.active {
          background: #3b82f6;
          color: white;
        }

        .sidebar-stats {
          padding: 16px 24px;
          border-top: 1px solid #334155;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .stat {
          text-align: center;
        }

        .stat-value {
          display: block;
          font-size: 1.5rem;
          font-weight: 700;
          color: #3b82f6;
        }

        .stat-label {
          font-size: 0.75rem;
          color: #94a3b8;
        }

        .sidebar-footer {
          padding: 16px;
          border-top: 1px solid #334155;
        }

        .settings-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 10px 16px;
          background: transparent;
          border: 1px solid #334155;
          border-radius: 8px;
          color: #94a3b8;
          cursor: pointer;
          transition: all 0.2s;
        }

        .settings-btn:hover {
          background: #334155;
          color: white;
        }

        .settings-panel {
          margin-top: 12px;
          padding: 12px;
          background: #334155;
          border-radius: 8px;
        }

        .settings-panel label {
          display: block;
          font-size: 0.75rem;
          color: #94a3b8;
          margin-bottom: 8px;
        }

        .settings-panel input {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #475569;
          border-radius: 6px;
          background: #1e293b;
          color: white;
          font-size: 0.875rem;
          margin-bottom: 8px;
        }

        .save-btn {
          width: 100%;
          padding: 8px;
          background: #3b82f6;
          border: none;
          border-radius: 6px;
          color: white;
          font-weight: 500;
          cursor: pointer;
        }

        .save-btn:hover {
          background: #2563eb;
        }

        .key-status {
          display: block;
          text-align: center;
          font-size: 0.75rem;
          color: #22c55e;
          margin-top: 8px;
        }
      `}</style>
    </aside>
  );
}
