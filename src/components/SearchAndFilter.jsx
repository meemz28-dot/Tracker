import { useEffect, useMemo, useState } from 'react'
import { Search, Filter, X, Save, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { STATUS_OPTIONS, PRIORITY_OPTIONS, getStatusLabel } from '@/lib/model.js'
import { STORAGE_KEYS } from '@/lib/config.js'
import { loadJSON, saveJSON } from '@/lib/storage.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_HISTORY = 10

const DATE_OPTIONS = [
  { value: 'overdue', label: 'Overdue' },
  { value: 'dueThisWeek', label: 'Due this week' },
  { value: 'noDueDate', label: 'No due date' },
]

const FILTER_LABELS = {
  status: 'Status',
  priority: 'Priority',
  person: 'Person',
  dateRange: 'Due',
}

const FILTER_KEYS = Object.keys(FILTER_LABELS)

// ---------------------------------------------------------------------------
// Pure helpers (no React so they are easy to reason about and test)
// ---------------------------------------------------------------------------

/** Local calendar date as YYYY-MM-DD, offset by `offsetDays`. */
function isoDate(offsetDays = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function textMatches(fields, query) {
  return fields.some((f) => typeof f === 'string' && f.toLowerCase().includes(query))
}

function phaseMatchesQuery(phase, query) {
  if (!query) return false
  return textMatches(
    [phase.name, phase.description, phase.responsiblePerson, phase.responsibleFunction],
    query,
  )
}

function taskMatchesQuery(task, query) {
  if (!query) return true
  return textMatches(
    [task.name, task.responsiblePerson, task.responsibleFunction, task.status, task.priority],
    query,
  )
}

function taskMatchesDate(task, option, today, weekAhead) {
  switch (option) {
    case 'overdue':
      return Boolean(task.dueDate) && task.dueDate < today && task.status !== 'completed'
    case 'dueThisWeek':
      return Boolean(task.dueDate) && task.dueDate >= today && task.dueDate <= weekAhead
    case 'noDueDate':
      return !task.dueDate
    default:
      return true
  }
}

function taskMatchesFilters(task, phase, filters, today, weekAhead) {
  if (filters.status && task.status !== filters.status) return false
  if (filters.priority && task.priority !== filters.priority) return false
  if (
    filters.person &&
    task.responsiblePerson !== filters.person &&
    phase.responsiblePerson !== filters.person
  ) {
    return false
  }
  if (filters.dateRange && !taskMatchesDate(task, filters.dateRange, today, weekAhead)) return false
  return true
}

/**
 * Apply the search query and filters to `phases`.
 *
 * - A phase whose own fields match the query keeps all of its tasks; otherwise
 *   only the tasks that match the query are kept.
 * - Status / priority / person / due-date filters always apply to tasks.
 * - A phase with no remaining tasks is dropped, unless it matched the query
 *   itself and no filters are active.
 */
function filterPhases(phases, rawQuery, filters) {
  const query = rawQuery.trim().toLowerCase()
  const hasFilters = FILTER_KEYS.some((k) => Boolean(filters[k]))
  const isActive = query.length > 0 || hasFilters

  if (!isActive) return { isActive: false, phases }

  const today = isoDate(0)
  const weekAhead = isoDate(7)
  const result = []

  for (const phase of phases) {
    const phaseMatched = phaseMatchesQuery(phase, query)
    const tasks = (phase.tasks || []).filter(
      (task) =>
        (phaseMatched || taskMatchesQuery(task, query)) &&
        taskMatchesFilters(task, phase, filters, today, weekAhead),
    )
    if (tasks.length > 0 || (phaseMatched && !hasFilters)) {
      result.push({ ...phase, tasks })
    }
  }

  return { isActive: true, phases: result }
}

function loadHistory() {
  const saved = loadJSON(STORAGE_KEYS.searchHistory, [])
  return Array.isArray(saved) ? saved.filter((s) => typeof s === 'string').slice(0, MAX_HISTORY) : []
}

function loadSavedFilters() {
  const saved = loadJSON(STORAGE_KEYS.savedFilters, {})
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return {}
  return Object.fromEntries(
    Object.entries(saved)
      .filter(([, v]) => v && typeof v === 'object')
      .map(([name, v]) => [
        name,
        {
          query: typeof v.query === 'string' ? v.query : '',
          filters: v.filters && typeof v.filters === 'object' ? v.filters : {},
        },
      ]),
  )
}

function filterValueLabel(key, value) {
  switch (key) {
    case 'status':
      return getStatusLabel(value)
    case 'priority':
      return PRIORITY_OPTIONS.find((o) => o.value === value)?.label ?? value
    case 'dateRange':
      return DATE_OPTIONS.find((o) => o.value === value)?.label ?? value
    default:
      return value
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const SELECT_CLASS = 'w-full border rounded px-3 py-2 text-sm bg-white'

function SearchAndFilter({ phases, onFilterChange }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilters, setActiveFilters] = useState({})
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [searchHistory, setSearchHistory] = useState(loadHistory)
  const [savedFilters, setSavedFilters] = useState(loadSavedFilters)

  const result = useMemo(
    () => filterPhases(phases, searchQuery, activeFilters),
    [phases, searchQuery, activeFilters],
  )

  // Report to App only when the inputs actually change, not on every render.
  useEffect(() => {
    onFilterChange(result)
  }, [result, onFilterChange])

  const allPeople = useMemo(
    () =>
      [
        ...new Set(
          phases.flatMap((p) => [p.responsiblePerson, ...(p.tasks || []).map((t) => t.responsiblePerson)]),
        ),
      ]
        .filter(Boolean)
        .sort(),
    [phases],
  )

  const activeFilterEntries = Object.entries(activeFilters).filter(([, v]) => Boolean(v))
  const hasAnything = searchQuery.trim().length > 0 || activeFilterEntries.length > 0

  // --- Search history (recorded on explicit submit only) ---------------------

  const commitSearch = (raw) => {
    const term = raw.trim()
    setSearchQuery(term)
    if (!term) return
    setSearchHistory((prev) => {
      const next = [term, ...prev.filter((h) => h !== term)].slice(0, MAX_HISTORY)
      saveJSON(STORAGE_KEYS.searchHistory, next)
      return next
    })
  }

  const clearHistory = () => {
    setSearchHistory([])
    saveJSON(STORAGE_KEYS.searchHistory, [])
  }

  // --- Filters ----------------------------------------------------------------

  const applyFilter = (key, value) => {
    setActiveFilters((prev) => {
      const next = { ...prev }
      if (value) next[key] = value
      else delete next[key]
      return next
    })
  }

  const toggleFilter = (key, value) => applyFilter(key, activeFilters[key] === value ? null : value)

  const clearAll = () => {
    setActiveFilters({})
    setSearchQuery('')
  }

  // --- Saved filters ----------------------------------------------------------

  const persistSavedFilters = (next) => {
    setSavedFilters(next)
    saveJSON(STORAGE_KEYS.savedFilters, next)
  }

  const saveCurrentFilter = () => {
    const name = window.prompt('Name this filter:')?.trim()
    if (!name) return
    persistSavedFilters({
      ...savedFilters,
      [name]: { query: searchQuery.trim(), filters: Object.fromEntries(activeFilterEntries) },
    })
  }

  const applySavedFilter = (name) => {
    const saved = savedFilters[name]
    if (!saved) return
    setSearchQuery(saved.query)
    setActiveFilters(saved.filters)
  }

  const deleteSavedFilter = (name) => {
    const next = { ...savedFilters }
    delete next[name]
    persistSavedFilters(next)
  }

  const savedFilterNames = Object.keys(savedFilters)
  const matchedTasks = result.isActive ? result.phases.reduce((n, p) => n + p.tasks.length, 0) : 0

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search phases, tasks, people, or descriptions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                commitSearch(searchQuery)
              }
            }}
            className="pl-10 pr-10"
            aria-label="Search"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchQuery('')}
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <Button variant="outline" onClick={() => commitSearch(searchQuery)} aria-label="Run search">
          <Search className="h-4 w-4 mr-2" />
          Search
        </Button>
      </div>

      {/* Quick filters */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={activeFilters.status === 'in-progress' ? 'default' : 'outline'}
          size="sm"
          onClick={() => toggleFilter('status', 'in-progress')}
        >
          In Progress
        </Button>
        <Button
          variant={activeFilters.status === 'completed' ? 'default' : 'outline'}
          size="sm"
          onClick={() => toggleFilter('status', 'completed')}
        >
          Completed
        </Button>
        <Button
          variant={activeFilters.dateRange === 'overdue' ? 'default' : 'outline'}
          size="sm"
          onClick={() => toggleFilter('dateRange', 'overdue')}
        >
          Overdue
        </Button>
        <Button
          variant={activeFilters.dateRange === 'dueThisWeek' ? 'default' : 'outline'}
          size="sm"
          onClick={() => toggleFilter('dateRange', 'dueThisWeek')}
        >
          Due this week
        </Button>
        <Button
          variant={showAdvancedFilters ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => setShowAdvancedFilters((v) => !v)}
        >
          <Filter className="h-4 w-4 mr-2" />
          Advanced
        </Button>
      </div>

      {/* Active filter chips */}
      {hasAnything && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm text-gray-600">Active:</span>
          {searchQuery.trim() && (
            <Badge variant="secondary" className="flex items-center gap-1">
              Search: &quot;{searchQuery.trim()}&quot;
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="ml-1 rounded hover:text-red-600"
                aria-label="Clear search"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {activeFilterEntries.map(([key, value]) => (
            <Badge key={key} variant="secondary" className="flex items-center gap-1">
              {FILTER_LABELS[key] || key}: {filterValueLabel(key, value)}
              <button
                type="button"
                onClick={() => applyFilter(key, null)}
                className="ml-1 rounded hover:text-red-600"
                aria-label={`Remove ${FILTER_LABELS[key] || key} filter`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <Button variant="ghost" size="sm" onClick={clearAll}>
            Clear all
          </Button>
          <Button variant="outline" size="sm" onClick={saveCurrentFilter}>
            <Save className="h-4 w-4 mr-2" />
            Save filter
          </Button>
        </div>
      )}

      {/* Advanced filters */}
      {showAdvancedFilters && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Advanced Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label htmlFor="filter-status" className="block text-sm font-medium mb-2">
                  Status
                </label>
                <select
                  id="filter-status"
                  value={activeFilters.status || ''}
                  onChange={(e) => applyFilter('status', e.target.value)}
                  className={SELECT_CLASS}
                >
                  <option value="">All statuses</option>
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="filter-priority" className="block text-sm font-medium mb-2">
                  Priority
                </label>
                <select
                  id="filter-priority"
                  value={activeFilters.priority || ''}
                  onChange={(e) => applyFilter('priority', e.target.value)}
                  className={SELECT_CLASS}
                >
                  <option value="">All priorities</option>
                  {PRIORITY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="filter-person" className="block text-sm font-medium mb-2">
                  Responsible Person
                </label>
                <select
                  id="filter-person"
                  value={activeFilters.person || ''}
                  onChange={(e) => applyFilter('person', e.target.value)}
                  className={SELECT_CLASS}
                >
                  <option value="">All people</option>
                  {allPeople.map((person) => (
                    <option key={person} value={person}>
                      {person}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="filter-due" className="block text-sm font-medium mb-2">
                  Due Date
                </label>
                <select
                  id="filter-due"
                  value={activeFilters.dateRange || ''}
                  onChange={(e) => applyFilter('dateRange', e.target.value)}
                  className={SELECT_CLASS}
                >
                  <option value="">Any due date</option>
                  {DATE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Saved filters */}
      {savedFilterNames.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm text-gray-600">Saved filters:</span>
          {savedFilterNames.map((name) => (
            <Badge key={name} variant="outline" className="flex items-center gap-1 pr-1">
              <button type="button" onClick={() => applySavedFilter(name)} className="hover:underline">
                {name}
              </button>
              <button
                type="button"
                onClick={() => deleteSavedFilter(name)}
                className="ml-1 rounded hover:text-red-600"
                aria-label={`Delete saved filter ${name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Recent searches */}
      {searchHistory.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="flex items-center gap-1 text-sm text-gray-600">
            <Clock className="h-3 w-3" />
            Recent:
          </span>
          {searchHistory.map((term) => (
            <Button key={term} variant="ghost" size="sm" className="h-7 px-2" onClick={() => commitSearch(term)}>
              {term}
            </Button>
          ))}
          <Button variant="ghost" size="sm" className="h-7 px-2 text-gray-500" onClick={clearHistory}>
            Clear history
          </Button>
        </div>
      )}

      {/* Result summary */}
      {result.isActive && (
        <div className="text-sm text-gray-600">
          Showing {result.phases.length} phase{result.phases.length !== 1 ? 's' : ''} and {matchedTasks} task
          {matchedTasks !== 1 ? 's' : ''} in the Phase Details tab.
        </div>
      )}
    </div>
  )
}

export default SearchAndFilter
