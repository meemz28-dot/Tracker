import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Textarea } from '@/components/ui/textarea.jsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx'
import { Edit3, Check, X } from 'lucide-react'

export function EditableText({ value, onSave, className = "", style, multiline = false, placeholder = "" }) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value)

  useEffect(() => {
    setEditValue(value)
  }, [value])

  const handleSave = () => {
    onSave(editValue)
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditValue(value)
    setIsEditing(false)
  }

  if (isEditing) {
    return (
      <div className="flex items-center space-x-2">
        {multiline ? (
          <Textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="flex-1"
            placeholder={placeholder}
          />
        ) : (
          <Input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="flex-1"
            placeholder={placeholder}
          />
        )}
        <Button size="sm" onClick={handleSave} className="h-8 w-8 p-0">
          <Check className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="outline" onClick={handleCancel} className="h-8 w-8 p-0">
          <X className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  return (
    <div className={`group flex items-center space-x-2 ${className}`} style={style}>
      <span className="flex-1">{value}</span>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setIsEditing(true)}
        className="opacity-60 group-hover:opacity-100 hover:bg-gray-100 h-6 w-6 p-0 transition-opacity"
      >
        <Edit3 className="h-3 w-3" />
      </Button>
    </div>
  )
}

export function EditableNumber({ value, onSave, className = "", style, min = 0, max = 100, suffix = "" }) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value.toString())

  useEffect(() => {
    setEditValue(value.toString())
  }, [value])

  const handleSave = () => {
    const numValue = parseFloat(editValue)
    if (!isNaN(numValue) && numValue >= min && numValue <= max) {
      onSave(numValue)
      setIsEditing(false)
    }
  }

  const handleCancel = () => {
    setEditValue(value.toString())
    setIsEditing(false)
  }

  if (isEditing) {
    return (
      <div className="flex items-center space-x-2">
        <Input
          type="number"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          min={min}
          max={max}
          className="w-20"
        />
        <Button size="sm" onClick={handleSave} className="h-8 w-8 p-0">
          <Check className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="outline" onClick={handleCancel} className="h-8 w-8 p-0">
          <X className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  return (
    <div className={`group flex items-center space-x-2 ${className}`} style={style}>
      <span className="flex-1">{value}{suffix}</span>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setIsEditing(true)}
        className="opacity-60 group-hover:opacity-100 hover:bg-gray-100 h-6 w-6 p-0 transition-opacity"
      >
        <Edit3 className="h-3 w-3" />
      </Button>
    </div>
  )
}

export function EditableSelect({ value, options, onSave, className = "" }) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value)

  useEffect(() => {
    setEditValue(value)
  }, [value])

  const handleSave = (newValue) => {
    onSave(newValue)
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditValue(value)
    setIsEditing(false)
  }

  if (isEditing) {
    return (
      <div className="flex items-center space-x-2">
        <Select value={editValue} onValueChange={handleSave}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" onClick={handleCancel} className="h-8 w-8 p-0">
          <X className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  return (
    <div className={`group flex items-center space-x-2 ${className}`}>
      <span className="flex-1">{options.find(opt => opt.value === value)?.label || value}</span>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setIsEditing(true)}
        className="opacity-60 group-hover:opacity-100 hover:bg-gray-100 h-6 w-6 p-0 transition-opacity"
      >
        <Edit3 className="h-3 w-3" />
      </Button>
    </div>
  )
}

export function EditableDate({ value, onSave, className = "" }) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value)

  useEffect(() => {
    setEditValue(value)
  }, [value])

  const handleSave = () => {
    onSave(editValue)
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditValue(value)
    setIsEditing(false)
  }

  if (isEditing) {
    return (
      <div className="flex items-center space-x-2">
        <Input
          type="date"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          className="w-40"
        />
        <Button size="sm" onClick={handleSave} className="h-8 w-8 p-0">
          <Check className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="outline" onClick={handleCancel} className="h-8 w-8 p-0">
          <X className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  return (
    <div className={`group flex items-center space-x-2 ${className}`}>
      <span className="flex-1">{value}</span>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setIsEditing(true)}
        className="opacity-60 group-hover:opacity-100 hover:bg-gray-100 h-6 w-6 p-0 transition-opacity"
      >
        <Edit3 className="h-3 w-3" />
      </Button>
    </div>
  )
}

