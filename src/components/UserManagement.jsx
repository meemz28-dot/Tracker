import { useId, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Button } from '@/components/ui/button.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Label } from '@/components/ui/label.jsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog.jsx'
import { Users, UserPlus, Shield, Edit, Trash2, Eye, EyeOff, AlertTriangle } from 'lucide-react'
import { newId } from '@/lib/model.js'

// ---------------------------------------------------------------------------
// Constants and pure helpers
// ---------------------------------------------------------------------------

const ROLES = [
  { value: 'viewer', label: 'Viewer', description: 'Read-only access to the dashboard', icon: Eye },
  { value: 'editor', label: 'Editor', description: 'Can modify project data and tasks', icon: Edit },
  { value: 'admin', label: 'Admin', description: 'Full access including user management', icon: Shield },
]

const ROLE_BADGE = {
  viewer: 'bg-gray-100 text-gray-800',
  editor: 'bg-blue-100 text-blue-800',
  admin: 'bg-red-100 text-red-800',
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PIN_RE = /^\d{4}$/

const EMPTY_FORM = { name: '', email: '', role: 'viewer', pin: '', isActive: true }

function getRoleInfo(role) {
  return ROLES.find((r) => r.value === role) || ROLES[0]
}

function randomPin() {
  let n
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    n = crypto.getRandomValues(new Uint32Array(1))[0] % 10000
  } else {
    n = Math.floor(Math.random() * 10000)
  }
  return String(n).padStart(4, '0')
}

/** A 4-digit PIN that no user in `users` already has (excluding `exceptId`). */
function generateUniquePin(users, exceptId = null) {
  const taken = new Set(users.filter((u) => u.id !== exceptId).map((u) => u.pin))
  for (let i = 0; i < 1000; i += 1) {
    const pin = randomPin()
    if (!taken.has(pin)) return pin
  }
  return null
}

function activeAdminCount(users) {
  return users.filter((u) => u.role === 'admin' && u.isActive).length
}

/**
 * Validate a user form against the existing list. Returns an error string or
 * null. `exceptId` is the user being edited so it is not compared to itself.
 */
function validateUserForm(form, users, exceptId = null) {
  const name = form.name.trim()
  const email = form.email.trim().toLowerCase()
  const pin = form.pin.trim()
  if (!name) return 'Name is required.'
  if (!email) return 'Email is required.'
  if (!EMAIL_RE.test(email)) return 'Enter a valid email address.'
  if (!ROLES.some((r) => r.value === form.role)) return 'Choose a valid role.'
  const others = users.filter((u) => u.id !== exceptId)
  if (others.some((u) => (u.email || '').toLowerCase() === email)) return 'Another user already has that email address.'
  if (pin) {
    if (!PIN_RE.test(pin)) return 'PIN must be exactly 4 digits.'
    if (others.some((u) => u.pin === pin)) return 'That PIN is already in use. Choose a different one.'
  }
  return null
}

