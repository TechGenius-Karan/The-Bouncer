import React, { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from './ErrorBoundary'
import { reportError } from './reportError'
import './index.css'

window.addEventListener('error', (e) => reportError('window.onerror', e.error ?? e.message))
window.addEventListener('unhandledrejection', (e) => reportError('unhandledrejection', e.reason))

// Phase 6: no router exists (or is needed) for a couple of extra pages — a
// plain pathname check forks to the admin screens, lazy-loaded so their
// code doesn't bloat the player-facing bundle. The real access gate is
// server-side (adminAuth.ts, checked on every admin function call), not
// this client-side fork.
const AdminApp = lazy(() => import('./admin/AdminApp').then((m) => ({ default: m.AdminApp })))
const AdminSchedulePage = lazy(() =>
  import('./admin/AdminSchedulePage').then((m) => ({ default: m.AdminSchedulePage })),
)
const pathname = window.location.pathname
const isSchedule = pathname.startsWith('/admin/schedule')
const isAdmin = !isSchedule && pathname.startsWith('/admin')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      {isSchedule ? (
        <Suspense fallback={null}>
          <AdminSchedulePage />
        </Suspense>
      ) : isAdmin ? (
        <Suspense fallback={null}>
          <AdminApp />
        </Suspense>
      ) : (
        <App />
      )}
    </ErrorBoundary>
  </React.StrictMode>,
)
