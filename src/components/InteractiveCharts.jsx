import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Button } from '@/components/ui/button.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table.jsx'
import { Download, List, X } from 'lucide-react'
import { computeStats, getStatusLabel, STATUS_OPTIONS } from '@/lib/model.js'

// ---------------------------------------------------------------------------
// Static lookups
// ---------------------------------------------------------------------------

// Same hues as the status badges/dots in App.jsx.
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
const UNASSIGNED = 'Unassigned'

const INSIGHT_BADGE = {
  ok: 'bg-green-100 text-green-800',
  warn: 'bg-yellow-100 text-yellow-800',
  bad: 'bg-red-100 text-red-800',
  info: 'bg-gray-100 text-gray-800',
}

function shortName(name, max = 18) {
  const text = String(name || '')
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

/**
 * Where a phase "should" be today, by elapsed calendar time:
 * 100 once endDate has passed, 0 before startDate, prorated in between.
 * null when the phase has no usable dates.
 */
function plannedProgress(phase, now) {
  const start = Date.parse(phase.startDate)
  const end = Date.parse(phase.endDate)
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null
  if (now >= end) return 100
  if (now <= start) return 0
  return Math.round(((now - start) / (end - start)) * 100)
}

function slug(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

/** Serialise the recharts <svg> inside `container` and download it. */
function downloadSvg(container, title) {
  const svg = container?.querySelector('svg.recharts-surface')
  if (!svg) return
  const clone = svg.cloneNode(true)
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  const source = new XMLSerializer().serializeToString(clone)
  const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${slug(title) || 'chart'}.svg`
  a.click()
  URL.revokeObjectURL(url)
}

const pct = (v) => (v === null || v === undefined ? '—' : `${v}%`)

// ---------------------------------------------------------------------------
// Presentational sub-components (module level)
// ---------------------------------------------------------------------------

function CustomTooltip({ active, payload, label, unit = '' }) {
  if (!active || !payload || payload.length === 0) return null
  const title = payload[0]?.payload?.fullName ?? label
  return (
    <div className="bg-white p-3 border rounded-lg shadow-lg">
      <p className="font-medium text-sm">{title}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2 mt-1">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-sm text-gray-700">
            {entry.name}: {entry.value === null || entry.value === undefined ? '—' : `${entry.value}${unit}`}
          </span>
        </div>
      ))}
    </div>
  )
}

function ChartCard({ title, description, onDetails, children }) {
  const contentRef = useRef(null)
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle>{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={onDetails}>
              <List className="h-4 w-4 mr-1" />
              Details
            </Button>
            <Button
              size="sm"
              variant="ghost"
              aria-label={`Download ${title} as SVG`}
              onClick={() => downloadSvg(contentRef.current, title)}
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div ref={contentRef}>{children}</div>
      </CardContent>
    </Card>
  )
}

function EmptyState({ message }) {
  return <p className="py-12 text-center text-sm text-gray-500">{message}</p>
}

/** chart = { title, columns: [{ key, label, format? }], rows: object[] } */
function DrillDownModal({ chart, onClose }) {
  useEffect(() => {
    if (!chart) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [chart, onClose])

  if (!chart) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <Card
        className="w-full max-w-3xl max-h-[80vh] overflow-auto"
        role="dialog"
        aria-modal="true"
        aria-label={`${chart.title} data`}
        onClick={(e) => e.stopPropagation()}
      >
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>{chart.title}</CardTitle>
              <CardDescription>The series behind this chart, {chart.rows.length} rows</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                {chart.columns.map((col) => (
                  <TableHead key={col.key}>{col.label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {chart.rows.map((row, i) => (
                <TableRow key={row.id ?? i}>
                  {chart.columns.map((col) => (
                    <TableCell key={col.key} className="tabular-nums">
                      {col.format ? col.format(row[col.key]) : row[col.key]}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Charts
// ---------------------------------------------------------------------------

const InteractiveCharts = ({ phases, overallProgress, adminSettings }) => {
  const [selectedChart, setSelectedChart] = useState(null)
  const closeModal = useCallback(() => setSelectedChart(null), [])

  const primary = adminSettings?.primaryColor || '#E30613'
  const secondary = adminSettings?.secondaryColor || '#1B365D'
  const accent = adminSettings?.accentColor || '#FFB81C'

  const stats = useMemo(() => computeStats(phases), [phases])

  // Planned vs actual per phase.
  const planRows = useMemo(() => {
    const now = Date.now()
    return phases.map((phase) => ({
      id: phase.id,
      name: shortName(phase.name),
      fullName: phase.name,
      status: phase.status,
      planned: plannedProgress(phase, now),
      actual: phase.progress || 0,
      tasks: (phase.tasks || []).length,
    }))
  }, [phases])

  const phaseStatusSlices = useMemo(
    () =>
      STATUS_OPTIONS.map((o) => ({
        status: o.value,
        name: o.label,
        value: phases.filter((p) => p.status === o.value).length,
        color: STATUS_COLORS[o.value],
      })).filter((s) => s.value > 0),
    [phases],
  )

  // Tasks per responsible function, completed vs open.
  const functionRows = useMemo(() => {
    const byFunction = new Map()
    for (const phase of phases) {
      for (const task of phase.tasks || []) {
        const key = (task.responsibleFunction || '').trim() || UNASSIGNED
        const row = byFunction.get(key) || { id: key, name: key, fullName: key, completed: 0, open: 0, total: 0 }
        row.total += 1
        if (task.status === 'completed') row.completed += 1
        else row.open += 1
        byFunction.set(key, row)
      }
    }
    return [...byFunction.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
  }, [phases])

  const insights = useMemo(() => {
    const withPlan = planRows.filter((r) => r.planned !== null)
    const behind = withPlan.filter((r) => r.actual < r.planned)
    const list = []

    if (withPlan.length === 0) {
      list.push({ tone: 'info', text: 'No phase has both a start and an end date, so plan vs actual cannot be computed.' })
    } else {
      list.push({
        tone: behind.length === 0 ? 'ok' : 'warn',
        text: `${behind.length} of ${withPlan.length} dated phase${withPlan.length === 1 ? '' : 's'} behind plan`,
      })
      for (const r of behind) {
        list.push({ tone: 'warn', text: `${r.fullName}: ${r.actual}% actual vs ${r.planned}% planned` })
      }
    }

    list.push({
      tone: stats.overdueTasks > 0 ? 'bad' : 'ok',
      text: `${stats.overdueTasks} task${stats.overdueTasks === 1 ? '' : 's'} overdue`,
    })
    list.push({
      tone: stats.blockedTasks > 0 ? 'bad' : 'ok',
      text: `${stats.blockedTasks} task${stats.blockedTasks === 1 ? '' : 's'} blocked`,
    })
    list.push({
      tone: 'info',
      text: `Overall progress set to ${overallProgress}%; average phase progress is ${stats.averagePhaseProgress}%`,
    })
    return list
  }, [planRows, stats, overallProgress])

  const hasPhases = phases.length > 0
  const hasTasks = stats.totalTasks > 0

  // --- Drill-down descriptors ---------------------------------------------
  const openPlanDetails = () =>
    setSelectedChart({
      title: 'Planned vs Actual Progress',
      columns: [
        { key: 'fullName', label: 'Phase' },
        { key: 'status', label: 'Status', format: getStatusLabel },
        { key: 'planned', label: 'Planned', format: pct },
        { key: 'actual', label: 'Actual', format: pct },
        { key: 'tasks', label: 'Tasks' },
      ],
      rows: planRows,
    })

  const openProgressDetails = () =>
    setSelectedChart({
      title: 'Phase Progress',
      columns: [
        { key: 'fullName', label: 'Phase' },
        { key: 'status', label: 'Status', format: getStatusLabel },
        { key: 'actual', label: 'Progress', format: pct },
      ],
      rows: planRows,
    })

  const openStatusDetails = () =>
    setSelectedChart({
      title: 'Phase Status Overview',
      columns: [
        { key: 'name', label: 'Status' },
        { key: 'value', label: 'Phases' },
      ],
      rows: phaseStatusSlices.map((s) => ({ ...s, id: s.status })),
    })

  const openFunctionDetails = () =>
    setSelectedChart({
      title: 'Tasks by Responsible Function',
      columns: [
        { key: 'name', label: 'Function' },
        { key: 'completed', label: 'Completed' },
        { key: 'open', label: 'Open' },
        { key: 'total', label: 'Total' },
      ],
      rows: functionRows,
    })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-gray-600">
          All series are derived from the phases and tasks. Click a chart, or its Details button, to see
          the underlying numbers.
        </p>
      </div>

      <Tabs defaultValue="progress" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="progress">Progress Tracking</TabsTrigger>
          <TabsTrigger value="phases">Phase Analysis</TabsTrigger>
          <TabsTrigger value="workload">Workload</TabsTrigger>
        </TabsList>

        <TabsContent value="progress" className="space-y-4">
          <ChartCard
            title="Planned vs Actual Progress"
            description="Planned = share of each phase's calendar window elapsed today; actual = recorded phase progress"
            onDetails={openPlanDetails}
          >
            {hasPhases ? (
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={planRows} margin={{ top: 16, right: 56, left: 0, bottom: 8 }} onClick={openPlanDetails}>
                  <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                  <XAxis dataKey="name" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID_STROKE }} />
                  <YAxis domain={[0, 100]} unit="%" tick={AXIS_TICK} tickLine={false} axisLine={false} width={44} />
                  <Tooltip content={<CustomTooltip unit="%" />} />
                  <Legend />
                  <ReferenceLine
                    y={overallProgress}
                    stroke={accent}
                    strokeWidth={2}
                    label={{ value: `Overall ${overallProgress}%`, position: 'right', fill: '#6b7280', fontSize: 12 }}
                  />
                  <Bar dataKey="actual" name="Actual" fill={primary} radius={[4, 4, 0, 0]} maxBarSize={48} />
                  <Line
                    type="monotone"
                    dataKey="planned"
                    name="Planned"
                    stroke={secondary}
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    dot={{ r: 4, strokeWidth: 2, fill: '#ffffff' }}
                    connectNulls={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState message="No phases yet." />
            )}
          </ChartCard>

          <Card>
            <CardHeader>
              <CardTitle>Insights</CardTitle>
              <CardDescription>Computed from the data above</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {insights.map((item) => (
                  <li key={item.text} className="flex items-center gap-2 text-sm">
                    <Badge className={INSIGHT_BADGE[item.tone]}>
                      {item.tone === 'ok' ? 'OK' : item.tone === 'info' ? 'Info' : 'Attention'}
                    </Badge>
                    <span>{item.text}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="phases" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ChartCard title="Phase Progress" description="Recorded progress per phase" onDetails={openProgressDetails}>
              {hasPhases ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={planRows} margin={{ top: 8, right: 8, left: 0, bottom: 8 }} onClick={openProgressDetails}>
                    <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                    <XAxis dataKey="name" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID_STROKE }} />
                    <YAxis domain={[0, 100]} unit="%" tick={AXIS_TICK} tickLine={false} axisLine={false} width={44} />
                    <Tooltip content={<CustomTooltip unit="%" />} />
                    <Bar dataKey="actual" name="Progress" fill={primary} radius={[4, 4, 0, 0]} maxBarSize={48} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState message="No phases yet." />
              )}
            </ChartCard>

            <ChartCard title="Phase Status Overview" description="Number of phases in each status" onDetails={openStatusDetails}>
              {hasPhases ? (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart onClick={openStatusDetails}>
                    <Pie
                      data={phaseStatusSlices}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      stroke="#ffffff"
                      strokeWidth={2}
                      labelLine={false}
                      label={renderPieLabel}
                    >
                      {phaseStatusSlices.map((slice) => (
                        <Cell key={slice.status} fill={slice.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState message="No phases yet." />
              )}
            </ChartCard>
          </div>
        </TabsContent>

        <TabsContent value="workload" className="space-y-4">
          <ChartCard
            title="Tasks by Responsible Function"
            description="Completed and open tasks per function; the full bar is that function's total"
            onDetails={openFunctionDetails}
          >
            {hasTasks ? (
              <ResponsiveContainer width="100%" height={Math.max(220, functionRows.length * 30 + 60)}>
                <BarChart
                  data={functionRows}
                  layout="vertical"
                  margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
                  onClick={openFunctionDetails}
                >
                  <CartesianGrid stroke={GRID_STROKE} horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" width={180} tick={AXIS_TICK} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="completed" name="Completed" stackId="tasks" fill={primary} maxBarSize={20} />
                  <Bar
                    dataKey="open"
                    name="Open"
                    stackId="tasks"
                    fill={secondary}
                    fillOpacity={0.35}
                    radius={[0, 4, 4, 0]}
                    maxBarSize={20}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState message="No tasks yet." />
            )}
          </ChartCard>
        </TabsContent>
      </Tabs>

      <DrillDownModal chart={selectedChart} onClose={closeModal} />
    </div>
  )
}

export default InteractiveCharts