function formatDate(value) {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString()
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function RoleSelect({ id, value, onValueChange, disabled }) {
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger id={id}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ROLES.map((role) => (
          <SelectItem key={role.value} value={role.value}>
            <div className="flex items-center space-x-2">
              <role.icon className="w-4 h-4" />
              <div>
                <div className="font-medium">{role.label}</div>
                <div className="text-xs text-gray-500">{role.description}</div>
              </div>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** Shared add / edit form body. */
function UserForm({ idPrefix, form, onChange, error, isSelf, pinRequired, showPin, onToggleShowPin }) {
  const set = (key, value) => onChange({ ...form, [key]: value })
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor={`${idPrefix}-name`} className="mb-1">Name *</Label>
        <Input
          id={`${idPrefix}-name`}
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="Full name"
          maxLength={100}
        />
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-email`} className="mb-1">Email *</Label>
        <Input
          id={`${idPrefix}-email`}
          type="email"
          value={form.email}
          onChange={(e) => set('email', e.target.value)}
          placeholder="name@company.com"
          maxLength={254}
        />
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-role`} className="mb-1">Role</Label>
        <RoleSelect id={`${idPrefix}-role`} value={form.role} onValueChange={(v) => set('role', v)} disabled={isSelf} />
        {isSelf && <p className="text-xs text-gray-500 mt-1">You cannot change your own role.</p>}
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-pin`} className="mb-1">{pinRequired ? 'PIN' : 'PIN (optional)'}</Label>
        <div className="flex items-center space-x-2">
          <Input
            id={`${idPrefix}-pin`}
            type={showPin ? 'text' : 'password'}
            inputMode="numeric"
            autoComplete="off"
            value={form.pin}
            onChange={(e) => set('pin', e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder={pinRequired ? '4 digits' : 'Leave empty to auto-generate'}
            maxLength={4}
          />
          <Button type="button" variant="outline" size="sm" onClick={onToggleShowPin} aria-label={showPin ? 'Hide PIN' : 'Show PIN'}>
            {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </Button>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {pinRequired ? 'Exactly 4 digits, unique per user.' : 'If left empty, a unique random 4-digit PIN is generated.'}
        </p>
      </div>
      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function UserManagement({ currentUser, users, setUsers }) {
  const ids = useId()
  const isAdmin = currentUser?.role === 'admin'
  const currentUserId = currentUser?.id ?? null

  const [isAddOpen, setIsAddOpen] = useState(false)
  const [addForm, setAddForm] = useState(EMPTY_FORM)
  const [addError, setAddError] = useState(null)
  const [showAddPin, setShowAddPin] = useState(false)

  const [editingUser, setEditingUser] = useState(null) // { id, ...form }
  const [editError, setEditError] = useState(null)
  const [showEditPin, setShowEditPin] = useState(false)

  const [revealedPinId, setRevealedPinId] = useState(null)
  const [listError, setListError] = useState(null)

  // --- Add --------------------------------------------------------------------

  const openAdd = (open) => {
    setIsAddOpen(open)
    if (open) {
      setAddForm(EMPTY_FORM)
      setAddError(null)
      setShowAddPin(false)
    }
  }

  const handleAddUser = () => {
    if (!isAdmin) return
    const error = validateUserForm(addForm, users)
    if (error) {
      setAddError(error)
      return
    }
    const pin = addForm.pin.trim() || generateUniquePin(users)
    if (!pin) {
      setAddError('Could not find a free 4-digit PIN. Enter one manually.')
      return
    }
    setUsers((prev) => [
      ...prev,
      {
        id: newId('user'),
        name: addForm.name.trim(),
        email: addForm.email.trim().toLowerCase(),
        role: addForm.role,
        pin,
        isActive: true,
        createdAt: new Date().toISOString(),
        lastLogin: null,
      },
    ])
    setIsAddOpen(false)
  }

  // --- Edit -------------------------------------------------------------------

  const openEdit = (user) => {
    setEditingUser({ id: user.id, name: user.name || '', email: user.email || '', role: user.role, pin: user.pin || '', isActive: user.isActive !== false })
    setEditError(null)
    setShowEditPin(false)
  }

  const handleUpdateUser = () => {
    if (!isAdmin || !editingUser) return
    const original = users.find((u) => u.id === editingUser.id)
    if (!original) {
      setEditError('That user no longer exists.')
      return
    }
    const form = { ...editingUser }
    if (form.id === currentUserId) form.role = original.role // never self-demote
    const error = validateUserForm(form, users, form.id) || (!form.pin.trim() ? 'PIN is required.' : null)
    if (error) {
      setEditError(error)
      return
    }
    const next = users.map((u) =>
      u.id === form.id
        ? { ...u, name: form.name.trim(), email: form.email.trim().toLowerCase(), role: form.role, pin: form.pin.trim() }
        : u,
    )
    if (activeAdminCount(next) === 0) {
      setEditError('At least one active administrator must remain.')
      return
    }
    setUsers(next)
    setEditingUser(null)
  }

  // --- Status / delete --------------------------------------------------------

  const toggleUserStatus = (userId) => {
    if (!isAdmin) return
    if (userId === currentUserId) {
      setListError('You cannot deactivate your own account.')
      return
    }
    const next = users.map((u) => (u.id === userId ? { ...u, isActive: !u.isActive } : u))
    if (activeAdminCount(next) === 0) {
      setListError('At least one active administrator must remain.')
      return
    }
    setListError(null)
    setUsers(next)
  }

  const handleDeleteUser = (user) => {
    if (!isAdmin) return
    if (user.id === currentUserId) {
      setListError('You cannot delete your own account.')
      return
    }
    const next = users.filter((u) => u.id !== user.id)
    if (activeAdminCount(next) === 0) {
      setListError('At least one active administrator must remain.')
      return
    }
    if (!window.confirm(`Delete ${user.name || 'this user'}? This cannot be undone.`)) return
    setListError(null)
    if (revealedPinId === user.id) setRevealedPinId(null)
    setUsers(next)
  }

  // --- Render -----------------------------------------------------------------

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Users className="w-5 h-5" />
                <span>User Management</span>
              </CardTitle>
              <CardDescription>
                {isAdmin ? 'Manage user accounts, roles and login PINs' : 'Team members and their roles (read-only)'}
              </CardDescription>
            </div>
            {isAdmin && (
              <Dialog open={isAddOpen} onOpenChange={openAdd}>
                <DialogTrigger asChild>
                  <Button className="flex items-center space-x-2">
                    <UserPlus className="w-4 h-4" />
                    <span>Add User</span>
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New User</DialogTitle>
                    <DialogDescription>Create a new account with a role and a 4-digit login PIN</DialogDescription>
                  </DialogHeader>
                  <UserForm
                    idPrefix={`${ids}-add`}
                    form={addForm}
                    onChange={(f) => {
                      setAddForm(f)
                      setAddError(null)
                    }}
                    error={addError}
                    isSelf={false}
                    pinRequired={false}
                    showPin={showAddPin}
                    onToggleShowPin={() => setShowAddPin((s) => !s)}
                  />
                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setIsAddOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleAddUser}>Add User</Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!isAdmin && (
            <p className="text-sm text-gray-500 mb-4">Only administrators can add, edit or remove users.</p>
          )}
          {listError && (
            <div role="alert" className="mb-4 flex items-start justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{listError}</span>
              </div>
              <button type="button" className="underline" onClick={() => setListError(null)}>
                Dismiss
              </button>
            </div>
          )}
          <div className="space-y-4">
            {users.length === 0 && <p className="text-sm text-gray-500">No users yet.</p>}
            {users.map((user) => {
              const roleInfo = getRoleInfo(user.role)
              const RoleIcon = roleInfo.icon
              const isSelf = user.id === currentUserId
              const revealed = revealedPinId === user.id
              const lastLogin = formatDate(user.lastLogin)

              return (
                <div key={user.id} className="flex flex-wrap items-center justify-between gap-4 p-4 border rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                      <Users className="w-5 h-5 text-gray-600" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">{user.name}</span>
                        {isSelf && <Badge variant="outline" className="text-xs">You</Badge>}
                        {!user.isActive && <Badge variant="destructive" className="text-xs">Inactive</Badge>}
                      </div>
                      <div className="text-sm text-gray-600">{user.email}</div>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <Badge className={ROLE_BADGE[user.role] || ROLE_BADGE.viewer}>
                          <RoleIcon className="w-3 h-3 mr-1" />
                          {roleInfo.label}
                        </Badge>
                        {isAdmin && (
                          <span className="flex items-center text-xs text-gray-500">
                            PIN:
                            <span className="ml-1 font-mono tracking-widest">{revealed ? user.pin : '••••'}</span>
                            <button
                              type="button"
                              className="ml-1 text-gray-500 hover:text-gray-800"
                              onClick={() => setRevealedPinId(revealed ? null : user.id)}
                              aria-label={revealed ? `Hide PIN for ${user.name}` : `Show PIN for ${user.name}`}
                            >
                              {revealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </span>
                        )}
                        {lastLogin && <span className="text-xs text-gray-500">Last login {lastLogin}</span>}
                      </div>
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex items-center space-x-2">
                      <Button variant="outline" size="sm" onClick={() => toggleUserStatus(user.id)} disabled={isSelf}>
                        {user.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openEdit(user)}>
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteUser(user)}
                        disabled={isSelf}
                        aria-label={`Delete ${user.name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {isAdmin && editingUser && (
        <Dialog open onOpenChange={(open) => !open && setEditingUser(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription>Update the user's details, role or PIN</DialogDescription>
            </DialogHeader>
            <UserForm
              idPrefix={`${ids}-edit`}
              form={editingUser}
              onChange={(f) => {
                setEditingUser(f)
                setEditError(null)
              }}
              error={editError}
              isSelf={editingUser.id === currentUserId}
              pinRequired
              showPin={showEditPin}
              onToggleShowPin={() => setShowEditPin((s) => !s)}
            />
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setEditingUser(null)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateUser}>Update User</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
