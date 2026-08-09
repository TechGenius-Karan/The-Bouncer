import React, { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Phase 6: no router exists (or is needed) for one extra page — a plain
// pathname check forks to the admin screen, lazy-loaded so its code
// doesn't bloat the player-facing bundle. The real access gate is
// server-side (adminAuth.ts, checked on every admin function call), not
// this client-side fork.
const AdminApp = lazy(() => import('./admin/AdminApp').then((m) => ({ default: m.AdminApp })))
const isAdmin = window.location.pathname.startsWith('/admin')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isAdmin ? (
      <Suspense fallback={null}>
        <AdminApp />
      </Suspense>
    ) : (
      <App />
    )}
  </React.StrictMode>,
)
