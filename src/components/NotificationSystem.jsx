import { useEffect, useMemo, useRef, useState } from 'react'
import { Bell, X, CheckCircle, AlertTriangle, Info, Calendar, BellRing } from 'lucide-react'
import { Button } from '@/components/ui/button.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.jsx'
import { STORAGE_KEYS } from '@/lib/config.js'
import { loadJSON, saveJSON } from '@/lib/storage.js'

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/** Local calendar date as YYYY-MM-DD, offset by `offsetDays`. */
function isoDate(offsetDays = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

const SEVERITY_ORDER = { error: 0, warning: 1, success: 2, info: 3 }

/**
 * Derive notifications from the current phases. Every notification has a
 * deterministic id built from the phase/task id plus its kind, so dismissals
 * can be remembered across re-derivations.
 */
function deriveNotifications(phases) {
  const today = isoDate(0)
  const weekAhead = isoDate(7)
  const items = []

  for (const phase of phases) {
    const phaseOpen = phase.status !== 'completed'

    if (phase.status === 'completed') {
      items.push({
        id: `phase:${phase.id}:completed`,
        type: 'success',
        title: 'Phase completed',
        message: phase.name,
        phase: phase.name,
        dateLabel: phase.endDate ? `Ended ${phase.endDate}` : '',
      })
    }

    if (phaseOpen && phase.endDate && phase.endDate < today) {
      items.push({
        id: `phase:${phase.id}:overdue`,
        type: 'error',
        title: 'Phase overdue',
        message: `${phase.name} passed its end date`,
        phase: phase.name,
        dateLabel: `Ended ${phase.endDate}`,
      })
    }

    if (phaseOpen && phase.endDate && phase.endDate >= today && phase.endDate <= weekAhead) {
      items.push({
        id: `phase:${phase.id}:ending-soon`,
        type: 'warning',
        title: 'Phase ending this week',
        message: `${phase.name} is ${phase.progress}% complete`,
        phase: phase.name,
        dateLabel: `Ends ${phase.endDate}`,
      })
    }

    if (
      phaseOpen &&
      phase.status !== 'on-hold' &&
      phase.progress === 0 &&
      phase.startDate &&
      phase.startDate < today
    ) {
      items.push({
        id: `phase:${phase.id}:not-started`,
        type: 'warning',
        title: 'Phase has not started',
        message: `${phase.name} is at 0% after its start date`,
        phase: phase.name,
        dateLabel: `Started ${phase.startDate}`,
      })
    }

    for (const task of phase.tasks || []) {
      const who = task.responsiblePerson ? ` (${task.responsiblePerson})` : ''

      if (task.status === 'completed') {
        items.push({
          id: `task:${task.id}:completed`,
          type: 'success',
          title: 'Task completed',
          message: `${task.name}${who}`,
          phase: phase.name,
          dateLabel: '',
        })
        continue
      }

      if (task.status === 'blocked') {
        items.push({
          id: `task:${task.id}:blocked`,
          type: 'error',
          title: 'Task blocked',
          message: `${task.name}${who}`,
          phase: phase.name,
          dateLabel: task.dueDate ? `Due ${task.dueDate}` : '',
        })
      }

      if (task.dueDate && task.dueDate < today) {
        items.push({
          id: `task:${task.id}:overdue`,
          type: 'error',
          title: 'Task overdue',
          message: `${task.name}${who}`,
          phase: phase.name,
          dateLabel: `Due ${task.dueDate}`,
        })
      } else if (task.dueDate && task.dueDate <= weekAhead) {
        items.push({
          id: `task:${task.id}:due-soon`,
          type: 'warning',
          title: 'Task due this week',
          message: `${task.name}${who}`,
          phase: phase.name,
          dateLabel: `Due ${task.dueDate}`,
        })
      }
    }
  }

  // Stable sort: most severe first, otherwise keep phase/task order.
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => SEVERITY_ORDER[a.item.type] - SEVERITY_ORDER[b.item.type] || a.index - b.index)
    .map(({ item }) => item)
}

function loadDismissed() {
  const saved = loadJSON(STORAGE_KEYS.dismissedNotifications, [])
  return new Set(Array.isArray(saved) ? saved.filter((id) => typeof id === 'string') : [])
}

function browserPermission() {
  return 'Notification' in window ? Notification.permission : 'unsupported'
}

