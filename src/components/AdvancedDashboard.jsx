import { useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Button } from '@/components/ui/button.jsx'
import { Switch } from '@/components/ui/switch.jsx'
import { Label } from '@/components/ui/label.jsx'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Activity,
  AlertTriangle,
  Ban,
  Building2,
  CheckCircle,
  Clock,
  Download,
  LayoutDashboard,
  Server,
  Settings,
  Shield,
  Target,
  Users,
} from 'lucide-react'
import { computeStats, getStatusLabel, STATUS_OPTIONS } from '@/lib/model.js'

// ---------------------------------------------------------------------------
// Static lookups (full class strings: Tailwind v4 cannot see interpolated names)
// ---------------------------------------------------------------------------

const TONE_CLASSES = {
  blue: { bg: 'bg-blue-100', icon: 'text-blue-600' },
  green: { bg: 'bg-green-100', icon: 'text-green-600' },
  orange: { bg: 'bg-orange-100', icon: 'text-orange-600' },
  gray: { bg: 'bg-gray-100', icon: 'text-gray-600' },
  red: { bg: 'bg-red-100', icon: 'text-red-600' },
  yellow: { bg: 'bg-yellow-100', icon: 'text-yellow-600' },
}

// Same hues as the status badges/dots in App.jsx so a status reads the same everywhere.
const STATUS_COLORS = {
  completed: '#22c55e',
  'in-progress': '#3b82f6',
  pending: '#9ca3af',
  blocked: '#ef4444',
  'on-hold': '#eab308',
}

const GRID_STROKE = '#e5e7eb'
const AXIS_TICK = { fontSize: 12, fill: '#6b7280' }

/** Pie slice label in a text colour; the slice itself carries the hue. */
const renderPieLabel = ({ x, y, textAnchor, name, percent }) => (
  <text x={x} y={y} textAnchor={textAnchor} dominantBaseline="central" fontSize={12} fill="#374151">
    {`${name} ${Math.round(percent * 100)}%`}
  </text>
)

const WIDGETS = [
  { key: 'overview', label: 'Task overview' },
  { key: 'phaseProgress', label: 'Phase progress' },
  { key: 'taskStatus', label: 'Task status' },
  { key: 'phaseTasks', label: 'Tasks per phase' },
]

const CONTEXT_TILES = [
  { key: 'totalServices', title: 'Cloud Services', icon: Server, suffix: '+' },
  { key: 'dataCenters', title: 'Data Centers', icon: Building2, suffix: '' },
  { key: 'complianceCerts', title: 'Compliance Certs', icon: Shield, suffix: '' },
  { key: 'teamMembers', title: 'Team Members', icon: Users, suffix: '' },
]

