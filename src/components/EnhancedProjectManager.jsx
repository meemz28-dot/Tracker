import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Button } from '@/components/ui/button.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Label } from '@/components/ui/label.jsx'
import { Textarea } from '@/components/ui/textarea.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Progress } from '@/components/ui/progress.jsx'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.jsx'
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Edit,
  PauseCircle,
  PlayCircle,
  Plus,
  Search,
  Send,
  StopCircle,
  Target,
  Trash2,
  Users,
} from 'lucide-react'
import { format } from 'date-fns'
import {
  STATUS_OPTIONS,
  PRIORITY_OPTIONS,
  createPhase,
  computeStats,
  getStatusLabel,
  clampPercent,
  newId,
} from '@/lib/model.js'
import { loadJSON, saveJSON } from '@/lib/storage.js'
import { STORAGE_KEYS } from '@/lib/config.js'

// ---------------------------------------------------------------------------
// Presentation lookups (full class strings so Tailwind can see them)
// ---------------------------------------------------------------------------

const STATUS_BADGE = {
  pending: 'bg-gray-100 text-gray-800',
  'in-progress': 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  blocked: 'bg-red-100 text-red-800',
  'on-hold': 'bg-yellow-100 text-yellow-800',
}

const STATUS_ICON = {
  pending: Clock,
  'in-progress': PlayCircle,
  completed: CheckCircle,
  blocked: AlertTriangle,
  'on-hold': PauseCircle,
}

const PRIORITY_BADGE = {
  low: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
}

const PRIORITY_LABEL = Object.fromEntries(PRIORITY_OPTIONS.map((o) => [o.value, o.label]))

const TASK_PREVIEW_COUNT = 3
const PEOPLE_LIST_ID = 'epm-responsible-people'

// ---------------------------------------------------------------------------
// Form helpers. Forms keep numbers as strings while editing so the user can
// clear a field; they are converted (never to NaN) on submit.
// ---------------------------------------------------------------------------

const EMPTY_TASK_FORM = {
  name: '',
  description: '',
  status: 'pending',
  priority: 'medium',
  responsiblePerson: '',
  responsibleFunction: '',
  dueDate: '',
  estimatedHours: '0',
}

const EMPTY_PHASE_FORM = {
  name: '',
  description: '',
  status: 'pending',
  progress: '0',
  startDate: '',
  endDate: '',
  responsiblePerson: '',
  responsibleFunction: '',
}

