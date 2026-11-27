import React, { useEffect, useState } from 'react';
import {
  Loader,
  Sun,
  Moon,
  UploadCloud,
  Home as HomeIcon,
  LogOut,
  TrainFront,
  Route,
} from 'lucide-react';
import TrainInfo from './components/TrainInfo';
import SectionInfo from './components/SectionInfo';
import Upload from './components/Upload';
import HomeTab from './components/Home';
import Login from './components/Login';
import { loadEngine, loadMeta } from './lib/engine';

const TABS = [
  { id: 'home', label: 'Home', icon: HomeIcon },
  { id: 'train', label: 'Trainwise BRT', icon: TrainFront },
  { id: 'section', label: 'Sectionwise BRT', icon: Route },
  { id: 'upload', label: 'Upload', icon: UploadCloud },
];

function App() {
  const [authed, setAuthed] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadMessage, setLoadMessage] = useState('Initializing...');
  const [tab, setTab] = useState('home');
  const [selectedTrain, setSelectedTrain] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [trains, setTrains] = useState([]);
  const [sections, setSections] = useState([]);
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('brt-theme') || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('brt-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!authed) return;
    let mounted = true;
    (async () => {
      try {
        const meta = await loadMeta();
        if (!mounted) return;

        setLoadMessage('Loading engine (this may take a moment)...');
        await loadEngine((msg) => setLoadMessage(msg));

        if (!mounted) return;

        setTrains(meta.trains || []);
        setSections(meta.sections || []);
        setLoading(false);
      } catch (e) {
        console.error(e);
        setLoadMessage(e.message || 'Failed to load data');
      }
    })();
    return () => { mounted = false; };
  }, [authed]);

  const toggleTheme = () => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  };

  const handleLogout = () => {
    localStorage.removeItem('brt-auth');
    setAuthed(false);
  };

  // Navigate to a tab from the Home dashboard recent-items list.
  const handleNavigate = (kind, key) => {
    if (kind === 'train') {
      setSelectedTrain(String(key));
      setTab('train');
    } else if (kind === 'section') {
      setSelectedSection(String(key));
      setTab('section');
    }
  };

  if (!authed) {
    return <Login onLogin={() => setAuthed(true)} />;
  }

  if (loading) {
    return (
      <div className="app-shell flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader className="animate-spin" size={32} style={{ color: 'var(--accent)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{loadMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-main app-header-inner">
          <div className="app-brand-row">
            <div className="app-brand">
              <span className="app-brand-mark" aria-hidden="true">
                <TrainFront size={21} />
              </span>
              <div>
                <p className="app-brand-eyebrow">Bare Runtime Analysis</p>
                <h1 className="app-brand-name">BRT <span>Calculator</span></h1>
              </div>
            </div>

            <div className="app-header-actions">
              <span className="dataset-ready"><span aria-hidden="true" /> Local data ready</span>
              <button
                onClick={toggleTheme}
                className="icon-button"
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <button
                onClick={handleLogout}
                className="icon-button"
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>

          <nav className="app-nav" aria-label="Main navigation">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`app-nav-link${active ? ' is-active' : ''}`}
                  aria-current={active ? 'page' : undefined}
                >
                  {Icon && <Icon size={17} aria-hidden="true" />}
                  {t.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="app-main">
        {tab === 'home' && (
          <HomeTab
            trains={trains}
            sections={sections}
            onNavigate={handleNavigate}
          />
        )}
        {tab === 'train' && <TrainInfo trains={trains} initialTrain={selectedTrain} />}
        {tab === 'section' && <SectionInfo sections={sections} initialSection={selectedSection} />}
        {tab === 'upload' && <Upload />}
      </main>
    </div>
  );
}

export default App;