function shortName(name, max = 18) {
  const text = String(name || '')
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ---------------------------------------------------------------------------
// Presentational sub-components (module level, never re-created per render)
// ---------------------------------------------------------------------------

function MetricCard({ title, value, icon: Icon, tone = 'blue' }) {
  const classes = TONE_CLASSES[tone] || TONE_CLASSES.blue
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <p className="text-3xl font-bold">{value}</p>
          </div>
          <div className={`p-3 rounded-full ${classes.bg}`}>
            <Icon className={`w-6 h-6 ${classes.icon}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ContextTile({ title, value, icon: Icon, color }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold" style={{ color }}>
          {value}
        </div>
      </CardContent>
    </Card>
  )
}

/** Single ring gauge for a 0-100 percentage. */
function RingGauge({ value, label, color }) {
  const pct = Math.max(0, Math.min(100, Math.round(Number(value) || 0)))
  return (
    <div className="text-center">
      <div className="relative w-24 h-24 mx-auto mb-2">
        <svg
          className="w-24 h-24 -rotate-90"
          viewBox="0 0 36 36"
          role="img"
          aria-label={`${label}: ${pct}%`}
        >
          <path
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke={GRID_STROKE}
            strokeWidth="2.5"
          />
          <path
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={`${pct}, 100`}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold">{pct}%</span>
        </div>
      </div>
      <p className="text-sm font-medium text-gray-600">{label}</p>
    </div>
  )
}

function ChartWidget({ title, description, children }) {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function EmptyState({ message }) {
  return <p className="py-12 text-center text-sm text-gray-500">{message}</p>
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

const AdvancedDashboard = ({ phases, metrics, adminSettings }) => {
  const [activeWidgets, setActiveWidgets] = useState(() =>
    Object.fromEntries(WIDGETS.map((w) => [w.key, true])),
  )

  const primary = adminSettings?.primaryColor || '#E30613'
  const secondary = adminSettings?.secondaryColor || '#1B365D'

  const stats = useMemo(() => computeStats(phases), [phases])

  const phaseRows = useMemo(
    () =>
      phases.map((phase) => {
        const tasks = phase.tasks || []
        const completed = tasks.filter((t) => t.status === 'completed').length
        return {
          id: phase.id,
          name: shortName(phase.name),
          fullName: phase.name,
          progress: phase.progress || 0,
          total: tasks.length,
          completed,
          remaining: tasks.length - completed,
        }
      }),
    [phases],
  )

  const statusSlices = useMemo(() => {
    const counts = {
      completed: stats.completedTasks,
      'in-progress': stats.inProgressTasks,
      pending: stats.pendingTasks,
      blocked: stats.blockedTasks,
      'on-hold': stats.onHoldTasks,
    }
    return STATUS_OPTIONS.map((o) => ({
      status: o.value,
      name: o.label,
      value: counts[o.value] || 0,
      color: STATUS_COLORS[o.value],
    })).filter((s) => s.value > 0)
  }, [stats])

  const toggleWidget = (key) => setActiveWidgets((prev) => ({ ...prev, [key]: !prev[key] }))

  const exportDashboard = () => {
    downloadJson(
      {
        exportedAt: new Date().toISOString(),
        stats,
        metrics,
        phases: phases.map((p) => ({
          id: p.id,
          name: p.name,
          status: p.status,
          progress: p.progress,
          startDate: p.startDate,
          endDate: p.endDate,
          totalTasks: (p.tasks || []).length,
          completedTasks: (p.tasks || []).filter((t) => t.status === 'completed').length,
        })),
      },
      `dashboard-export-${new Date().toISOString().split('T')[0]}.json`,
    )
  }

  const hasPhases = phases.length > 0
  const hasTasks = stats.totalTasks > 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <LayoutDashboard className="w-5 h-5" />
                <span>Project Dashboard</span>
              </CardTitle>
              <CardDescription>
                Every figure below is derived from the current phases and tasks.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={exportDashboard}>
              <Download className="w-4 h-4 mr-1" />
              Export JSON
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Task overview */}
      {activeWidgets.overview && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <MetricCard title="Total Tasks" value={stats.totalTasks} icon={Target} tone="blue" />
          <MetricCard title="Completed" value={stats.completedTasks} icon={CheckCircle} tone="green" />
          <MetricCard title="In Progress" value={stats.inProgressTasks} icon={Activity} tone="orange" />
          <MetricCard title="Pending" value={stats.pendingTasks} icon={Clock} tone="gray" />
          <MetricCard title="Overdue" value={stats.overdueTasks} icon={AlertTriangle} tone="red" />
          <MetricCard title="Blocked" value={stats.blockedTasks} icon={Ban} tone="yellow" />
        </div>
      )}

      {/* Rates + launch context */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Progress</CardTitle>
            <CardDescription>
              Completion rate is completed ÷ total tasks; phase progress is the mean of each phase&apos;s
              progress value.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <RingGauge value={stats.completionRate} label="Completion Rate" color={primary} />
              <RingGauge value={stats.averagePhaseProgress} label="Avg Phase Progress" color={secondary} />
            </div>
          </CardContent>
        </Card>
        <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
          {CONTEXT_TILES.map(({ key, title, icon, suffix }) => (
            <ContextTile
              key={key}
              title={title}
              icon={icon}
              color={primary}
              value={`${metrics?.[key] ?? 0}${suffix}`}
            />
          ))}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {activeWidgets.phaseProgress && (
          <ChartWidget title="Phase Progress" description="Progress value recorded on each phase">
            {hasPhases ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={phaseRows} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                  <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                  <XAxis dataKey="name" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID_STROKE }} />
                  <YAxis domain={[0, 100]} unit="%" tick={AXIS_TICK} tickLine={false} axisLine={false} width={44} />
                  <Tooltip formatter={(v) => [`${v}%`, 'Progress']} labelFormatter={(_, p) => p?.[0]?.payload?.fullName ?? ''} />
                  <Bar dataKey="progress" name="Progress" fill={primary} radius={[4, 4, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState message="No phases yet." />
            )}
          </ChartWidget>
        )}

        {activeWidgets.taskStatus && (
          <ChartWidget title="Task Status Distribution" description="All tasks across all phases, by status">
            {hasTasks ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statusSlices}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                    stroke="#ffffff"
                    strokeWidth={2}
                    labelLine={false}
                    label={renderPieLabel}
                  >
                    {statusSlices.map((slice) => (
                      <Cell key={slice.status} fill={slice.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, name) => [v, name]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState message="No tasks yet." />
            )}
          </ChartWidget>
        )}

        {activeWidgets.phaseTasks && (
          <ChartWidget
            title="Tasks per Phase"
            description="Completed and remaining tasks stacked; the full bar is the phase's total"
          >
            {hasPhases ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={phaseRows} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                  <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                  <XAxis dataKey="name" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID_STROKE }} />
                  <YAxis allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} width={36} />
                  <Tooltip labelFormatter={(_, p) => p?.[0]?.payload?.fullName ?? ''} />
                  <Legend />
                  <Bar dataKey="completed" name="Completed" stackId="tasks" fill={primary} maxBarSize={48} />
                  <Bar
                    dataKey="remaining"
                    name="Remaining"
                    stackId="tasks"
                    fill={secondary}
                    fillOpacity={0.35}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={48}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState message="No phases yet." />
            )}
          </ChartWidget>
        )}

        {activeWidgets.overview && (
          <ChartWidget title="Attention Needed" description="Counts, not scores">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border p-4">
                <div className="flex items-center space-x-2 text-red-600">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-sm font-medium">Overdue</span>
                </div>
                <p className="text-3xl font-bold mt-2">{stats.overdueTasks}</p>
                <p className="text-xs text-gray-500 mt-1">Open tasks whose due date has passed</p>
              </div>
              <div className="rounded-lg border p-4">
                <div className="flex items-center space-x-2 text-yellow-600">
                  <Ban className="w-4 h-4" />
                  <span className="text-sm font-medium">Blocked</span>
                </div>
                <p className="text-3xl font-bold mt-2">{stats.blockedTasks}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Tasks with status &quot;{getStatusLabel('blocked')}&quot;
                </p>
              </div>
            </div>
          </ChartWidget>
        )}
      </div>

      {/* Widget visibility */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="w-5 h-5" />
            <span>Dashboard Widgets</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {WIDGETS.map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between p-3 border rounded">
                <Label htmlFor={`widget-${key}`} className="font-medium">
                  {label}
                </Label>
                <Switch
                  id={`widget-${key}`}
                  checked={activeWidgets[key]}
                  onCheckedChange={() => toggleWidget(key)}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default AdvancedDashboard
