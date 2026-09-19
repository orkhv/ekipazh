import { migrateState } from './storage'
import type { AppState } from './types'

const ROOM_KEY = 'ekipazh.room'
const ROOM_STAMP_KEY = 'ekipazh.room.updatedAt'
const DIRTY_KEY = 'ekipazh.localDirtyAt'
const API = 'https://api.restful-api.dev/objects'
const ROOM_RE = /^[a-zA-Z0-9]{8,80}$/

export interface RoomEnvelope {
  updatedAt: number
  state: AppState
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}

export function blankState(): AppState {
  return { tours: [], activeTourId: null }
}

export function readHashRoom(): string | null {
  const raw = window.location.hash.replace(/^#/, '')
  const params = new URLSearchParams(raw.includes('=') ? raw : `r=${raw}`)
  const id = params.get('r')?.trim() ?? ''
  return ROOM_RE.test(id) ? id : null
}

export function readSavedRoom(): string | null {
  try {
    const id = localStorage.getItem(ROOM_KEY)?.trim() ?? ''
    return ROOM_RE.test(id) ? id : null
  } catch {
    return null
  }
}

export function peekRoomId(): string | null {
  return readHashRoom() ?? readSavedRoom()
}

export function rememberRoom(id: string): void {
  localStorage.setItem(ROOM_KEY, id)
}

export function writeRoomHash(id: string): void {
  const next = `#r=${id}`
  if (window.location.hash !== next) {
    history.replaceState(null, '', `${window.location.pathname}${window.location.search}${next}`)
  }
}

export function roomUrl(id: string): string {
  return `${window.location.origin}${window.location.pathname}${window.location.search}#r=${id}`
}

export function readRoomStamp(): number {
  const raw = localStorage.getItem(ROOM_STAMP_KEY)
  const value = raw ? Number(raw) : 0
  return Number.isFinite(value) ? value : 0
}

export function writeRoomStamp(updatedAt: number): void {
  localStorage.setItem(ROOM_STAMP_KEY, String(updatedAt))
}

export function readDirtyAt(): number {
  const raw = localStorage.getItem(DIRTY_KEY)
  const value = raw ? Number(raw) : 0
  return Number.isFinite(value) ? value : 0
}

export function writeDirtyAt(updatedAt: number): void {
  localStorage.setItem(DIRTY_KEY, String(updatedAt))
}

function envelopeFromUnknown(value: unknown): RoomEnvelope | null {
  const root = isRecord(value) ? value : null
  const data = root && isRecord(root.data) ? root.data : root
  if (!data || typeof data.updatedAt !== 'number') return null
  const state = migrateState(data.state)
  if (!state) return null
  return { updatedAt: data.updatedAt, state }
}

async function readJson(response: Response): Promise<unknown> {
  if (!response.ok) throw new Error(`sync ${response.status}`)
  return response.json()
}

export async function pullRoom(id: string): Promise<RoomEnvelope | null> {
  const response = await fetch(`${API}/${id}`, { headers: { Accept: 'application/json' } })
  if (response.status === 404) return null
  return envelopeFromUnknown(await readJson(response))
}

export async function pushRoom(id: string, state: AppState, updatedAt: number): Promise<void> {
  const response = await fetch(`${API}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      name: 'ekipazh',
      data: { v: 1, updatedAt, state },
    }),
  })
  if (!response.ok) throw new Error(`sync ${response.status}`)
}

export async function createRoom(state: AppState): Promise<{ id: string; updatedAt: number }> {
  const updatedAt = Date.now()
  const response = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      name: 'ekipazh',
      data: { v: 1, updatedAt, state },
    }),
  })
  const payload = await readJson(response)
  const id = isRecord(payload) && typeof payload.id === 'string' ? payload.id : ''
  if (!ROOM_RE.test(id)) throw new Error('sync id')
  return { id, updatedAt }
}
