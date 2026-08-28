// Dark mode is shelved for now — commented out, not removed, so it's a
// quick re-enable later (see index.html, SettingsModal.tsx, AdminApp.tsx,
// AdminSchedulePage.tsx for the other pieces that call into this file).
//
// const STORAGE_KEY = 'bouncer-theme'
//
// export type Theme = 'light' | 'dark'
//
// function prefersDark(): boolean {
//   return window.matchMedia('(prefers-color-scheme: dark)').matches
// }
//
// export function getTheme(): Theme {
//   const stored = localStorage.getItem(STORAGE_KEY)
//   if (stored === 'light' || stored === 'dark') return stored
//   return prefersDark() ? 'dark' : 'light'
// }
//
// export function setTheme(theme: Theme): void {
//   document.documentElement.classList.toggle('dark', theme === 'dark')
//   localStorage.setItem(STORAGE_KEY, theme)
// }
//
// export function toggleTheme(): Theme {
//   const next: Theme = getTheme() === 'dark' ? 'light' : 'dark'
//   setTheme(next)
//   return next
// }

export {}
