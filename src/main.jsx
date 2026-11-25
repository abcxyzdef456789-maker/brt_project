import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught React error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "2rem", color: "#f87171", background: "#0f172a", minHeight: "100vh", fontFamily: "monospace" }}>
          <h1 style={{ fontSize: "1.4rem", fontWeight: "bold", color: "#f8fafc" }}>⚠️ Runtime Error Caught</h1>
          <p style={{ marginTop: "0.75rem", fontSize: "0.95rem", color: "#fca5a5" }}>{this.state.error?.toString()}</p>
          <pre style={{ marginTop: "1rem", padding: "1rem", background: "#1e293b", border: "1px solid #334155", borderRadius: "8px", overflow: "auto", fontSize: "0.75rem", color: "#cbd5e1" }}>
            {this.state.errorInfo?.componentStack}
          </pre>
          <button onClick={() => window.location.reload()} style={{ marginTop: "1.25rem", padding: "0.6rem 1.2rem", background: "#6366f1", color: "#fff", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer" }}>
            🔄 Reload Application
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
