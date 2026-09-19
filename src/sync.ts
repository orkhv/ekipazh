import { migrateState } from './storage'
import type { AppState } from './types'

const ROOM_KEY = 'ekipazh.room'
const ROOM_STAMP_KEY = 'ekipazh.room.updatedAt'
const DIRTY_KEY = 'ekipazh.localDirtyAt'
const POINTER_API = 'https://api.restful-api.dev/objects'
const BLOB_API = 'https://dpaste.com/api/v2/'
const ROOM_RE = /^[a-zA-Z0-9]{8,80}$/
const BLOB_RE = /^[a-zA-Z0-9]{6,16}$/

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
  if (!isRecord(value) || typeof value.updatedAt !== 'number') return null
  const state = migrateState(value.state)
  if (!state) return null
  return { updatedAt: value.updatedAt, state }
}

async function readJson(response: Response): Promise<unknown> {
  if (!response.ok) throw new Error(`sync ${response.status}`)
  return response.json()
}

async function putBlob(envelope: RoomEnvelope): Promise<string> {
  const response = await fetch(BLOB_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'text/plain' },
    body: new URLSearchParams({
      content: JSON.stringify(envelope),
      syntax: 'json',
      expiry_days: '365',
    }),
  })
  if (!response.ok) throw new Error(`blob ${response.status}`)
  const id = (await response.text()).trim().split('/').filter(Boolean).pop() ?? ''
  if (!BLOB_RE.test(id)) throw new Error('blob id')
  return id
}

async function getBlob(id: string): Promise<RoomEnvelope | null> {
  const response = await fetch(`https://dpaste.com/${id}.txt`, { headers: { Accept: 'text/plain' } })
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`blob ${response.status}`)
  return envelopeFromUnknown(JSON.parse(await response.text()))
}

async function writePointer(id: string | null, blobId: string, updatedAt: number): Promise<string> {
  const payload = {
    name: 'ekipazh',
    data: { d: blobId, t: String(updatedAt) },
  }
  const response = await fetch(id ? `${POINTER_API}/${id}` : POINTER_API, {
    method: id ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  })
  const body = await readJson(response)
  if (id) return id
  const created = isRecord(body) && typeof body.id === 'string' ? body.id : ''
  if (!ROOM_RE.test(created)) throw new Error('sync id')
  return created
}

function pointerBlobId(value: unknown): string | null {
  const root = isRecord(value) ? value : null
  const data = root && isRecord(root.data) ? root.data : root
  const blobId = data && typeof data.d === 'string' ? data.d : ''
  return BLOB_RE.test(blobId) ? blobId : null
}

export async function pullRoom(id: string): Promise<RoomEnvelope | null> {
  const response = await fetch(`${POINTER_API}/${id}`, { headers: { Accept: 'application/json' } })
  if (response.status === 404) return null
  const blobId = pointerBlobId(await readJson(response))
  if (!blobId) return null
  return getBlob(blobId)
}

export async function pushRoom(id: string, state: AppState, updatedAt: number): Promise<void> {
  const blobId = await putBlob({ updatedAt, state })
  await writePointer(id, blobId, updatedAt)
}

export async function createRoom(state: AppState): Promise<{ id: string; updatedAt: number }> {
  const updatedAt = Date.now()
  const envelope = { updatedAt, state }
  try {
    const blobId = await putBlob(envelope)
    const id = await writePointer(null, blobId, updatedAt)
    return { id, updatedAt }
  } catch {
    const blobId = await putBlob(envelope)
    const id = await writePointer(null, blobId, updatedAt)
    return { id, updatedAt }
  }
}
