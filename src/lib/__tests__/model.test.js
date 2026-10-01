import { describe, it, expect } from 'vitest'
import {
  normalizePhases,
  computeStats,
  createTask,
  createPhase,
  clampPercent,
  STATUS_VALUES,
} from '../model.js'
import { DEFAULT_PHASES } from '../defaults.js'

describe('normalizePhases', () => {
  it('returns an empty array for non-array input', () => {
    expect(normalizePhases(null)).toEqual([])
    expect(normalizePhases('nope')).toEqual([])
  })

  it('assigns ids to phases and tasks that lack them', () => {
    const [phase] = normalizePhases([{ name: 'P', tasks: [{ name: 'T' }] }])
    expect(phase.id).toMatch(/^phase_/)
    expect(phase.tasks[0].id).toMatch(/^task_/)
  })

  it('migrates the legacy assignedTo / assignedRole task fields', () => {
    const [phase] = normalizePhases([
      { id: 'p', tasks: [{ id: 't', name: 'T', assignedTo: 'Alice', assignedRole: 'QA' }] },
    ])
    expect(phase.tasks[0].responsiblePerson).toBe('Alice')
    expect(phase.tasks[0].responsibleFunction).toBe('QA')
    expect(phase.tasks[0]).not.toHaveProperty('assignedTo')
  })

  it('coerces unknown statuses and out-of-range progress', () => {
    const [phase] = normalizePhases([
      { id: 'p', status: 'weird', progress: 250, tasks: [{ id: 't', status: 'nope' }] },
    ])
    expect(phase.status).toBe('pending')
    expect(phase.progress).toBe(100)
    expect(phase.tasks[0].status).toBe('pending')
  })

  it('leaves the shipped defaults unchanged', () => {
    expect(normalizePhases(DEFAULT_PHASES)).toEqual(DEFAULT_PHASES)
  })
})

describe('computeStats', () => {
  const now = new Date('2024-06-01T00:00:00Z')

  it('counts tasks by status and computes completion rate', () => {
    const phases = [
      createPhase({
        progress: 50,
        tasks: [
          createTask({ status: 'completed' }),
          createTask({ status: 'completed' }),
          createTask({ status: 'in-progress' }),
          createTask({ status: 'blocked' }),
        ],
      }),
      createPhase({ progress: 100, tasks: [] }),
    ]
    const stats = computeStats(phases, now)
    expect(stats.totalTasks).toBe(4)
    expect(stats.completedTasks).toBe(2)
    expect(stats.inProgressTasks).toBe(1)
    expect(stats.blockedTasks).toBe(1)
    expect(stats.completionRate).toBe(50)
    expect(stats.averagePhaseProgress).toBe(75)
  })

  it('only counts overdue tasks that are not completed', () => {
    const phases = [
      createPhase({
        tasks: [
          createTask({ status: 'pending', dueDate: '2024-05-01' }),
          createTask({ status: 'completed', dueDate: '2024-05-01' }),
          createTask({ status: 'pending', dueDate: '2024-07-01' }),
          createTask({ status: 'pending' }),
        ],
      }),
    ]
    expect(computeStats(phases, now).overdueTasks).toBe(1)
  })

  it('handles an empty project without dividing by zero', () => {
    const stats = computeStats([], now)
    expect(stats.completionRate).toBe(0)
    expect(stats.averagePhaseProgress).toBe(0)
  })
})

describe('clampPercent', () => {
  it('clamps and rounds', () => {
    expect(clampPercent(-5)).toBe(0)
    expect(clampPercent(140)).toBe(100)
    expect(clampPercent(33.6)).toBe(34)
    expect(clampPercent('abc')).toBe(0)
  })
})

describe('createTask', () => {
  it('produces a valid default task', () => {
    const task = createTask()
    expect(STATUS_VALUES).toContain(task.status)
    expect(task.id).toMatch(/^task_/)
  })
})
