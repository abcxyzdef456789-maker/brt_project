import React, { useState } from 'react';
import { TrainFront, Lock, User, Eye, EyeOff, LogIn } from 'lucide-react';

// Simple client-side login gate. In production this would verify against a
// backend; here it stores a session flag in localStorage.
const DEMO_USER = 'admin';
const DEMO_PASS = 'admin123';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    // Simulate a short auth delay
    setTimeout(() => {
      if (username.trim() === DEMO_USER && password === DEMO_PASS) {
        localStorage.setItem('brt-auth', '1');
        onLogin();
      } else {
        setError('Invalid username or password. Hint: admin / admin123');
      }
      setLoading(false);
    }, 500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-md">
        <div className="rounded-3xl border p-8 shadow-2xl" style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}>
          <div className="flex flex-col items-center mb-6">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
            >
              <TrainFront size={34} />
            </div>
            <h1 className="text-2xl font-black" style={{ color: 'var(--text)' }}>
              BRT Calculator
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              Bare Runtime Analysis Portal
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Username</label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="input w-full !pl-9"
                  placeholder="Enter username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                <input
                  type={showPass ? 'text' : 'password'}
                  className="input w-full !pl-9 !pr-10"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPass((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--text-muted)' }}
                  title={showPass ? 'Hide password' : 'Show password'}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-lg p-3 text-sm" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full justify-center !py-3"
            >
              {loading ? 'Signing in…' : (<><LogIn size={18} /> Sign In</>)}
            </button>
          </form>

          <p className="text-center text-xs mt-5" style={{ color: 'var(--text-muted)' }}>
            Demo credentials — admin / admin123
          </p>
        </div>
      </div>
    </div>
  );
}
