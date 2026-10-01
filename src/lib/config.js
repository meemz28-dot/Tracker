// Central place for client-side configuration.
//
// NOTE: this is a static front-end with no backend. Anything defined here
// ships in the JavaScript bundle, so the manager password only gates the UI;
// it is not a security boundary. Set VITE_MANAGER_PASSWORD in a .env file
// to change it without editing source.
export const MANAGER_PASSWORD = import.meta.env.VITE_MANAGER_PASSWORD || 'onecloud2024'

export const STORAGE_KEYS = {
  trackerData: 'onecloud-tracker-data',
  users: 'onecloud-users',
  activePins: 'onecloud-active-pins',
  taskTimeTracking: 'onecloud-task-time-tracking',
  taskComments: 'onecloud-task-comments',
  searchHistory: 'onecloud-search-history',
  savedFilters: 'onecloud-saved-filters',
  dismissedNotifications: 'onecloud-dismissed-notifications',
}
