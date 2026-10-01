import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Progress } from '@/components/ui/progress.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx'
import {
  CheckCircle,
  Clock,
  AlertCircle,
  Users,
  Server,
  Shield,
  Rocket,
  Building2,
  Plus,
  Trash2,
  Settings,
} from 'lucide-react'
import { ProjectManagerAuth } from './components/ProjectManagerAuth.jsx'
import { EditableText, EditableNumber, EditableSelect, EditableDate } from './components/EditableField.jsx'
import PINAuth from './components/PINAuth.jsx'
import NotificationSystem from './components/NotificationSystem.jsx'
import InteractiveCharts from './components/InteractiveCharts.jsx'
import SearchAndFilter from './components/SearchAndFilter.jsx'
import UserManagement from './components/UserManagement.jsx'
import EnhancedAdminSettings from './components/EnhancedAdminSettings.jsx'
import EnhancedProjectManager from './components/EnhancedProjectManager.jsx'
import AdvancedDashboard from './components/AdvancedDashboard.jsx'
import { STORAGE_KEYS } from '@/lib/config.js'
import { loadJSON, saveJSON, removeKey } from '@/lib/storage.js'
import { STATUS_OPTIONS, createTask, normalizePhases, getStatusLabel } from '@/lib/model.js'
import {
  DEFAULT_PROJECT,
  DEFAULT_METRICS,
  DEFAULT_ADMIN_SETTINGS,
  DEFAULT_USERS,
  DEFAULT_PHASES,
} from '@/lib/defaults.js'
import './App.css'

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

function loadTrackerData() {
  const saved = loadJSON(STORAGE_KEYS.trackerData, null) || {}
  return {
    projectTitle: saved.projectTitle || DEFAULT_PROJECT.projectTitle,
    projectSubtitle: saved.projectSubtitle || DEFAULT_PROJECT.projectSubtitle,
    overallProgress: Number.isFinite(saved.overallProgress)
      ? saved.overallProgress
      : DEFAULT_PROJECT.overallProgress,
    phases: normalizePhases(saved.phases?.length ? saved.phases : DEFAULT_PHASES),
    metrics: { ...DEFAULT_METRICS, ...(saved.metrics || {}) },
    // Only keep the keys we know about so a stale/corrupt save can't leak in.
    adminSettings: Object.fromEntries(
      Object.keys(DEFAULT_ADMIN_SETTINGS).map((k) => [
        k,
        saved.adminSettings?.[k] ?? DEFAULT_ADMIN_SETTINGS[k],
      ]),
    ),
  }
}

function loadUsers() {
  const saved = loadJSON(STORAGE_KEYS.users, null)
  return Array.isArray(saved) && saved.length > 0 ? saved : DEFAULT_USERS
}

// ---------------------------------------------------------------------------
// Presentation helpers
// ---------------------------------------------------------------------------

const STATUS_DOT = {
  completed: 'bg-green-500',
  'in-progress': 'bg-blue-500',
  pending: 'bg-gray-400',
  blocked: 'bg-red-500',
  'on-hold': 'bg-yellow-500',
}

const STATUS_BADGE = {
  completed: 'bg-green-100 text-green-800',
  'in-progress': 'bg-blue-100 text-blue-800',
  pending: 'bg-gray-100 text-gray-800',
  blocked: 'bg-red-100 text-red-800',
  'on-hold': 'bg-yellow-100 text-yellow-800',
}

function StatusBadge({ status }) {
  return (
    <Badge className={STATUS_BADGE[status] || STATUS_BADGE.pending}>{getStatusLabel(status)}</Badge>
  )
}

const METRIC_CARDS = [
  { key: 'totalServices', title: 'Cloud Services', icon: Server, suffix: '+', min: 0, max: 1000, note: 'Available at launch' },
  { key: 'dataCenters', title: 'Data Centers', icon: Building2, suffix: '', min: 1, max: 20, note: 'UAE locations' },
  { key: 'complianceCerts', title: 'Compliance', icon: Shield, suffix: '', min: 1, max: 50, note: 'Certifications' },
  { key: 'teamMembers', title: 'Team Members', icon: Users, suffix: '', min: 1, max: 500, note: 'Across all phases' },
]

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