// ---------------------------------------------------------------------------
// Presentation
// ---------------------------------------------------------------------------

const TYPE_ICON = {
  success: <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />,
  warning: <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />,
  error: <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />,
  info: <Info className="h-4 w-4 text-blue-500 shrink-0" />,
}

const TYPE_CLASS = {
  success: 'border-l-green-500 bg-green-50',
  warning: 'border-l-yellow-500 bg-yellow-50',
  error: 'border-l-red-500 bg-red-50',
  info: 'border-l-blue-500 bg-blue-50',
}

function NotificationItem({ notification, onDismiss }) {
  return (
    <div className={`p-3 border-l-4 ${TYPE_CLASS[notification.type] || TYPE_CLASS.info}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <span className="mt-0.5">{TYPE_ICON[notification.type] || TYPE_ICON.info}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-medium text-sm">{notification.title}</h4>
              <Badge variant="outline" className="text-xs">
                {notification.phase}
              </Badge>
            </div>
            <p className="text-sm text-gray-600 mt-1 break-words">{notification.message}</p>
            {notification.dateLabel && (
              <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                <Calendar className="h-3 w-3" />
                {notification.dateLabel}
              </div>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDismiss(notification.id)}
          className="h-6 w-6 p-0 shrink-0"
          aria-label={`Dismiss: ${notification.title}`}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function NotificationSystem({ phases }) {
  const [dismissedIds, setDismissedIds] = useState(loadDismissed)
  const [permission, setPermission] = useState(browserPermission)

  const derived = useMemo(() => deriveNotifications(phases), [phases])
  const visible = useMemo(() => derived.filter((n) => !dismissedIds.has(n.id)), [derived, dismissedIds])

  // Browser notification for ids that are new since the previous render.
  // The first run only records what already exists so a page load does not
  // fire a notification for every pre-existing item.
  const seenIdsRef = useRef(null)
  useEffect(() => {
    const current = new Set(visible.map((n) => n.id))
    const previous = seenIdsRef.current
    seenIdsRef.current = current
    if (previous === null || permission !== 'granted') return
    for (const n of visible) {
      if (!previous.has(n.id)) {
        try {
          new Notification(n.title, { body: `${n.phase}: ${n.message}`, tag: n.id })
        } catch (error) {
          console.error('Could not show browser notification', error)
        }
      }
    }
  }, [visible, permission])

  const persistDismissed = (next) => {
    // Only keep ids that still correspond to a derived notification so the
    // stored list cannot grow without bound.
    const live = new Set(derived.map((n) => n.id))
    const pruned = new Set([...next].filter((id) => live.has(id)))
    setDismissedIds(pruned)
    saveJSON(STORAGE_KEYS.dismissedNotifications, [...pruned])
  }

  const dismiss = (id) => persistDismissed(new Set(dismissedIds).add(id))

  const markAllRead = () => {
    const next = new Set(dismissedIds)
    for (const n of visible) next.add(n.id)
    persistDismissed(next)
  }

  const requestPermission = () => {
    if (!('Notification' in window)) return
    Promise.resolve(Notification.requestPermission()).then((p) => setPermission(p || browserPermission()))
  }

  const count = visible.length

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative" aria-label={`Notifications (${count})`}>
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-2 -right-2 h-5 min-w-5 rounded-full px-1 flex items-center justify-center text-xs"
            >
              {count > 9 ? '9+' : count}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between p-3 border-b">
          <h3 className="font-semibold">Notifications</h3>
          {count > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllRead}>
              Mark all read
            </Button>
          )}
        </div>

        {count === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No new notifications</p>
          </div>
        ) : (
          <div className="divide-y max-h-96 overflow-y-auto">
            {visible.map((n) => (
              <NotificationItem key={n.id} notification={n} onDismiss={dismiss} />
            ))}
          </div>
        )}

        {permission === 'default' && (
          <div className="p-3 border-t">
            <Button variant="outline" size="sm" className="w-full" onClick={requestPermission}>
              <BellRing className="h-4 w-4 mr-2" />
              Enable browser notifications
            </Button>
          </div>
        )}
        {permission === 'denied' && (
          <p className="p-3 border-t text-xs text-gray-500">Browser notifications are blocked for this site.</p>
        )}
      </PopoverContent>
    </Popover>
  )
}

export default NotificationSystem
