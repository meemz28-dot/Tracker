// Single source of truth for the tracker's data model.
//
// Every component reads and writes phases/tasks in the shapes defined here.
// Keep this file free of React so it is trivially testable.

export const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'on-hold', label: 'On Hold' },
]

export const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
]

export const STATUS_VALUES = STATUS_OPTIONS.map((o) => o.value)

export function newId(prefix = 'id') {
  const rand =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  return `${prefix}_${rand}`
}

/**
 * @typedef {Object} Task
 * @property {string} id
 * @property {string} name
 * @property {'pending'|'in-progress'|'completed'|'blocked'|'on-hold'} status
 * @property {string} responsiblePerson
 * @property {string} responsibleFunction
 * @property {'low'|'medium'|'high'|'critical'} priority
 * @property {string} [description]
 * @property {string} [dueDate]  ISO date (YYYY-MM-DD)
 * @property {number} [estimatedHours]
 */

/**
 * @typedef {Object} Phase
 * @property {string} id
 * @property {string} name
 * @property {'pending'|'in-progress'|'completed'|'blocked'|'on-hold'} status
 * @property {number} progress 0..100
 * @property {string} startDate ISO date
 * @property {string} endDate ISO date
 * @property {string} description
 * @property {string} responsiblePerson
 * @property {string} responsibleFunction
 * @property {Task[]} tasks
 */

export function createTask(overrides = {}) {
  return {
    id: newId('task'),
    name: 'New Task',
    status: 'pending',
    responsiblePerson: '',
    responsibleFunction: '',
    priority: 'medium',
    description: '',
    dueDate: '',
    estimatedHours: 0,
    ...overrides,
  }
}

export function createPhase(overrides = {}) {
  return {
    id: newId('phase'),
    name: 'New Phase',
    status: 'pending',
    progress: 0,
    startDate: '',
    endDate: '',
    description: '',
    responsiblePerson: '',
    responsibleFunction: '',
    tasks: [],
    ...overrides,
  }
}

/**
 * Bring any previously saved phases (older schema, missing ids, etc.) up to
 * the current shape so the rest of the app can rely on it.
 */
export function normalizePhases(phases) {
  if (!Array.isArray(phases)) return []
  return phases.map((phase) =>
    createPhase({
      ...phase,
      id: phase.id || newId('phase'),
      progress: clampPercent(phase.progress),
      status: STATUS_VALUES.includes(phase.status) ? phase.status : 'pending',
      tasks: Array.isArray(phase.tasks)
        ? phase.tasks.map((task) => {
            // Older builds used assignedTo / assignedRole; migrate and drop them.
            const { assignedTo, assignedRole, ...rest } = task
            return createTask({
              ...rest,
              id: task.id || newId('task'),
              responsiblePerson: task.responsiblePerson ?? assignedTo ?? '',
              responsibleFunction: task.responsibleFunction ?? assignedRole ?? '',
              status: STATUS_VALUES.includes(task.status) ? task.status : 'pending',
            })
          })
        : [],
    }),
  )
}

export function clampPercent(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, Math.round(n)))
}

/** Aggregate task statistics across all phases. */
export function computeStats(phases, now = new Date()) {
  const tasks = phases.flatMap((p) => p.tasks || [])
  const byStatus = STATUS_VALUES.reduce((acc, s) => ({ ...acc, [s]: 0 }), {})
  let overdue = 0
  for (const task of tasks) {
    byStatus[task.status] = (byStatus[task.status] || 0) + 1
    if (task.dueDate && task.status !== 'completed' && new Date(task.dueDate) < now) {
      overdue += 1
    }
  }
  const total = tasks.length
  const completed = byStatus.completed || 0
  return {
    totalTasks: total,
    completedTasks: completed,
    inProgressTasks: byStatus['in-progress'] || 0,
    pendingTasks: byStatus.pending || 0,
    blockedTasks: byStatus.blocked || 0,
    onHoldTasks: byStatus['on-hold'] || 0,
    overdueTasks: overdue,
    completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    averagePhaseProgress:
      phases.length > 0
        ? Math.round(phases.reduce((sum, p) => sum + clampPercent(p.progress), 0) / phases.length)
        : 0,
  }
}

export function getStatusLabel(status) {
  return STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status
}
