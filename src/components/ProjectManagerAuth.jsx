import { useState } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog.jsx'
import { Settings, Lock, Unlock, Eye, EyeOff } from 'lucide-react'
import { MANAGER_PASSWORD } from '@/lib/config.js'

export function ProjectManagerAuth({ isEditMode, onToggleEditMode }) {
  const [isAuthOpen, setIsAuthOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')

  const handleAuth = () => {
    if (password === MANAGER_PASSWORD) {
      onToggleEditMode(true)
      setIsAuthOpen(false)
      setPassword('')
      setError('')
    } else {
      setError('Invalid password')
    }
  }

  const handleLogout = () => {
    onToggleEditMode(false)
    setPassword('')
    setError('')
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleAuth()
    }
  }

  if (isEditMode) {
    return (
      <div className="flex items-center space-x-2">
        <div className="flex items-center space-x-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-md">
          <Unlock className="h-4 w-4" />
          <span className="text-sm font-medium">Edit Mode Active</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleLogout}
          className="flex items-center space-x-1"
        >
          <Lock className="h-4 w-4" />
          <span>Exit Edit Mode</span>
        </Button>
      </div>
    )
  }

  return (
    <Dialog open={isAuthOpen} onOpenChange={setIsAuthOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="flex items-center space-x-1"
        >
          <Settings className="h-4 w-4" />
          <span>Project Manager</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Lock className="h-5 w-5" />
            <span>Project Manager Access</span>
          </DialogTitle>
          <DialogDescription>
            Enter the project manager password to enable edit mode for all dashboard fields.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setError('')
                }}
                onKeyDown={handleKeyPress}
                placeholder="Enter password"
                className={error ? 'border-red-500' : ''}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
          </div>
          
          <div className="bg-gray-50 p-3 rounded-md">
            <p className="text-xs text-gray-500">
              In edit mode, you can modify all dashboard elements including progress, phases, tasks, metrics, and team information.
            </p>
          </div>

          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsAuthOpen(false)
                setPassword('')
                setError('')
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleAuth}>
              Enable Edit Mode
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

