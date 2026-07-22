import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { ThemeProvider } from './lib/theme'
import { supabaseConfigError } from './lib/supabase'
import { redirectToCanonicalHost } from './lib/canonicalHost'
import './index.css'

// Apex (scmtvet.com) 308-redirects API POSTs to www and breaks auth fetch/CORS.
if (redirectToCanonicalHost()) {
  // Abort render — browser is navigating to www.
} else {
  function ConfigError() {
    return (
      <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 480, margin: '4rem auto', padding: '0 1rem' }}>
        <h1 style={{ fontSize: '1.25rem', marginBottom: '0.75rem' }}>VTMS configuration error</h1>
        <p style={{ color: '#444', lineHeight: 1.5 }}>{supabaseConfigError}</p>
      </div>
    )
  }

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ThemeProvider>
        {supabaseConfigError ? <ConfigError /> : <App />}
      </ThemeProvider>
    </React.StrictMode>,
  )
}
