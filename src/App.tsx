// Main App component with routing

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { DataProvider } from './context/DataContext';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Ingestion from './pages/Ingestion';
import CaseList from './pages/CaseList';
import PromptTester from './pages/PromptTester';
import Analytics from './pages/Analytics';

function App() {
  return (
    <DataProvider>
      <BrowserRouter>
        <div className="app-layout">
          <Sidebar />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/ingestion" element={<Ingestion />} />
              <Route path="/cases" element={<CaseList />} />
              <Route path="/tester" element={<PromptTester />} />
              <Route path="/analytics" element={<Analytics />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </DataProvider>
  );
}

export default App;
