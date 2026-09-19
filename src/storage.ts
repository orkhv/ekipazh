import type { AppState, Tour } from './types'

const KEY = 'ekipazh.v1'

export function loadState(): AppState | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AppState
    if (!Array.isArray(parsed.tours)) return null
    for (const tour of parsed.tours) {
      for (const person of tour.people) {
        if ((person.experience as string) === 'pro') person.experience = 'regular'
      }
    }
    return parsed
  } catch {
    return null
  }
}

export function saveState(state: AppState): void {
  localStorage.setItem(KEY, JSON.stringify(state))
}

export function exportTour(tour: Tour): string {
  return JSON.stringify(tour, null, 2)
}

export function downloadJson(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
