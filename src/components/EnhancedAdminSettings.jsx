import { useId, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Button } from '@/components/ui/button.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Label } from '@/components/ui/label.jsx'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import {
  Settings,
  Palette,
  Database,
  Building2,
  Download,
  Upload,
  RefreshCw,
  Save,
  AlertTriangle,
  CheckCircle,
  Lock,
  Activity,
  X,
} from 'lucide-react'
import { STORAGE_KEYS } from '@/lib/config.js'
import { loadJSON, saveJSON } from '@/lib/storage.js'
import { normalizePhases, clampPercent } from '@/lib/model.js'
import { DEFAULT_ADMIN_SETTINGS } from '@/lib/defaults.js'

// ---------------------------------------------------------------------------
// Constants and pure helpers
// ---------------------------------------------------------------------------

const SETTING_KEYS = Object.keys(DEFAULT_ADMIN_SETTINGS)
const HEX_RE = /^#[0-9a-f]{6}$/i
const MAX_LOGO_BYTES = 500 * 1024
const EXPORT_VERSION = 1

const COLOR_FIELDS = [
  { key: 'primaryColor', label: 'Primary Color', hint: 'Headings, highlights and the header tint' },
  { key: 'secondaryColor', label: 'Secondary Color', hint: 'Reserved for secondary accents' },
  { key: 'accentColor', label: 'Accent Color', hint: 'Badges and chart accents' },
]

/** Keep only the known flat keys, falling back to defaults for anything missing. */
function pickSettings(source) {
  return Object.fromEntries(
    SETTING_KEYS.map((k) => [k, source?.[k] ?? DEFAULT_ADMIN_SETTINGS[k]]),
  )
}

function settingsEqual(a, b) {
  return SETTING_KEYS.every((k) => a?.[k] === b?.[k])
}

function isValidLogoUrl(value) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 2 * MAX_LOGO_BYTES &&
    (value.startsWith('data:image/') ||
      value.startsWith('http://') ||
      value.startsWith('https://') ||
      value.startsWith('/') ||
      value.startsWith('.'))
  )
}

/** Validate a form / imported settings object. Returns { value, errors }. */
function validateSettings(raw) {
  const errors = []
  const value = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { value, errors: ['Settings must be an object'] }
  }
  for (const { key, label } of COLOR_FIELDS) {
    if (raw[key] === undefined) continue
    if (typeof raw[key] === 'string' && HEX_RE.test(raw[key].trim())) {
      value[key] = raw[key].trim().toUpperCase()
    } else {
      errors.push(`${label} must be a hex colour like #E30613`)
    }
  }
  if (raw.companyName !== undefined) {
    if (typeof raw.companyName === 'string' && raw.companyName.trim().length > 0) {
      value.companyName = raw.companyName.trim().slice(0, 100)
    } else {
      errors.push('Company name cannot be empty')
    }
  }
  if (raw.logoUrl !== undefined) {
    if (isValidLogoUrl(raw.logoUrl)) {
      value.logoUrl = raw.logoUrl
    } else {
      errors.push('Logo must be an image data URL or a URL/path')
    }
  }
  return { value, errors }
}

/**
 * Validate imported project data. Returns a sanitised object in the same
 * shape App.jsx persists, or null if the input is not usable.
 */
function sanitizeTrackerData(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  if (!Array.isArray(raw.phases)) return null
  const out = { phases: normalizePhases(raw.phases) }
  if (typeof raw.projectTitle === 'string' && raw.projectTitle.trim()) out.projectTitle = raw.projectTitle
  if (typeof raw.projectSubtitle === 'string' && raw.projectSubtitle.trim()) out.projectSubtitle = raw.projectSubtitle
  if (Number.isFinite(raw.overallProgress)) out.overallProgress = clampPercent(raw.overallProgress)
  if (raw.metrics && typeof raw.metrics === 'object' && !Array.isArray(raw.metrics)) {
    out.metrics = Object.fromEntries(
      Object.entries(raw.metrics).filter(([, v]) => Number.isFinite(v)),
    )
  }
  return out
}

function downloadJSON(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error || new Error('Could not read file'))
    reader.readAsText(file)
  })
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error || new Error('Could not read file'))
    reader.readAsDataURL(file)
  })
}

