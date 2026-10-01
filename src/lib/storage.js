// Small, safe wrappers around localStorage. Every read is guarded so a
// corrupt or missing value never crashes the app.

export function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    return JSON.parse(raw)
  } catch (error) {
    console.error(`Could not read "${key}" from localStorage`, error)
    return fallback
  }
}

export function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch (error) {
    console.error(`Could not write "${key}" to localStorage`, error)
    return false
  }
}

export function removeKey(key) {
  try {
    localStorage.removeItem(key)
  } catch (error) {
    console.error(`Could not remove "${key}" from localStorage`, error)
  }
}