function toHours(value) {
  const n = parseFloat(value)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

function taskToForm(task) {
  return {
    name: task.name || '',
    description: task.description || '',
    status: task.status || 'pending',
    priority: task.priority || 'medium',
    responsiblePerson: task.responsiblePerson || '',
    responsibleFunction: task.responsibleFunction || '',
    dueDate: task.dueDate || '',
    estimatedHours: String(task.estimatedHours ?? 0),
  }
}

function formToTask(form) {
  return {
    name: form.name.trim(),
    description: form.description.trim(),
    status: form.status,
    priority: form.priority,
    responsiblePerson: form.responsiblePerson.trim(),
    responsibleFunction: form.responsibleFunction.trim(),
    dueDate: form.dueDate,
    estimatedHours: toHours(form.estimatedHours),
  }
}

function phaseToForm(phase) {
  return {
    name: phase.name || '',
    description: phase.description || '',
    status: phase.status || 'pending',
    progress: String(clampPercent(phase.progress)),
    startDate: phase.startDate || '',
    endDate: phase.endDate || '',
    responsiblePerson: phase.responsiblePerson || '',
    responsibleFunction: phase.responsibleFunction || '',
  }
}

function formToPhase(form) {
  return {
    name: form.name.trim(),
    description: form.description.trim(),
    status: form.status,
    progress: clampPercent(form.progress),
    startDate: form.startDate,
    endDate: form.endDate,
    responsiblePerson: form.responsiblePerson.trim(),
    responsibleFunction: form.responsibleFunction.trim(),
  }
}

function isOverdue(task) {
  return Boolean(task.dueDate) && task.status !== 'completed' && new Date(task.dueDate) < new Date()
}

function includesText(value, term) {
  return String(value || '').toLowerCase().includes(term)
}

function formatHours(hours) {
  return `${(Number(hours) || 0).toFixed(1)}h`
}

function formatTimestamp(iso) {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : format(date, 'MMM dd, yyyy HH:mm')
}

/** A persisted map keyed by task id; anything that is not a plain object is discarded. */
function loadMap(key) {
  const value = loadJSON(key, {})
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function omitKey(map, key) {
  if (!(key in map)) return map
  const next = { ...map }
  delete next[key]
  return next
}

/**
 * Apply search / status / priority filters.
 * - Search matches phase name/description (phase keeps all its tasks) or
 *   task name/responsible person (phase keeps only matching tasks).
 * - Status filters phases. Priority filters tasks; a phase with no task of
 *   that priority is hidden.
 * Returns [{ phase, tasks }] where tasks are the ones to display.
 */
function filterPhases(phases, term, status, priority) {
  return phases.flatMap((phase) => {
    if (status !== 'all' && phase.status !== status) return []
    const allTasks = phase.tasks || []
    let tasks = allTasks
    if (term) {
      const phaseMatches = includesText(phase.name, term) || includesText(phase.description, term)
      if (!phaseMatches) {
        tasks = tasks.filter(
          (t) => includesText(t.name, term) || includesText(t.responsiblePerson, term),
        )
        if (tasks.length === 0) return []
      }
    }
    if (priority !== 'all') {
      tasks = tasks.filter((t) => t.priority === priority)
      if (tasks.length === 0) return []
    }
    return [{ phase, tasks }]
  })
}

// ---------------------------------------------------------------------------
// Small presentational pieces
// ---------------------------------------------------------------------------

function StatusBadge({ status, variant }) {
  return (
    <Badge variant={variant} className={STATUS_BADGE[status] || STATUS_BADGE.pending}>
      {getStatusLabel(status)}
    </Badge>
  )
}

function PriorityBadge({ priority }) {
  return (
    <Badge variant="outline" className={PRIORITY_BADGE[priority] || PRIORITY_BADGE.medium}>
      {PRIORITY_LABEL[priority] || priority}
    </Badge>
  )
}

function PeopleDatalist({ people }) {
  return (
    <datalist id={PEOPLE_LIST_ID}>
      {people.map((person) => (
        <option key={person} value={person} />
      ))}
    </datalist>
  )
}

function StatusSelect({ value, onChange }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUS_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function PrioritySelect({ value, onChange }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PRIORITY_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function TaskFormFields({ form, onChange, showStatus = false }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="space-y-1">
        <Label htmlFor="epm-task-name">Task Name</Label>
        <Input
          id="epm-task-name"
          value={form.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Enter task name"
        />
      </div>
      <div className="space-y-1">
        <Label>Priority</Label>
        <PrioritySelect value={form.priority} onChange={(value) => onChange({ priority: value })} />
      </div>
      {showStatus && (
        <div className="space-y-1">
          <Label>Status</Label>
          <StatusSelect value={form.status} onChange={(value) => onChange({ status: value })} />
        </div>
      )}
      <div className="sm:col-span-2 space-y-1">
        <Label htmlFor="epm-task-description">Description</Label>
        <Textarea
          id="epm-task-description"
          value={form.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Enter task description"
          rows={3}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="epm-task-person">Responsible Person</Label>
        <Input
          id="epm-task-person"
          list={PEOPLE_LIST_ID}
          value={form.responsiblePerson}
          onChange={(e) => onChange({ responsiblePerson: e.target.value })}
          placeholder="Who owns this task"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="epm-task-function">Function / Role</Label>
        <Input
          id="epm-task-function"
          value={form.responsibleFunction}
          onChange={(e) => onChange({ responsibleFunction: e.target.value })}
          placeholder="Enter role or function"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="epm-task-due">Due Date</Label>
        <Input
          id="epm-task-due"
          type="date"
          value={form.dueDate}
          onChange={(e) => onChange({ dueDate: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="epm-task-hours">Estimated Hours</Label>
        <Input
          id="epm-task-hours"
          type="number"
          min="0"
          step="0.5"
          value={form.estimatedHours}
          onChange={(e) => onChange({ estimatedHours: e.target.value })}
        />
      </div>
    </div>
  )
}

function PhaseFormFields({ form, onChange }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="space-y-1">
        <Label htmlFor="epm-phase-name">Phase Name</Label>
        <Input
          id="epm-phase-name"
          value={form.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Enter phase name"
        />
      </div>
      <div className="space-y-1">
        <Label>Status</Label>
        <StatusSelect value={form.status} onChange={(value) => onChange({ status: value })} />
      </div>
      <div className="sm:col-span-2 space-y-1">
        <Label htmlFor="epm-phase-description">Description</Label>
        <Textarea
          id="epm-phase-description"
          value={form.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Enter phase description"
          rows={3}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="epm-phase-start">Start Date</Label>
        <Input
          id="epm-phase-start"
          type="date"
          value={form.startDate}
          onChange={(e) => onChange({ startDate: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="epm-phase-end">End Date</Label>
        <Input
          id="epm-phase-end"
          type="date"
          value={form.endDate}
          onChange={(e) => onChange({ endDate: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="epm-phase-person">Responsible Person</Label>
        <Input
          id="epm-phase-person"
          list={PEOPLE_LIST_ID}
          value={form.responsiblePerson}
          onChange={(e) => onChange({ responsiblePerson: e.target.value })}
          placeholder="Who owns this phase"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="epm-phase-function">Function / Role</Label>
        <Input
          id="epm-phase-function"
          value={form.responsibleFunction}
          onChange={(e) => onChange({ responsibleFunction: e.target.value })}
          placeholder="Enter role or function"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="epm-phase-progress">Progress (%)</Label>
        <Input
          id="epm-phase-progress"
          type="number"
          min="0"
          max="100"
          step="1"
          value={form.progress}
          onChange={(e) => onChange({ progress: e.target.value })}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Dialogs. Each is mounted only while open, so its local form state starts
// fresh every time it is opened.
// ---------------------------------------------------------------------------

function PhaseDialog({ initialForm, title, description, submitLabel, onSubmit, onClose }) {
  const [form, setForm] = useState(initialForm)
  const update = (patch) => setForm((prev) => ({ ...prev, ...patch }))
  const canSubmit = form.name.trim().length > 0

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <PhaseFormFields form={form} onChange={update} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onSubmit(form)} disabled={!canSubmit}>
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AddTaskDialog({ phase, onSubmit, onClose }) {
  const [form, setForm] = useState(EMPTY_TASK_FORM)
  const update = (patch) => setForm((prev) => ({ ...prev, ...patch }))
  const canSubmit = form.name.trim().length > 0

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Task to {phase.name}</DialogTitle>
          <DialogDescription>Create a new task with an owner, priority and due date</DialogDescription>
        </DialogHeader>
        <TaskFormFields form={form} onChange={update} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onSubmit(form)} disabled={!canSubmit}>
            Add Task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TaskDetailDialog({
  task,
  tracking,
  comments,
  onSave,
  onStartTimer,
  onStopTimer,
  onAddComment,
  onClose,
}) {
  const [form, setForm] = useState(() => taskToForm(task))
  const [newComment, setNewComment] = useState('')
  const update = (patch) => setForm((prev) => ({ ...prev, ...patch }))
  const canSave = form.name.trim().length > 0

  const sessions = tracking?.sessions || []
  const recentSessions = sessions.slice(-5).reverse()

  const submitComment = () => {
    const text = newComment.trim()
    if (!text) return
    onAddComment(text)
    setNewComment('')
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Edit className="w-5 h-5" />
            <span>Task Details: {task.name}</span>
          </DialogTitle>
          <DialogDescription>Edit the task, track time against it, or leave a comment</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="time">Time Tracking</TabsTrigger>
            <TabsTrigger value="comments">Comments ({comments.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4">
            <TaskFormFields form={form} onChange={update} showStatus />
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setForm(taskToForm(task))}>
                Reset
              </Button>
              <Button onClick={() => onSave(formToTask(form))} disabled={!canSave}>
                Save Changes
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="time" className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">{formatHours(tracking?.totalTime)}</div>
                  <div className="text-sm text-gray-500">Total Time</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">{formatHours(task.estimatedHours)}</div>
                  <div className="text-sm text-gray-500">Estimated</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-orange-600">{sessions.length}</div>
                  <div className="text-sm text-gray-500">Sessions</div>
                </CardContent>
              </Card>
            </div>

            <div className="flex flex-col items-center space-y-2">
              {tracking?.isActive ? (
                <>
                  <p className="text-sm text-gray-500">Running since {formatTimestamp(tracking.startTime)}</p>
                  <Button onClick={onStopTimer} variant="destructive">
                    <StopCircle className="w-4 h-4 mr-2" />
                    Stop Tracking
                  </Button>
                </>
              ) : (
                <Button onClick={onStartTimer}>
                  <PlayCircle className="w-4 h-4 mr-2" />
                  Start Tracking
                </Button>
              )}
            </div>

            {recentSessions.length > 0 && (
              <div className="space-y-1">
                <p className="text-sm font-medium">Recent sessions</p>
                {recentSessions.map((session) => (
                  <div key={session.id} className="flex items-center justify-between text-sm border rounded p-2">
                    <span className="text-gray-600">
                      {formatTimestamp(session.start)} - {formatTimestamp(session.end)}
                    </span>
                    <span className="font-medium">{formatHours(session.duration)}</span>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="comments" className="space-y-4">
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {comments.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No comments yet</p>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="border rounded p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{comment.author}</span>
                      <span className="text-sm text-gray-500">{formatTimestamp(comment.timestamp)}</span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{comment.text}</p>
                  </div>
                ))
              )}
            </div>
            <div className="flex space-x-2">
              <Input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    submitComment()
                  }
                }}
              />
              <Button onClick={submitComment} disabled={!newComment.trim()} aria-label="Send comment">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Phase card with its task list
// ---------------------------------------------------------------------------

function TaskRow({ task, tracking, onOpen, onDelete, onStartTimer, onStopTimer }) {
  const overdue = isOverdue(task)
  return (
    <div className="flex items-center justify-between p-2 border rounded text-sm gap-2">
      <div className="flex items-center flex-wrap gap-2 flex-1 min-w-0">
        <StatusBadge status={task.status} variant="outline" />
        <span className={overdue ? 'text-red-600 font-medium' : ''}>{task.name}</span>
        {task.priority !== 'medium' && <PriorityBadge priority={task.priority} />}
        {task.responsiblePerson && <span className="text-xs text-gray-500">{task.responsiblePerson}</span>}
        {overdue && <AlertTriangle className="w-4 h-4 text-red-500" aria-label="Overdue" />}
      </div>
      <div className="flex items-center space-x-1 shrink-0">
        {tracking?.isActive ? (
          <Button variant="ghost" size="sm" onClick={onStopTimer} className="text-red-600" aria-label={`Stop tracking ${task.name}`}>
            <StopCircle className="w-4 h-4" />
          </Button>
        ) : (
          <Button variant="ghost" size="sm" onClick={onStartTimer} className="text-green-600" aria-label={`Start tracking ${task.name}`}>
            <PlayCircle className="w-4 h-4" />
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onOpen} aria-label={`Edit ${task.name}`}>
          <Edit className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={onDelete} className="text-red-600" aria-label={`Delete ${task.name}`}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}

function PhaseCard({
  phase,
  tasks,
  timeTracking,
  expanded,
  onToggleExpand,
  onEdit,
  onDelete,
  onAddTask,
  onOpenTask,
  onDeleteTask,
  onStartTimer,
  onStopTimer,
}) {
  const StatusIcon = STATUS_ICON[phase.status] || Clock
  const allTasks = phase.tasks || []
  const completedCount = allTasks.filter((t) => t.status === 'completed').length
  const progress = clampPercent(phase.progress)
  const shownTasks = expanded ? tasks : tasks.slice(0, TASK_PREVIEW_COUNT)
  const hiddenCount = tasks.length - shownTasks.length
  const filteredOut = allTasks.length - tasks.length

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center flex-wrap gap-2 min-w-0">
            <StatusIcon className="w-5 h-5 shrink-0" />
            <CardTitle className="text-lg">{phase.name}</CardTitle>
            <StatusBadge status={phase.status} />
          </div>
          <div className="flex items-center space-x-1 shrink-0">
            <Button variant="ghost" size="sm" onClick={onEdit} aria-label={`Edit ${phase.name}`}>
              <Edit className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onAddTask} aria-label={`Add task to ${phase.name}`}>
              <Plus className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onDelete} className="text-red-600" aria-label={`Delete ${phase.name}`}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
        {phase.description && <CardDescription>{phase.description}</CardDescription>}
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-500">
          <span>
            {[phase.responsiblePerson, phase.responsibleFunction].filter(Boolean).join(' • ') || 'Unassigned'}
          </span>
          {(phase.startDate || phase.endDate) && (
            <span>
              {phase.startDate || '?'} - {phase.endDate || '?'}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2 text-sm">
              <span className="font-medium">Progress</span>
              <span className="text-gray-500">
                {progress}% • {completedCount}/{allTasks.length} tasks complete
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                Tasks ({tasks.length}
                {filteredOut > 0 ? ` of ${allTasks.length}` : ''})
              </span>
            </div>
            {tasks.length === 0 ? (
              <p className="text-sm text-gray-500">
                {allTasks.length === 0 ? 'No tasks yet.' : 'No tasks match the current filters.'}
              </p>
            ) : (
              <div className="space-y-1">
                {shownTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    tracking={timeTracking[task.id]}
                    onOpen={() => onOpenTask(task)}
                    onDelete={() => onDeleteTask(task)}
                    onStartTimer={() => onStartTimer(task.id)}
                    onStopTimer={() => onStopTimer(task.id)}
                  />
                ))}
                {(hiddenCount > 0 || expanded) && tasks.length > TASK_PREVIEW_COUNT && (
                  <div className="text-center">
                    <Button variant="ghost" size="sm" className="text-blue-600" onClick={onToggleExpand}>
                      {expanded ? (
                        <>
                          <ChevronUp className="w-4 h-4 mr-1" />
                          Show less
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-4 h-4 mr-1" />
                          Show {hiddenCount} more {hiddenCount === 1 ? 'task' : 'tasks'}
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}
            <Button variant="outline" size="sm" className="w-full" onClick={onAddTask}>
              <Plus className="w-4 h-4 mr-1" />
              Add Task
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const EnhancedProjectManager = ({
  phases,
  setPhases,
  currentUser,
  onPhaseUpdate,
  onTaskUpdate,
  onAddTask,
  onRemoveTask,
}) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterPriority, setFilterPriority] = useState('all')
  const [expandedPhaseIds, setExpandedPhaseIds] = useState(() => new Set())
  // { mode: 'add' } | { mode: 'edit', phaseId }
  const [phaseDialog, setPhaseDialog] = useState(null)
  const [addTaskForPhaseId, setAddTaskForPhaseId] = useState(null)
  // { phaseId, taskId } — the task itself is read live from `phases`.
  const [selectedTaskRef, setSelectedTaskRef] = useState(null)

  // Per-task data this panel owns, keyed by task id and persisted locally.
  const [timeTracking, setTimeTracking] = useState(() => loadMap(STORAGE_KEYS.taskTimeTracking))
  const [comments, setComments] = useState(() => loadMap(STORAGE_KEYS.taskComments))

  useEffect(() => {
    saveJSON(STORAGE_KEYS.taskTimeTracking, timeTracking)
  }, [timeTracking])

  useEffect(() => {
    saveJSON(STORAGE_KEYS.taskComments, comments)
  }, [comments])

  // --- Derived data -----------------------------------------------------------

  const people = useMemo(() => {
    const names = new Set()
    for (const phase of phases) {
      if (phase.responsiblePerson?.trim()) names.add(phase.responsiblePerson.trim())
      for (const task of phase.tasks || []) {
        if (task.responsiblePerson?.trim()) names.add(task.responsiblePerson.trim())
      }
    }
    return [...names].sort((a, b) => a.localeCompare(b))
  }, [phases])

  const stats = useMemo(() => computeStats(phases), [phases])

  const term = searchTerm.trim().toLowerCase()
  const visiblePhases = useMemo(
    () => filterPhases(phases, term, filterStatus, filterPriority),
    [phases, term, filterStatus, filterPriority],
  )
  const filtersActive = term !== '' || filterStatus !== 'all' || filterPriority !== 'all'

  const editingPhase =
    phaseDialog?.mode === 'edit' ? phases.find((p) => p.id === phaseDialog.phaseId) ?? null : null
  const addTaskPhase = addTaskForPhaseId ? phases.find((p) => p.id === addTaskForPhaseId) ?? null : null
  const selectedPhase = selectedTaskRef ? phases.find((p) => p.id === selectedTaskRef.phaseId) ?? null : null
  const selectedTask = selectedPhase?.tasks.find((t) => t.id === selectedTaskRef.taskId) ?? null

  // --- Phase handlers ---------------------------------------------------------

  const handleAddPhase = (form) => {
    setPhases((prev) => [...prev, createPhase(formToPhase(form))])
    setPhaseDialog(null)
  }

  const handleEditPhase = (phaseId, form) => {
    onPhaseUpdate(phaseId, formToPhase(form))
    setPhaseDialog(null)
  }

  const handleDeletePhase = (phase) => {
    const taskCount = (phase.tasks || []).length
    const detail = taskCount > 0 ? ` and its ${taskCount} task${taskCount === 1 ? '' : 's'}` : ''
    if (!window.confirm(`Delete phase "${phase.name}"${detail}? This cannot be undone.`)) return
    const taskIds = (phase.tasks || []).map((t) => t.id)
    setPhases((prev) => prev.filter((p) => p.id !== phase.id))
    setTimeTracking((prev) => taskIds.reduce(omitKey, prev))
    setComments((prev) => taskIds.reduce(omitKey, prev))
    if (selectedTaskRef?.phaseId === phase.id) setSelectedTaskRef(null)
  }

  const toggleExpanded = (phaseId) => {
    setExpandedPhaseIds((prev) => {
      const next = new Set(prev)
      if (next.has(phaseId)) next.delete(phaseId)
      else next.add(phaseId)
      return next
    })
  }

  // --- Task handlers ----------------------------------------------------------

  const handleAddTask = (phaseId, form) => {
    onAddTask(phaseId, formToTask(form))
    setAddTaskForPhaseId(null)
  }

  const handleDeleteTask = (phaseId, task) => {
    if (!window.confirm(`Delete task "${task.name}"?`)) return
    onRemoveTask(phaseId, task.id)
    setTimeTracking((prev) => omitKey(prev, task.id))
    setComments((prev) => omitKey(prev, task.id))
    if (selectedTaskRef?.taskId === task.id) setSelectedTaskRef(null)
  }

  const startTimer = (taskId) => {
    setTimeTracking((prev) => ({
      ...prev,
      [taskId]: { ...(prev[taskId] || {}), isActive: true, startTime: new Date().toISOString() },
    }))
  }

  const stopTimer = (taskId) => {
    setTimeTracking((prev) => {
      const current = prev[taskId]
      if (!current?.isActive) return prev
      const end = new Date()
      const start = new Date(current.startTime)
      const duration = Number.isNaN(start.getTime()) ? 0 : Math.max(0, (end - start) / 3600000)
      return {
        ...prev,
        [taskId]: {
          isActive: false,
          startTime: null,
          totalTime: (Number(current.totalTime) || 0) + duration,
          sessions: [
            ...(current.sessions || []),
            { id: newId('session'), start: current.startTime, end: end.toISOString(), duration },
          ],
        },
      }
    })
  }

  const addComment = (taskId, text) => {
    const comment = {
      id: newId('comment'),
      text,
      author: currentUser?.name || 'Anonymous',
      timestamp: new Date().toISOString(),
    }
    setComments((prev) => ({ ...prev, [taskId]: [...(prev[taskId] || []), comment] }))
  }

  // --- Render -----------------------------------------------------------------

  return (
    <div className="space-y-6">
      <PeopleDatalist people={people} />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-gray-600">
          Add or edit phases, manage their tasks, track time and leave comments.
        </p>
        <Button size="sm" onClick={() => setPhaseDialog({ mode: 'add' })}>
          <Plus className="w-4 h-4 mr-1" />
          Add Phase
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Target className="w-5 h-5 text-blue-600" />
              <div>
                <div className="text-2xl font-bold">{phases.length}</div>
                <div className="text-sm text-gray-500">Total Phases</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Activity className="w-5 h-5 text-green-600" />
              <div>
                <div className="text-2xl font-bold">{stats.inProgressTasks}</div>
                <div className="text-sm text-gray-500">Tasks In Progress</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <div>
                <div className="text-2xl font-bold">{stats.overdueTasks}</div>
                <div className="text-sm text-gray-500">Overdue Tasks</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-purple-600" />
              <div>
                <div className="text-2xl font-bold">{people.length}</div>
                <div className="text-sm text-gray-500">People Assigned</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center space-x-2">
              <Search className="w-4 h-4 text-gray-500" />
              <Input
                placeholder="Search phases, tasks, people..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64"
                aria-label="Search phases and tasks"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-44" aria-label="Filter by phase status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Phase Statuses</SelectItem>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="w-44" aria-label="Filter by task priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Task Priorities</SelectItem>
                {PRIORITY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {filtersActive && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchTerm('')
                  setFilterStatus('all')
                  setFilterPriority('all')
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Phases */}
      {visiblePhases.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            {phases.length === 0
              ? 'No phases yet. Use "Add Phase" to create the first one.'
              : 'No phases or tasks match the current filters.'}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {visiblePhases.map(({ phase, tasks }) => (
            <PhaseCard
              key={phase.id}
              phase={phase}
              tasks={tasks}
              timeTracking={timeTracking}
              expanded={expandedPhaseIds.has(phase.id)}
              onToggleExpand={() => toggleExpanded(phase.id)}
              onEdit={() => setPhaseDialog({ mode: 'edit', phaseId: phase.id })}
              onDelete={() => handleDeletePhase(phase)}
              onAddTask={() => setAddTaskForPhaseId(phase.id)}
              onOpenTask={(task) => setSelectedTaskRef({ phaseId: phase.id, taskId: task.id })}
              onDeleteTask={(task) => handleDeleteTask(phase.id, task)}
              onStartTimer={startTimer}
              onStopTimer={stopTimer}
            />
          ))}
        </div>
      )}

      {/* Dialogs (one instance each, mounted only while open) */}
      {phaseDialog?.mode === 'add' && (
        <PhaseDialog
          initialForm={EMPTY_PHASE_FORM}
          title="Add New Phase"
          description="Create a new project phase"
          submitLabel="Add Phase"
          onSubmit={handleAddPhase}
          onClose={() => setPhaseDialog(null)}
        />
      )}
      {editingPhase && (
        <PhaseDialog
          key={editingPhase.id}
          initialForm={phaseToForm(editingPhase)}
          title={`Edit Phase: ${editingPhase.name}`}
          description="Update the phase details, status and progress"
          submitLabel="Save Changes"
          onSubmit={(form) => handleEditPhase(editingPhase.id, form)}
          onClose={() => setPhaseDialog(null)}
        />
      )}
      {addTaskPhase && (
        <AddTaskDialog
          key={addTaskPhase.id}
          phase={addTaskPhase}
          onSubmit={(form) => handleAddTask(addTaskPhase.id, form)}
          onClose={() => setAddTaskForPhaseId(null)}
        />
      )}
      {selectedPhase && selectedTask && (
        <TaskDetailDialog
          key={selectedTask.id}
          task={selectedTask}
          tracking={timeTracking[selectedTask.id]}
          comments={comments[selectedTask.id] || []}
          onSave={(updates) => onTaskUpdate(selectedPhase.id, selectedTask.id, updates)}
          onStartTimer={() => startTimer(selectedTask.id)}
          onStopTimer={() => stopTimer(selectedTask.id)}
          onAddComment={(text) => addComment(selectedTask.id, text)}
          onClose={() => setSelectedTaskRef(null)}
        />
      )}
    </div>
  )
}

export default EnhancedProjectManager
