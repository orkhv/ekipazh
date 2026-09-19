import { useEffect, useReducer, useState } from 'react'
import { moveToCar, planFromSeats, seatTour, swapCars } from './algorithm'
import { Garage } from './components/Garage'
import { Roster } from './components/Roster'
import { planAsText } from './copy'
import { formatDate, todayISO, uid } from './ids'
import { mulberry32 } from './rng'
import { seedState } from './seed'
import { loadState, saveState } from './storage'
import { currentTour, reducer } from './state'
import type { CarId } from './types'

export function App() {
  const [state, dispatch] = useReducer(reducer, null, () => loadState() ?? seedState())
  const [toursOpen, setToursOpen] = useState(false)
  const [newTourName, setNewTourName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const tour = currentTour(state)

  useEffect(() => {
    saveState(state)
  }, [state])

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

  return (
    <div className="app">
      <header className="mast">
        <div className="brand">
          <span className="stamp">утренний строй</span>
          <h1>Экипаж</h1>
          <p>
            Две машины, пары не рвём, новичков чаще к тебе, крупных разводим.
            Кто куда сядет внутри — уже сами. История дней помогает не повторять экипажи.
          </p>
        </div>
        <div className="mast-side">
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
