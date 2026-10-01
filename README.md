# OneCloud Launch Tracker

Internal launch-readiness dashboard for the e& enterprise OneCloud programme.
Single-page React app, no backend: all project data lives in the browser's
`localStorage`.

## Stack

- React 19, Vite 6, Tailwind CSS v4, shadcn/ui (Radix primitives), Recharts, lucide-react
- ESLint 9 (flat config) with `react-hooks` and `react-refresh`
- Vitest for unit tests

## Getting started

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # production build in dist/
npm run preview   # serve dist/
npm run lint      # eslint .
npm test          # vitest run
```

## Project layout

```
src/
  App.jsx                 # app shell: auth gate, header, timeline, tabs
  lib/
    model.js              # data model: Phase/Task shapes, normalisation, stats
    defaults.js           # seed data (phases, users, metrics, branding)
    storage.js            # guarded localStorage helpers
    config.js             # storage keys and client-side configuration
    __tests__/            # unit tests
  components/
    PINAuth.jsx           # PIN login + shared access PIN management
    ProjectManagerAuth.jsx# password gate for edit mode
    EditableField.jsx     # inline edit widgets used in edit mode
    EnhancedProjectManager.jsx
    EnhancedAdminSettings.jsx
    UserManagement.jsx
    AdvancedDashboard.jsx
    InteractiveCharts.jsx
    SearchAndFilter.jsx
    NotificationSystem.jsx
    ui/                   # generated shadcn/ui primitives
```

## Data model

`src/lib/model.js` is the single source of truth. Every phase and task has a
stable `id`; components key, update and delete by id only.

```
Phase { id, name, status, progress, startDate, endDate, description,
        responsiblePerson, responsibleFunction, tasks: Task[] }
Task  { id, name, status, responsiblePerson, responsibleFunction,
        priority, description, dueDate, estimatedHours }
status:   pending | in-progress | completed | blocked | on-hold
priority: low | medium | high | critical
```

Saved data from older builds is migrated on load by `normalizePhases()`.

## Persistence

Project state is written to `localStorage` on every change and read once at
start-up. Keys are listed in `src/lib/config.js`. "Reset Data" in edit mode
clears them.

## Access control (read this before relying on it)

This is a static front-end with no server, so **nothing here is a security
boundary**. PINs and the edit-mode password ship inside the JavaScript bundle
and are stored in plain text in the browser. Treat them as a convenience
against accidental edits, not as authentication.

- **Named users** (User Management tab, admin only) log in with a 4-digit PIN
  and get a role: `admin`, `editor` or `viewer`.
- **Shared access PINs** (managed from the login screen behind the manager
  password) grant a read-only `viewer` session.
- **Edit mode** is gated by the manager password. Set `VITE_MANAGER_PASSWORD`
  in a `.env.local` file to change it; the default is for local demos only.

If this app is ever exposed beyond a trusted internal audience it needs a real
backend with server-side authentication and storage.