function App() {
  // Persisted project state. Lazy initialisers read localStorage exactly once,
  // which avoids the load/save race the previous effect-based approach had.
  const [initial] = useState(loadTrackerData)
  const [projectTitle, setProjectTitle] = useState(initial.projectTitle)
  const [projectSubtitle, setProjectSubtitle] = useState(initial.projectSubtitle)
  const [overallProgress, setOverallProgress] = useState(initial.overallProgress)
  const [phases, setPhases] = useState(initial.phases)
  const [metrics, setMetrics] = useState(initial.metrics)
  const [adminSettings, setAdminSettings] = useState(initial.adminSettings)
  const [users, setUsers] = useState(loadUsers)

  // Session state (not persisted).
  const [session, setSession] = useState(null) // { label, user }
  const [isEditMode, setIsEditMode] = useState(false)
  const [filterResult, setFilterResult] = useState({ isActive: false, phases: [] })
  const [lastSavedAt, setLastSavedAt] = useState(null)

  const currentUser = session?.user ?? null

  // Persist project data whenever it changes.
  useEffect(() => {
    const ok = saveJSON(STORAGE_KEYS.trackerData, {
      projectTitle,
      projectSubtitle,
      overallProgress,
      phases,
      metrics,
      adminSettings,
      lastUpdated: new Date().toISOString(),
    })
    if (ok) setLastSavedAt(new Date())
  }, [projectTitle, projectSubtitle, overallProgress, phases, metrics, adminSettings])

  useEffect(() => {
    saveJSON(STORAGE_KEYS.users, users)
  }, [users])

  // --- Mutations --------------------------------------------------------------

  const updateMetric = useCallback((key, value) => {
    setMetrics((prev) => ({ ...prev, [key]: value }))
  }, [])

  const updateAdminSettings = useCallback((partial) => {
    setAdminSettings((prev) => ({ ...prev, ...partial }))
  }, [])

  const updatePhase = useCallback((phaseId, updates) => {
    setPhases((prev) => prev.map((p) => (p.id === phaseId ? { ...p, ...updates } : p)))
  }, [])

  const updateTask = useCallback((phaseId, taskId, updates) => {
    setPhases((prev) =>
      prev.map((p) =>
        p.id === phaseId
          ? { ...p, tasks: p.tasks.map((t) => (t.id === taskId ? { ...t, ...updates } : t)) }
          : p,
      ),
    )
  }, [])

  const addTask = useCallback((phaseId, overrides = {}) => {
    const task = createTask(overrides)
    setPhases((prev) =>
      prev.map((p) => (p.id === phaseId ? { ...p, tasks: [...p.tasks, task] } : p)),
    )
    return task
  }, [])

  const removeTask = useCallback((phaseId, taskId) => {
    setPhases((prev) =>
      prev.map((p) =>
        p.id === phaseId ? { ...p, tasks: p.tasks.filter((t) => t.id !== taskId) } : p,
      ),
    )
  }, [])

  const resetData = () => {
    if (window.confirm('Reset all project data to defaults? This cannot be undone.')) {
      removeKey(STORAGE_KEYS.trackerData)
      removeKey(STORAGE_KEYS.users)
      window.location.reload()
    }
  }

  // --- Auth -------------------------------------------------------------------

  const handleAuthenticated = ({ label, user }) => {
    if (user) {
      const now = new Date().toISOString()
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, lastLogin: now } : u)))
      setSession({ label: user.name, user: { ...user, lastLogin: now } })
    } else {
      // Shared access PIN: read-only viewer identity, no admin rights.
      setSession({ label, user: { id: `pin_${label}`, name: label, role: 'viewer', isActive: true } })
    }
  }

  const logout = () => {
    setSession(null)
    setIsEditMode(false)
  }

  // Keep the session copy of the user in sync if it is edited in User Management.
  useEffect(() => {
    if (!session?.user) return
    const fresh = users.find((u) => u.id === session.user.id)
    if (fresh && fresh !== session.user) {
      setSession((s) => ({ ...s, user: fresh }))
    }
  }, [users, session])

  const handleFilterChange = useCallback((result) => setFilterResult(result), [])
  const visiblePhases = filterResult.isActive ? filterResult.phases : phases

  const systemStats = useMemo(
    () => ({
      activeUsers: users.filter((u) => u.isActive).length,
      totalUsers: users.length,
      phases: phases.length,
      tasks: phases.reduce((n, p) => n + p.tasks.length, 0),
      lastSavedAt,
    }),
    [users, phases, lastSavedAt],
  )

  if (!session) {
    return <PINAuth users={users} onAuthenticated={handleAuthenticated} adminSettings={adminSettings} />
  }

  const canEdit = isEditMode

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b" style={{ backgroundColor: `${adminSettings.primaryColor}05` }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-between items-center gap-4 py-4">
            <div className="flex items-center space-x-4">
              <img src={adminSettings.logoUrl} alt={adminSettings.companyName} className="h-12 w-auto object-contain" />
              <div>
                {canEdit ? (
                  <div className="space-y-1">
                    <EditableText value={projectTitle} onSave={setProjectTitle} className="text-2xl font-bold" style={{ color: adminSettings.primaryColor }} />
                    <EditableText value={projectSubtitle} onSave={setProjectSubtitle} className="text-sm text-gray-600" />
                  </div>
                ) : (
                  <div>
                    <h1 className="text-2xl font-bold" style={{ color: adminSettings.primaryColor }}>{projectTitle}</h1>
                    <p className="text-sm text-gray-600">{projectSubtitle}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <NotificationSystem phases={phases} />

              <div className="text-right">
                <p className="text-sm text-gray-500">Signed in as</p>
                <p className="text-sm font-medium" style={{ color: adminSettings.primaryColor }}>
                  {session.label}
                  {currentUser?.role ? <span className="ml-1 text-xs text-gray-500">({currentUser.role})</span> : null}
                </p>
              </div>

              <Button variant="outline" size="sm" onClick={logout} className="text-gray-600 hover:text-gray-800">
                Logout
              </Button>

              <ProjectManagerAuth isEditMode={isEditMode} onToggleEditMode={setIsEditMode} />

              {canEdit && (
                <Button variant="outline" size="sm" onClick={resetData} className="flex items-center space-x-1 text-red-600 hover:text-red-700">
                  <AlertCircle className="h-4 w-4" />
                  <span>Reset Data</span>
                </Button>
              )}

              <div className="text-right">
                <p className="text-sm text-gray-600">Overall Progress</p>
                {canEdit ? (
                  <EditableNumber value={overallProgress} onSave={setOverallProgress} min={0} max={100} suffix="%" className="text-2xl font-bold" style={{ color: adminSettings.primaryColor }} />
                ) : (
                  <p className="text-2xl font-bold" style={{ color: adminSettings.primaryColor }}>{overallProgress}%</p>
                )}
                <Progress value={overallProgress} className="w-24 mt-1" />
                {lastSavedAt && (
                  <p className="text-[10px] text-gray-400 mt-1">Saved {lastSavedAt.toLocaleTimeString()}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search and Filter */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Search &amp; Filter</CardTitle>
            <CardDescription>Find specific phases, tasks, or team members. Results apply to the Phase Details tab.</CardDescription>
          </CardHeader>
          <CardContent>
            <SearchAndFilter phases={phases} onFilterChange={handleFilterChange} />
          </CardContent>
        </Card>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {METRIC_CARDS.map(({ key, title, icon: Icon, suffix, min, max, note }) => (
            <Card key={key}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {canEdit ? (
                  <EditableNumber value={metrics[key]} onSave={(v) => updateMetric(key, v)} min={min} max={max} suffix={suffix} className="text-2xl font-bold" style={{ color: adminSettings.primaryColor }} />
                ) : (
                  <div className="text-2xl font-bold" style={{ color: adminSettings.primaryColor }}>
                    {metrics[key]}{suffix}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">{note}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Launch Timeline */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Rocket className="h-5 w-5" />
              <span>Launch Timeline</span>
            </CardTitle>
            <CardDescription>Track progress across all project phases</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {phases.map((phase, index) => (
                <div key={phase.id} className="flex items-start space-x-4">
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${STATUS_DOT[phase.status] || STATUS_DOT.pending}`}>
                      {phase.status === 'completed' ? <CheckCircle className="w-4 h-4 text-white" /> : <Clock className="w-4 h-4 text-white" />}
                    </div>
                    {index < phases.length - 1 && <div className="w-px h-16 bg-gray-300 mt-2" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        {canEdit ? (
                          <div className="space-y-2">
                            <EditableText value={phase.name} onSave={(v) => updatePhase(phase.id, { name: v })} className="text-lg font-semibold" />
                            <EditableText value={phase.description} onSave={(v) => updatePhase(phase.id, { description: v })} className="text-sm text-gray-600" multiline />
                            <div className="flex space-x-4 text-xs text-gray-500">
                              <EditableDate value={phase.startDate} onSave={(v) => updatePhase(phase.id, { startDate: v })} />
                              <span>-</span>
                              <EditableDate value={phase.endDate} onSave={(v) => updatePhase(phase.id, { endDate: v })} />
                            </div>
                            <div className="space-y-1">
                              <EditableText value={phase.responsiblePerson} onSave={(v) => updatePhase(phase.id, { responsiblePerson: v })} className="text-sm font-medium text-blue-600" placeholder="Responsible person" />
                              <EditableText value={phase.responsibleFunction} onSave={(v) => updatePhase(phase.id, { responsibleFunction: v })} className="text-xs text-gray-500" placeholder="Function / role" />
                            </div>
                          </div>
                        ) : (
                          <div>
                            <h3 className="text-lg font-semibold">{phase.name}</h3>
                            <p className="text-sm text-gray-600">{phase.description}</p>
                            <p className="text-xs text-gray-500 mt-1">{phase.startDate} - {phase.endDate}</p>
                            <div className="mt-2">
                              <p className="text-sm font-medium text-blue-600">{phase.responsiblePerson}</p>
                              <p className="text-xs text-gray-500">{phase.responsibleFunction}</p>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        {canEdit ? (
                          <div className="space-y-2">
                            <EditableSelect value={phase.status} options={STATUS_OPTIONS} onSave={(v) => updatePhase(phase.id, { status: v })} />
                            <EditableNumber value={phase.progress} onSave={(v) => updatePhase(phase.id, { progress: v })} min={0} max={100} suffix="% complete" className="text-sm text-gray-600" />
                          </div>
                        ) : (
                          <div>
                            <StatusBadge status={phase.status} />
                            <p className="text-sm text-gray-600 mt-1">{phase.progress}% complete</p>
                          </div>
                        )}
                        <div className="w-32 mt-2">
                          <Progress value={phase.progress} className="h-2" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="phases">Phase Details</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="admin">Admin Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <AdvancedDashboard phases={phases} metrics={metrics} adminSettings={adminSettings} />
          </TabsContent>

          <TabsContent value="phases" className="space-y-6">
            {filterResult.isActive && visiblePhases.length === 0 && (
              <Card>
                <CardContent className="py-8 text-center text-gray-500">No phases or tasks match the current search.</CardContent>
              </Card>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {visiblePhases.map((phase) => (
                <Card key={phase.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      {canEdit ? (
                        <EditableText value={phase.name} onSave={(v) => updatePhase(phase.id, { name: v })} className="text-lg font-semibold" />
                      ) : (
                        phase.name
                      )}
                      {canEdit ? (
                        <EditableSelect value={phase.status} options={STATUS_OPTIONS} onSave={(v) => updatePhase(phase.id, { status: v })} />
                      ) : (
                        <StatusBadge status={phase.status} />
                      )}
                    </CardTitle>
                    <CardDescription>
                      <div>
                        {canEdit ? (
                          <div className="space-y-2">
                            <EditableText value={phase.description} onSave={(v) => updatePhase(phase.id, { description: v })} multiline />
                            <div className="grid grid-cols-2 gap-2">
                              <EditableText value={phase.responsiblePerson} onSave={(v) => updatePhase(phase.id, { responsiblePerson: v })} className="text-sm font-medium text-blue-600" placeholder="Responsible Person" />
                              <EditableText value={phase.responsibleFunction} onSave={(v) => updatePhase(phase.id, { responsibleFunction: v })} className="text-sm text-gray-600" placeholder="Function/Role" />
                            </div>
                          </div>
                        ) : (
                          <div>
                            {phase.description}
                            <div className="mt-2 grid grid-cols-2 gap-2">
                              <p className="text-sm font-medium text-blue-600">{phase.responsiblePerson}</p>
                              <p className="text-sm text-gray-600">{phase.responsibleFunction}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {phase.tasks.map((task) => (
                        <div key={task.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex-1">
                            {canEdit ? (
                              <div className="space-y-1">
                                <EditableText value={task.name} onSave={(v) => updateTask(phase.id, task.id, { name: v })} className="font-medium" />
                                <div className="grid grid-cols-2 gap-2">
                                  <EditableText value={task.responsiblePerson} onSave={(v) => updateTask(phase.id, task.id, { responsiblePerson: v })} className="text-sm text-blue-600" placeholder="Person" />
                                  <EditableText value={task.responsibleFunction} onSave={(v) => updateTask(phase.id, task.id, { responsibleFunction: v })} className="text-sm text-gray-600" placeholder="Function" />
                                </div>
                              </div>
                            ) : (
                              <div>
                                <p className="font-medium">{task.name}</p>
                                <div className="grid grid-cols-2 gap-2">
                                  <p className="text-sm text-blue-600">{task.responsiblePerson}</p>
                                  <p className="text-sm text-gray-600">{task.responsibleFunction}</p>
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center space-x-2">
                            {canEdit ? (
                              <>
                                <EditableSelect value={task.status} options={STATUS_OPTIONS} onSave={(v) => updateTask(phase.id, task.id, { status: v })} />
                                <Button size="sm" variant="outline" onClick={() => removeTask(phase.id, task.id)} className="text-red-600 hover:text-red-700" aria-label={`Delete ${task.name}`}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            ) : (
                              <StatusBadge status={task.status} />
                            )}
                          </div>
                        </div>
                      ))}
                      {canEdit && (
                        <Button onClick={() => addTask(phase.id)} variant="outline" className="w-full">
                          <Plus className="h-4 w-4 mr-2" />
                          Add Task
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <InteractiveCharts phases={phases} overallProgress={overallProgress} adminSettings={adminSettings} />
          </TabsContent>

          <TabsContent value="admin" className="space-y-6">
            {canEdit ? (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Settings className="w-5 h-5" />
                      <span>Project Manager</span>
                    </CardTitle>
                    <CardDescription>Advanced project management and task control</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <EnhancedProjectManager
                      phases={phases}
                      setPhases={setPhases}
                      currentUser={currentUser}
                      onPhaseUpdate={updatePhase}
                      onTaskUpdate={updateTask}
                      onAddTask={addTask}
                      onRemoveTask={removeTask}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Users className="w-5 h-5" />
                      <span>User Management</span>
                    </CardTitle>
                    <CardDescription>Manage team members, roles, and login PINs</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <UserManagement currentUser={currentUser} users={users} setUsers={setUsers} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Shield className="w-5 h-5" />
                      <span>System Administration</span>
                    </CardTitle>
                    <CardDescription>Branding, appearance, and data export / import</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <EnhancedAdminSettings
                      adminSettings={adminSettings}
                      onSettingsUpdate={updateAdminSettings}
                      currentUser={currentUser}
                      systemStats={systemStats}
                    />
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Admin Settings</CardTitle>
                  <CardDescription>Enable edit mode to access admin settings, project management, and user management</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">
                    These features are only available in Project Manager mode. Use the Project Manager button in the header to enable edit mode.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}

export default App
