import { useEffect, useReducer, useRef, useState } from 'react'
import { moveToCar, planFromSeats, seatTour, swapCars } from './algorithm'
import { Garage } from './components/Garage'
import { Roster } from './components/Roster'
import { planAsText } from './copy'
import { formatDate, todayISO, uid } from './ids'
import { mulberry32 } from './rng'
import { seedState } from './seed'
import { loadState, saveState } from './storage'
import { currentTour, reducer } from './state'
import {
  blankState,
  createRoom,
  peekRoomId,
  pullRoom,
  pushRoom,
  readDirtyAt,
  readHashRoom,
  rememberRoom,
  roomUrl,
  writeDirtyAt,
  writeRoomHash,
  writeRoomStamp,
} from './sync'
import type { CarId } from './types'

export function App() {
  const [state, dispatch] = useReducer(reducer, null, () => loadState() ?? (peekRoomId() ? blankState() : seedState()))
  const [toursOpen, setToursOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [newTourName, setNewTourName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [roomId, setRoomId] = useState<string | null>(() => peekRoomId())
  const [shareBusy, setShareBusy] = useState(false)
  const [cloudReady, setCloudReady] = useState(!peekRoomId())
  const hydrating = useRef(false)
  const booted = useRef(false)
  const dirtyAt = useRef(readDirtyAt())
  const lastPushed = useRef('')
  const stateRef = useRef(state)
  const tour = currentTour(state)
  stateRef.current = state

  useEffect(() => {
    saveState(state)
    if (!booted.current) {
      booted.current = true
      return
    }
    if (hydrating.current) {
      hydrating.current = false
      return
    }
    dirtyAt.current = Date.now()
    writeDirtyAt(dirtyAt.current)
  }, [state])

  useEffect(() => {
    const applyRoom = async (id: string, quiet: boolean) => {
      rememberRoom(id)
      writeRoomHash(id)
      setRoomId(id)
      try {
        const remote = await pullRoom(id)
        if (!remote) {
          if (!quiet) setToast('Общая ссылка пока пустая, пишем сюда')
          return
        }
        if (remote.updatedAt < dirtyAt.current) return
        hydrating.current = true
        lastPushed.current = JSON.stringify(remote.state)
        writeRoomStamp(remote.updatedAt)
        writeDirtyAt(remote.updatedAt)
        dirtyAt.current = remote.updatedAt
        dispatch({ type: 'hydrate', state: remote.state })
      } catch {
        if (!quiet) setToast('Сеть молчит, пока данные с этого экрана')
      } finally {
        setCloudReady(true)
      }
    }

    const incoming = readHashRoom() ?? peekRoomId()
    if (incoming) void applyRoom(incoming, false)

    const onHash = () => {
      const next = readHashRoom()
      if (next) void applyRoom(next, false)
    }
    let lastWake = 0
    const onWake = () => {
      if (Date.now() - lastWake < 4000) return
      lastWake = Date.now()
      const current = peekRoomId()
      if (current) void applyRoom(current, true)
    }

    window.addEventListener('hashchange', onHash)
    window.addEventListener('focus', onWake)
    document.addEventListener('visibilitychange', onWake)
    return () => {
      window.removeEventListener('hashchange', onHash)
      window.removeEventListener('focus', onWake)
      document.removeEventListener('visibilitychange', onWake)
    }
  }, [])

  useEffect(() => {
    if (!roomId || !cloudReady) return
    const serialized = JSON.stringify(state)
    if (serialized === lastPushed.current) return
    const timer = window.setTimeout(() => {
      const updatedAt = Date.now()
      void pushRoom(roomId, stateRef.current, updatedAt)
        .then(() => {
          lastPushed.current = JSON.stringify(stateRef.current)
          writeRoomStamp(updatedAt)
        })
        .catch(() => setToast('Не долетело на другие экраны, здесь сохранилось'))
    }, 1400)
    return () => window.clearTimeout(timer)
  }, [roomId, state, cloudReady])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 2200)
    return () => window.clearTimeout(timer)
  }, [toast])

  const generate = (reshuffle: boolean) => {
    if (!tour) return
    const result = seatTour(tour, mulberry32(Date.now() + Math.floor(Math.random() * 1000)), reshuffle ? tour.draft?.seats : undefined)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setError(null)
    setSelectedId(null)
    dispatch({
      type: 'setDraft',
      plan: planFromSeats(uid('day'), todayISO(), result.seats, result.notes, result.score),
    })
  }

  const touchPlan = (seats: ReturnType<typeof moveToCar>) => {
    if (!tour?.draft || !seats) return
    dispatch({
      type: 'setDraft',
      plan: {
        ...tour.draft,
        seats,
        notes: ['Посадка поправлена руками.', ...tour.draft.notes.filter((note) => !note.startsWith('Посадка'))],
      },
    })
    setSelectedId(null)
  }

  const onMove = (car: CarId) => {
    if (!tour?.draft || !selectedId) return
    touchPlan(moveToCar(tour.draft.seats, selectedId, car, tour.people, tour))
  }

  const onSwap = (id: string) => {
    if (!tour?.draft || !selectedId) return
    touchPlan(swapCars(tour.draft.seats, selectedId, id, tour.people))
  }

  const copyPlan = async () => {
    if (!tour?.draft) return
    const text = planAsText(tour, tour.draft)
    try {
      await navigator.clipboard.writeText(text)
      setToast('Рассадка скопирована')
    } catch {
      setToast('Не вышло скопировать')
    }
  }

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      return false
    }
  }

  const openShare = async () => {
    setShareOpen(true)
    if (roomId) {
      writeRoomHash(roomId)
      const copied = await copyText(roomUrl(roomId))
      setToast(copied ? 'Ссылка скопирована' : 'Скопируй ссылку руками')
      return
    }
    setShareBusy(true)
    try {
      const created = await createRoom(stateRef.current)
      rememberRoom(created.id)
      writeRoomHash(created.id)
      writeRoomStamp(created.updatedAt)
      lastPushed.current = JSON.stringify(stateRef.current)
      setRoomId(created.id)
      const copied = await copyText(roomUrl(created.id))
      setToast(copied ? 'Ссылка скопирована — открой её на другом экране' : 'Скопируй ссылку руками')
    } catch {
      setToast('Не вышло открыть общую ссылку')
    } finally {
      setShareBusy(false)
    }
  }

  return (
    <div className="app">
      <header className="mast">
        <div className="brand">
          <span className="stamp">доброе утро</span>
          <h1>Экипаж</h1>
          <p>Две машины, свои люди, утро перед дорогой. Здесь только кто с кем едет.</p>
        </div>
        <div className="mast-side">
          <div className="share-line">
            <button className="btn ghost" type="button" onClick={() => void openShare()}>
              {roomId ? 'Общая ссылка' : 'На всех экранах'}
            </button>
            <span className="share-note">
              {roomId ? 'Телефон, комп и приставка смотрят одно и то же.' : 'Сейчас данные только в этом браузере.'}
            </span>
          </div>
          <div className="tour-switch">
            <button className="btn ghost" type="button" onClick={() => setToursOpen(true)}>
              {tour ? tour.name : 'Туры'}
            </button>
            <span className="meta">{formatDate(todayISO())}</span>
          </div>
        </div>
      </header>

      {tour ? (
        <div className="layout">
          <Garage
            tour={tour}
            error={error}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onMove={onMove}
            onSwap={onSwap}
            onGenerate={() => generate(false)}
            onReshuffle={() => generate(true)}
            onSave={() => {
              dispatch({ type: 'saveDraft' })
              setToast('Этот расклад запомнили')
            }}
            onCopy={copyPlan}
            dispatch={dispatch}
          />
          <Roster tour={tour} dispatch={dispatch} />
        </div>
      ) : (
        <section className="panel">
          <p>Создай первый выезд — и можно рассаживать.</p>
          <button className="btn primary" type="button" onClick={() => setToursOpen(true)}>
            Открыть туры
          </button>
        </section>
      )}

      {shareOpen && (
        <div className="modal-back" onClick={() => setShareOpen(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <h2 className="block-title">Один экипаж</h2>
            <p className="hint">
              Открой эту ссылку на телефоне, компьютере или PlayStation — состав и рассадка будут те же.
            </p>
            <label className="field">
              <span className="tiny-label">Ссылка</span>
              <input
                readOnly
                value={shareBusy ? 'Делаем ссылку…' : roomId ? roomUrl(roomId) : ''}
                onFocus={(event) => event.target.select()}
              />
            </label>
            <div className="adder-row">
              <button
                className="btn primary"
                type="button"
                disabled={shareBusy || !roomId}
                onClick={() => {
                  if (!roomId) return
                  void copyText(roomUrl(roomId)).then((copied) => {
                    setToast(copied ? 'Ссылка скопирована' : 'Скопируй ссылку руками')
                  })
                }}
              >
                Скопировать
              </button>
              <button className="btn ghost" type="button" onClick={() => setShareOpen(false)}>
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {toursOpen && (
        <div className="modal-back" onClick={() => setToursOpen(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <h2 className="block-title">Выезды</h2>
            <div className="tour-list">
              {state.tours.map((item) => (
                <div className="tour-item" key={item.id}>
                  <button
                    className="btn ghost"
                    type="button"
                    onClick={() => {
                      dispatch({ type: 'selectTour', id: item.id })
                      setToursOpen(false)
                    }}
                  >
                    {item.name}
                  </button>
                  <button
                    className="btn tiny danger"
                    type="button"
                    onClick={() => dispatch({ type: 'deleteTour', id: item.id })}
                  >
                    удалить
                  </button>
                </div>
              ))}
            </div>
            {tour && (
              <label className="field">
                <span className="tiny-label">Имя текущего выезда</span>
                <input
                  value={tour.name}
                  onChange={(event) => dispatch({ type: 'renameTour', name: event.target.value })}
                />
              </label>
            )}
            <div className="adder-row">
              <input
                className="inline-input"
                value={newTourName}
                onChange={(event) => setNewTourName(event.target.value)}
                placeholder="Новый выезд"
              />
              <button
                className="btn primary"
                type="button"
                onClick={() => {
                  dispatch({ type: 'createTour', name: newTourName })
                  setNewTourName('')
                  setToursOpen(false)
                }}
              >
                Создать
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
