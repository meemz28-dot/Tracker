import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Button } from '@/components/ui/button.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Lock, Key, Shield, Eye, EyeOff, Plus, Trash2, RefreshCw } from 'lucide-react'
import { MANAGER_PASSWORD, STORAGE_KEYS } from '@/lib/config.js'

const generateDefaultPINs = () => {
  const createdAt = new Date().toISOString()
  return [
    { id: 1, pin: '1234', label: 'Executive Access', active: true, createdAt },
    { id: 2, pin: '5678', label: 'Project Team', active: true, createdAt },
    { id: 3, pin: '9012', label: 'Stakeholders', active: true, createdAt },
    { id: 4, pin: '3456', label: 'Consultants', active: true, createdAt }
  ]
}

export function PINAuth({ onAuthenticated, adminSettings, users = [] }) {
  const [enteredPIN, setEnteredPIN] = useState('')
  const [showPIN, setShowPIN] = useState(false)
  const [error, setError] = useState('')
  const [pmPassword, setPmPassword] = useState('')
  const [showPMLogin, setShowPMLogin] = useState(false)
  const [activePINs, setActivePINs] = useState([])
  const [showPINManagement, setShowPINManagement] = useState(false)

  // Load saved PINs from localStorage
  useEffect(() => {
    const savedPINs = localStorage.getItem(STORAGE_KEYS.activePins)
    if (savedPINs) {
      try {
        const pins = JSON.parse(savedPINs)
        setActivePINs(pins)
      } catch (error) {
        console.error('Error loading PINs:', error)
        // Initialize with default PINs if loading fails
        const defaultPINs = generateDefaultPINs()
        setActivePINs(defaultPINs)
        localStorage.setItem(STORAGE_KEYS.activePins, JSON.stringify(defaultPINs))
      }
    } else {
      // Initialize with default PINs
      const defaultPINs = generateDefaultPINs()
      setActivePINs(defaultPINs)
      localStorage.setItem(STORAGE_KEYS.activePins, JSON.stringify(defaultPINs))
    }
  }, [])

  // Generate random 4-digit PIN
  const generateRandomPIN = () => {
    return Math.floor(1000 + Math.random() * 9000).toString()
  }

  // Save PINs to localStorage
  const savePINs = (pins) => {
    localStorage.setItem(STORAGE_KEYS.activePins, JSON.stringify(pins))
    setActivePINs(pins)
  }

  // Handle PIN input
  const handlePINInput = (digit) => {
    if (enteredPIN.length < 4) {
      const newPIN = enteredPIN + digit
      setEnteredPIN(newPIN)
      setError('')
      
      // Auto-submit when 4 digits entered
      if (newPIN.length === 4) {
        setTimeout(() => validatePIN(newPIN), 100)
      }
    }
  }

  // Clear PIN input
  const clearPIN = () => {
    setEnteredPIN('')
    setError('')
  }

  // Validate entered PIN
  // Named users (managed in User Management) take precedence over shared
  // access PINs. A shared PIN grants a read-only viewer session.
  const validatePIN = (pin) => {
    const user = users.find(u => u.pin === pin && u.isActive)
    if (user) {
      onAuthenticated({ label: user.name, user })
      return
    }
    const accessPIN = activePINs.find(p => p.pin === pin && p.active)
    if (accessPIN) {
      onAuthenticated({ label: accessPIN.label, user: null })
      return
    }
    setError('Invalid PIN. Please try again.')
    setEnteredPIN('')
  }

  // Handle project manager login
  const handlePMLogin = () => {
    if (pmPassword === MANAGER_PASSWORD) {
      setShowPMLogin(false)
      setShowPINManagement(true)
      setPmPassword('')
    } else {
      setError('Invalid project manager password')
    }
  }

  // Add new PIN
  const addNewPIN = () => {
    if (activePINs.length >= 6) {
      setError('Maximum 6 PINs allowed')
      return
    }

    const newPIN = {
      id: Date.now(),
      pin: generateRandomPIN(),
      label: `Access ${activePINs.length + 1}`,
      active: true,
      createdAt: new Date().toISOString()
    }

    const updatedPINs = [...activePINs, newPIN]
    savePINs(updatedPINs)
  }

  // Remove PIN
  const removePIN = (pinId) => {
    if (activePINs.length <= 1) {
      setError('At least one PIN must remain active')
      return
    }

    const updatedPINs = activePINs.filter(p => p.id !== pinId)
    savePINs(updatedPINs)
  }

  // Toggle PIN active status
  const togglePINStatus = (pinId) => {
    const updatedPINs = activePINs.map(p => 
      p.id === pinId ? { ...p, active: !p.active } : p
    )
    savePINs(updatedPINs)
  }

  // Regenerate PIN
  const regeneratePIN = (pinId) => {
    const updatedPINs = activePINs.map(p => 
      p.id === pinId ? { ...p, pin: generateRandomPIN() } : p
    )
    savePINs(updatedPINs)
  }

  // Update PIN label
  const updatePINLabel = (pinId, newLabel) => {
    const updatedPINs = activePINs.map(p => 
      p.id === pinId ? { ...p, label: newLabel } : p
    )
    savePINs(updatedPINs)
  }

  if (showPINManagement) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-blue-50 flex items-center justify-center p-4">
        <div className="w-full max-w-4xl">
          <Card className="shadow-2xl border-0">
            <CardHeader className="text-center pb-6" style={{ backgroundColor: `${adminSettings.primaryColor}10` }}>
              <div className="flex justify-center mb-4">
                <img 
                  src={adminSettings.logoUrl} 
                  alt={adminSettings.companyName} 
                  className="h-16 w-auto object-contain"
                />
              </div>
              <CardTitle className="text-2xl font-bold" style={{ color: adminSettings.primaryColor }}>
                PIN Management System
              </CardTitle>
              <CardDescription className="text-lg">
                Manage access PINs for the OneCloud Launch Tracker
              </CardDescription>
            </CardHeader>
            
            <CardContent className="p-8">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold">Active PINs ({activePINs.filter(p => p.active).length}/6)</h3>
                <div className="space-x-2">
                  <Button
                    onClick={addNewPIN}
                    disabled={activePINs.length >= 6}
                    className="flex items-center space-x-2"
                    style={{ backgroundColor: adminSettings.accentColor }}
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add PIN</span>
                  </Button>
                  <Button
                    onClick={() => setShowPINManagement(false)}
                    variant="outline"
                  >
                    Back to Login
                  </Button>
                </div>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activePINs.map((pinData) => (
                  <Card key={pinData.id} className={`border-2 ${pinData.active ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <input
                            type="text"
                            value={pinData.label}
                            onChange={(e) => updatePINLabel(pinData.id, e.target.value)}
                            className="font-semibold text-lg bg-transparent border-none outline-none w-full"
                            style={{ color: adminSettings.primaryColor }}
                          />
                          <p className="text-sm text-gray-500">
                            Created: {new Date(pinData.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <Badge variant={pinData.active ? "default" : "secondary"}>
                          {pinData.active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      
                      <div className="mb-4">
                        <div className="flex items-center space-x-2">
                          <span className="text-2xl font-mono font-bold tracking-wider">
                            {pinData.pin}
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => regeneratePIN(pinData.id)}
                            className="p-1"
                          >
                            <RefreshCw className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>

                      <div className="flex justify-between">
                        <Button
                          size="sm"
                          variant={pinData.active ? "secondary" : "default"}
                          onClick={() => togglePINStatus(pinData.id)}
                        >
                          {pinData.active ? "Deactivate" : "Activate"}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => removePIN(pinData.id)}
                          disabled={activePINs.length <= 1}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="mt-8 p-4 bg-blue-50 rounded-lg">
                <h4 className="font-semibold text-blue-800 mb-2">PIN Management Instructions:</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Share PINs with authorized personnel for dashboard access</li>
                  <li>• Use descriptive labels to identify PIN purposes</li>
                  <li>• Deactivate PINs temporarily without deleting them</li>
                  <li>• Regenerate PINs regularly for security</li>
                  <li>• Maximum 6 PINs can be active at any time</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (showPMLogin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-2xl border-0">
          <CardHeader className="text-center pb-6" style={{ backgroundColor: `${adminSettings.primaryColor}10` }}>
            <div className="flex justify-center mb-4">
              <Shield className="w-12 h-12" style={{ color: adminSettings.primaryColor }} />
            </div>
            <CardTitle className="text-xl font-bold" style={{ color: adminSettings.primaryColor }}>
              Project Manager Access
            </CardTitle>
            <CardDescription>
              Enter project manager password to manage PINs
            </CardDescription>
          </CardHeader>
          
          <CardContent className="p-6">
            {error && (
              <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Password</label>
                <input
                  type="password"
                  value={pmPassword}
                  onChange={(e) => setPmPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handlePMLogin()}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter password"
                />
              </div>

              <div className="flex space-x-2">
                <Button
                  onClick={handlePMLogin}
                  className="flex-1"
                  style={{ backgroundColor: adminSettings.primaryColor }}
                >
                  Access PIN Management
                </Button>
                <Button
                  onClick={() => {
                    setShowPMLogin(false)
                    setPmPassword('')
                    setError('')
                  }}
                  variant="outline"
                >
                  Cancel
                </Button>
              </div>
            </div>

          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-blue-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl border-0">
        <CardHeader className="text-center pb-6" style={{ backgroundColor: `${adminSettings.primaryColor}10` }}>
          <div className="flex justify-center mb-4">
            <img 
              src={adminSettings.logoUrl} 
              alt={adminSettings.companyName} 
              className="h-16 w-auto object-contain"
            />
          </div>
          <CardTitle className="text-2xl font-bold" style={{ color: adminSettings.primaryColor }}>
            OneCloud Launch Tracker
          </CardTitle>
          <CardDescription className="text-lg">
            Enter your 4-digit PIN to access the dashboard
          </CardDescription>
        </CardHeader>
        
        <CardContent className="p-8">
          {error && (
            <div className="mb-6 p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg text-center">
              {error}
            </div>
          )}

          {/* PIN Display */}
          <div className="mb-8">
            <div className="flex justify-center items-center space-x-3 mb-4">
              {[0, 1, 2, 3].map((index) => (
                <div
                  key={index}
                  className="w-12 h-12 border-2 rounded-lg flex items-center justify-center text-xl font-bold"
                  style={{ 
                    borderColor: enteredPIN.length > index ? adminSettings.primaryColor : '#e5e7eb',
                    backgroundColor: enteredPIN.length > index ? `${adminSettings.primaryColor}10` : 'white'
                  }}
                >
                  {enteredPIN.length > index && (showPIN ? enteredPIN[index] : '•')}
                </div>
              ))}
            </div>
            
            <div className="flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPIN(!showPIN)}
                className="text-gray-500 hover:text-gray-700"
              >
                {showPIN ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                <span className="ml-2">{showPIN ? 'Hide' : 'Show'} PIN</span>
              </Button>
            </div>
          </div>

          {/* Number Pad */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
              <Button
                key={digit}
                variant="outline"
                size="lg"
                onClick={() => handlePINInput(digit.toString())}
                className="h-12 text-lg font-semibold hover:bg-gray-50"
                disabled={enteredPIN.length >= 4}
              >
                {digit}
              </Button>
            ))}
            <Button
              variant="outline"
              size="lg"
              onClick={clearPIN}
              className="h-12 text-lg font-semibold hover:bg-red-50 hover:text-red-600"
            >
              Clear
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => handlePINInput('0')}
              className="h-12 text-lg font-semibold hover:bg-gray-50"
              disabled={enteredPIN.length >= 4}
            >
              0
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => enteredPIN.length > 0 && setEnteredPIN(enteredPIN.slice(0, -1))}
              className="h-12 text-lg font-semibold hover:bg-yellow-50 hover:text-yellow-600"
              disabled={enteredPIN.length === 0}
            >
              ⌫
            </Button>
          </div>

          {/* Submit Button */}
          <Button
            onClick={() => validatePIN(enteredPIN)}
            disabled={enteredPIN.length !== 4}
            className="w-full h-12 text-lg font-semibold mb-4"
            style={{ backgroundColor: adminSettings.primaryColor }}
          >
            <Lock className="w-5 h-5 mr-2" />
            Access Dashboard
          </Button>

          {/* Project Manager Access */}
          <div className="text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPMLogin(true)}
              className="text-gray-500 hover:text-gray-700"
            >
              <Key className="w-4 h-4 mr-2" />
              Project Manager
            </Button>
          </div>

          {/* Active PINs Info */}
          <div className="mt-6 p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-600 text-center">
              {activePINs.filter(p => p.active).length} active PIN(s) • Secure access to OneCloud dashboard
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default PINAuth