function formatDateTime(value) {
  if (!value) return 'Not yet saved'
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleString()
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const STATUS_STYLES = {
  success: 'border-green-200 bg-green-50 text-green-800',
  error: 'border-red-200 bg-red-50 text-red-800',
  info: 'border-blue-200 bg-blue-50 text-blue-800',
}

function StatusBanner({ status, onDismiss }) {
  if (!status) return null
  const Icon = status.type === 'success' ? CheckCircle : AlertTriangle
  return (
    <div
      role="status"
      className={`flex items-start justify-between gap-3 rounded-lg border px-3 py-2 text-sm ${STATUS_STYLES[status.type] || STATUS_STYLES.info}`}
    >
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
        <span className="whitespace-pre-line">{status.text}</span>
      </div>
      <button type="button" onClick={onDismiss} aria-label="Dismiss message" className="opacity-70 hover:opacity-100">
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

function ColorField({ id, label, hint, value, onChange }) {
  const valid = HEX_RE.test(value)
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          id={`${id}-picker`}
          type="color"
          aria-label={`${label} picker`}
          value={valid ? value : '#000000'}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-9 w-12 cursor-pointer rounded border p-0.5"
        />
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#E30613"
          maxLength={7}
          className={`font-mono ${valid ? '' : 'border-red-400'}`}
          aria-invalid={!valid}
        />
      </div>
      <p className="text-xs text-gray-500">{hint}</p>
    </div>
  )
}

function StatsCard({ systemStats }) {
  const stats = systemStats || {}
  const items = [
    { label: 'Active users', value: `${stats.activeUsers ?? 0} / ${stats.totalUsers ?? 0}` },
    { label: 'Phases', value: stats.phases ?? 0 },
    { label: 'Tasks', value: stats.tasks ?? 0 },
    { label: 'Last saved', value: formatDateTime(stats.lastSavedAt), small: true },
  ]
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Activity className="w-5 h-5" />
          <span>System Stats</span>
        </CardTitle>
        <CardDescription>Live figures from the current workspace</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {items.map(({ label, value, small }) => (
            <div key={label} className="text-center p-3 rounded-lg bg-gray-50">
              <div className={`${small ? 'text-sm' : 'text-2xl'} font-bold text-gray-800`}>{value}</div>
              <div className="text-xs text-gray-500">{label}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EnhancedAdminSettings({ adminSettings, onSettingsUpdate, currentUser, systemStats }) {
  const ids = useId()
  const logoInputId = `${ids}-logo`
  const importInputId = `${ids}-import`

  const [form, setForm] = useState(() => pickSettings(adminSettings))
  // Re-derive the form only when the saved settings actually change (save /
  // reset / external update). Comparing values means in-progress edits are
  // never clobbered by a parent re-render with an equal object.
  const [syncedFrom, setSyncedFrom] = useState(adminSettings)
  if (!settingsEqual(syncedFrom, adminSettings)) {
    setSyncedFrom(adminSettings)
    setForm(pickSettings(adminSettings))
  }

  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)

  const saved = pickSettings(adminSettings)
  const dirty = !settingsEqual(form, saved)

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  // --- Save / reset ---------------------------------------------------------

  const saveSettings = () => {
    const { value, errors } = validateSettings(form)
    if (errors.length > 0) {
      setStatus({ type: 'error', text: errors.join('\n') })
      return
    }
    onSettingsUpdate(value)
    setStatus({ type: 'success', text: 'Settings saved.' })
  }

  const discardChanges = () => {
    setForm(saved)
    setStatus(null)
  }

  const resetSettings = () => {
    if (!window.confirm('Reset branding and appearance to the defaults? This cannot be undone.')) return
    onSettingsUpdate({ ...DEFAULT_ADMIN_SETTINGS })
    setStatus({ type: 'info', text: 'Settings reset to defaults.' })
  }

  // --- Logo -----------------------------------------------------------------

  const handleLogoUpload = async (event) => {
    const input = event.target
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setStatus({ type: 'error', text: 'Please choose an image file (PNG, JPEG, SVG, ...).' })
      return
    }
    if (file.size > MAX_LOGO_BYTES) {
      setStatus({
        type: 'error',
        text: `Logo is ${(file.size / 1024).toFixed(0)} KB; the limit is ${MAX_LOGO_BYTES / 1024} KB. Please use a smaller image.`,
      })
      return
    }
    setBusy(true)
    try {
      const dataUrl = await readFileAsDataURL(file)
      setField('logoUrl', dataUrl)
      setStatus({ type: 'info', text: 'Logo loaded. Click Save to apply it.' })
    } catch (error) {
      setStatus({ type: 'error', text: `Could not read the image: ${error.message}` })
    } finally {
      setBusy(false)
    }
  }

  // --- Export / import ------------------------------------------------------

  const exportData = () => {
    const payload = {
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      adminSettings: saved,
      trackerData: loadJSON(STORAGE_KEYS.trackerData, null),
    }
    downloadJSON(`onecloud-tracker-export-${new Date().toISOString().slice(0, 10)}.json`, payload)
    setStatus({ type: 'success', text: 'Export downloaded.' })
  }

  const importData = async (event) => {
    const input = event.target
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    setBusy(true)
    try {
      let parsed
      try {
        parsed = JSON.parse(await readFileAsText(file))
      } catch {
        setStatus({ type: 'error', text: 'That file is not valid JSON.' })
        return
      }
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        setStatus({ type: 'error', text: 'Import file must contain a JSON object.' })
        return
      }

      // Accept either our export shape or a bare settings / tracker object.
      const rawSettings = parsed.adminSettings ?? (SETTING_KEYS.some((k) => k in parsed) ? parsed : undefined)
      const rawTracker = parsed.trackerData ?? (Array.isArray(parsed.phases) ? parsed : undefined)

      const settingsResult = rawSettings !== undefined ? validateSettings(rawSettings) : { value: {}, errors: [] }
      const tracker = rawTracker !== undefined ? sanitizeTrackerData(rawTracker) : undefined
      const hasSettings = Object.keys(settingsResult.value).length > 0

      if (rawTracker !== undefined && tracker === null) {
        setStatus({ type: 'error', text: 'Project data in this file is not in a recognised shape (expected a "phases" array). Nothing was imported.' })
        return
      }
      if (!hasSettings && !tracker) {
        setStatus({
          type: 'error',
          text: ['Nothing importable found in this file.', ...settingsResult.errors].join('\n'),
        })
        return
      }

      const warnings = settingsResult.errors.length > 0 ? `\nSkipped invalid settings: ${settingsResult.errors.join('; ')}` : ''

      if (tracker) {
        // App reads tracker data once on start, so write it to storage and
        // ask for a reload. Bundle the imported settings into the same write
        // so they apply together.
        const existing = loadJSON(STORAGE_KEYS.trackerData, null) || {}
        const merged = {
          ...existing,
          ...tracker,
          adminSettings: { ...saved, ...settingsResult.value },
          lastUpdated: new Date().toISOString(),
        }
        if (!saveJSON(STORAGE_KEYS.trackerData, merged)) {
          setStatus({ type: 'error', text: 'Could not write the imported data to browser storage (it may be full).' })
          return
        }
        if (window.confirm('Project data imported. Reload now to apply it? Unsaved edits in this session will be lost.')) {
          window.location.reload()
          return
        }
        setStatus({
          type: 'info',
          text: `Project data was written to storage. Reload the page to apply it; editing anything before reloading will overwrite the import.${warnings}`,
        })
        return
      }

      onSettingsUpdate(settingsResult.value)
      setStatus({ type: 'success', text: `Settings imported and applied.${warnings}` })
    } catch (error) {
      setStatus({ type: 'error', text: `Import failed: ${error.message}` })
    } finally {
      setBusy(false)
    }
  }

  // --- Render ---------------------------------------------------------------

  if (currentUser?.role !== 'admin') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="w-5 h-5" />
            <span>Admin Settings</span>
          </CardTitle>
          <CardDescription>Branding, appearance and data management</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Lock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">Access Restricted</p>
            <p className="text-sm text-gray-500">Admin settings require an administrator account.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const primaryValid = HEX_RE.test(form.primaryColor)
  const accentValid = HEX_RE.test(form.accentColor)
  const secondaryValid = HEX_RE.test(form.secondaryColor)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Settings className="w-5 h-5" />
                <span>Admin Settings</span>
                {dirty && (
                  <Badge variant="outline" className="ml-2">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Unsaved Changes
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>Branding, appearance and data management</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={exportData} disabled={busy}>
                <Download className="w-4 h-4 mr-1" />
                Export
              </Button>
              <Button variant="outline" size="sm" asChild>
                <label htmlFor={importInputId} className="cursor-pointer">
                  <Upload className="w-4 h-4 mr-1" />
                  Import
                </label>
              </Button>
              <input id={importInputId} type="file" accept="application/json,.json" className="hidden" onChange={importData} disabled={busy} />
              <Button variant="destructive" size="sm" onClick={resetSettings} disabled={busy}>
                <RefreshCw className="w-4 h-4 mr-1" />
                Reset
              </Button>
              {dirty && (
                <Button variant="outline" size="sm" onClick={discardChanges} disabled={busy}>
                  Discard
                </Button>
              )}
              <Button size="sm" onClick={saveSettings} disabled={!dirty || busy} style={{ backgroundColor: saved.primaryColor }}>
                <Save className="w-4 h-4 mr-1" />
                Save Changes
              </Button>
            </div>
          </div>
        </CardHeader>
        {status && (
          <CardContent>
            <StatusBanner status={status} onDismiss={() => setStatus(null)} />
          </CardContent>
        )}
      </Card>

      <StatsCard systemStats={systemStats} />

      <Tabs defaultValue="appearance" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="appearance" className="flex items-center space-x-1">
            <Palette className="w-4 h-4" />
            <span className="hidden sm:inline">Appearance</span>
          </TabsTrigger>
          <TabsTrigger value="branding" className="flex items-center space-x-1">
            <Building2 className="w-4 h-4" />
            <span className="hidden sm:inline">Branding</span>
          </TabsTrigger>
          <TabsTrigger value="data" className="flex items-center space-x-1">
            <Database className="w-4 h-4" />
            <span className="hidden sm:inline">Data</span>
          </TabsTrigger>
        </TabsList>

        {/* Appearance */}
        <TabsContent value="appearance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Colour Scheme</CardTitle>
              <CardDescription>Colours used across the header, badges and charts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  {COLOR_FIELDS.map(({ key, label, hint }) => (
                    <ColorField
                      key={key}
                      id={`${ids}-${key}`}
                      label={label}
                      hint={hint}
                      value={form[key]}
                      onChange={(v) => setField(key, v)}
                    />
                  ))}
                </div>
                <div className="space-y-2">
                  <Label>Preview</Label>
                  <div className="rounded-lg border overflow-hidden">
                    <div
                      className="flex items-center gap-3 px-4 py-3 border-b"
                      style={{ backgroundColor: primaryValid ? `${form.primaryColor}0D` : undefined }}
                    >
                      <img src={form.logoUrl} alt="" className="h-8 w-auto object-contain" />
                      <span className="font-bold" style={{ color: primaryValid ? form.primaryColor : undefined }}>
                        {form.companyName || 'Company name'}
                      </span>
                    </div>
                    <div className="p-4 space-y-3 bg-white">
                      <div className="flex items-center gap-2">
                        <Badge style={{ backgroundColor: primaryValid ? form.primaryColor : undefined, color: '#fff' }}>Primary</Badge>
                        <Badge style={{ backgroundColor: secondaryValid ? form.secondaryColor : undefined, color: '#fff' }}>Secondary</Badge>
                        <Badge style={{ backgroundColor: accentValid ? form.accentColor : undefined, color: '#000' }}>Accent</Badge>
                      </div>
                      <div className="h-2 w-full rounded bg-gray-200 overflow-hidden">
                        <div className="h-full w-2/3" style={{ backgroundColor: primaryValid ? form.primaryColor : undefined }} />
                      </div>
                      <Button size="sm" type="button" style={{ backgroundColor: primaryValid ? form.primaryColor : undefined }}>
                        Sample button
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Branding */}
        <TabsContent value="branding" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Company Branding</CardTitle>
              <CardDescription>Name and logo shown in the header and on the login screen</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <Label htmlFor={`${ids}-companyName`}>Company Name</Label>
                    <Input
                      id={`${ids}-companyName`}
                      value={form.companyName}
                      onChange={(e) => setField('companyName', e.target.value)}
                      placeholder="Company name"
                      maxLength={100}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={logoInputId}>Logo</Label>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <label htmlFor={logoInputId} className="cursor-pointer">
                          <Upload className="w-4 h-4 mr-1" />
                          Upload image
                        </label>
                      </Button>
                      <input id={logoInputId} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={busy} />
                      {form.logoUrl !== DEFAULT_ADMIN_SETTINGS.logoUrl && (
                        <Button variant="ghost" size="sm" onClick={() => setField('logoUrl', DEFAULT_ADMIN_SETTINGS.logoUrl)}>
                          Use default logo
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      PNG, JPEG or SVG up to {MAX_LOGO_BYTES / 1024} KB. The image is stored in the browser with the rest of the tracker data.
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Logo Preview</Label>
                  <div className="flex items-center justify-center rounded-lg border bg-gray-50 p-6 min-h-32">
                    {form.logoUrl ? (
                      <img src={form.logoUrl} alt={`${form.companyName || 'Company'} logo`} className="max-h-24 w-auto object-contain" />
                    ) : (
                      <span className="text-sm text-gray-500">No logo</span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Data */}
        <TabsContent value="data" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Data Management</CardTitle>
              <CardDescription>Export or import the tracker's settings and project data as a JSON file</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center space-x-2 font-medium">
                    <Download className="w-4 h-4" />
                    <span>Export</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    Downloads branding settings plus all phases, tasks, metrics and titles currently saved in this browser.
                  </p>
                  <Button variant="outline" className="w-full" onClick={exportData} disabled={busy}>
                    Download JSON
                  </Button>
                </div>
                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center space-x-2 font-medium">
                    <Upload className="w-4 h-4" />
                    <span>Import</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    Restores a previous export. Settings apply immediately; project data is written to storage and needs a reload.
                  </p>
                  <Button variant="outline" className="w-full" asChild>
                    <label htmlFor={importInputId} className="cursor-pointer">
                      Choose file
                    </label>
                  </Button>
                </div>
                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center space-x-2 font-medium">
                    <RefreshCw className="w-4 h-4" />
                    <span>Reset</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    Restores the default colours, company name and logo. Phases and tasks are not affected.
                  </p>
                  <Button variant="destructive" className="w-full" onClick={resetSettings} disabled={busy}>
                    Reset to defaults
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
