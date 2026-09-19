import { crewOf, occupancy } from '../algorithm'
import { formatDate } from '../ids'
import { EXP_LABEL, SIZE_LABEL } from '../labels'
import type { Action } from '../state'
import type { CarId, DayPlan, Person, Tour } from '../types'

interface Props {
  tour: Tour
  error: string | null
  selectedId: string | null
  onSelect: (id: string | null) => void
  onMove: (car: CarId) => void
  onSwap: (id: string) => void
  onGenerate: () => void
  onReshuffle: () => void
  onSave: () => void
  onCopy: () => void
  dispatch: (action: Action) => void
}

export function Garage({
  tour,
  error,
  selectedId,
  onSelect,
  onMove,
  onSwap,
  onGenerate,
  onReshuffle,
  onSave,
  onCopy,
  dispatch,
}: Props) {
  const plan = tour.draft
  const count = occupancy(tour)

  return (
    <section className="panel late">
      <div className="garage-toolbar">
        <div>
          <div className="panel-head" style={{ marginBottom: 8 }}>
            <h2>Экипажи</h2>
            <span className="meta">
              {count.riding} / {count.seats} мест
            </span>
          </div>
          <p className="hint">
            Жёлтая кнопка делит людей по машинам. Кто куда сядет внутри — решаете сами. Чтобы
            пересадить, ткни человека и другую машину.
          </p>
        </div>
        <div className="actions">
          <button className="btn primary" type="button" onClick={onGenerate}>
            Рассадить
          </button>
          <button className="btn" type="button" onClick={onReshuffle} disabled={!plan}>
            Ещё расклад
          </button>
          <button className="btn" type="button" onClick={onSave} disabled={!plan}>
            Запомнить день
          </button>
          <button className="btn ghost" type="button" onClick={onCopy} disabled={!plan}>
            В чат
          </button>
        </div>
      </div>

      <div className="caps">
        <CapCard
          label="Машина 1"
          name={tour.car1Name}
          seats={tour.car1Seats}
          onName={(name) => dispatch({ type: 'setCarName', car: 1, name })}
          onSeats={(seats) => dispatch({ type: 'setCarSeats', car: 1, seats })}
        />
        <CapCard
          label="Машина 2"
          name={tour.car2Name}
          seats={tour.car2Seats}
          onName={(name) => dispatch({ type: 'setCarName', car: 2, name })}
          onSeats={(seats) => dispatch({ type: 'setCarSeats', car: 2, seats })}
        />
      </div>

      <div className="cabins" style={{ marginTop: 14 }}>
        <Cabin
          car={1}
          title={tour.car1Name}
          capacity={tour.car1Seats}
          plan={plan}
          people={tour.people}
          selectedId={selectedId}
          onSelect={onSelect}
          onMove={onMove}
          onSwap={onSwap}
        />
        <Cabin
          car={2}
          title={tour.car2Name}
          capacity={tour.car2Seats}
          plan={plan}
          people={tour.people}
          selectedId={selectedId}
          onSelect={onSelect}
          onMove={onMove}
          onSwap={onSwap}
        />
      </div>

      {error && <div className="error">{error}</div>}

      {plan && plan.notes.length > 0 && (
        <div className="notes">
          {plan.notes.map((note) => (
            <div className="note" key={note}>
              {note}
            </div>
          ))}
        </div>
      )}

      {tour.history.length > 0 && (
        <div className="history">
          <div className="block-title">Прошлые утра</div>
          {tour.history.map((day) => (
            <button
              className="day"
              key={day.id}
              type="button"
              onClick={() => dispatch({ type: 'setDraft', plan: day })}
            >
              {formatDate(day.date)} · {shortCrew(tour, day, 1)} / {shortCrew(tour, day, 2)}
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

function CapCard({
  label,
  name,
  seats,
  onName,
  onSeats,
}: {
  label: string
  name: string
  seats: 4 | 5
  onName: (name: string) => void
  onSeats: (seats: 4 | 5) => void
}) {
  return (
    <div className="cap-card">
      <span className="tiny-label">{label}</span>
      <input className="ghost-input" value={name} onChange={(event) => onName(event.target.value)} />
      <div className="chips">
        <button className={`chip ${seats === 4 ? 'on' : ''}`} type="button" onClick={() => onSeats(4)}>
          4 места
        </button>
        <button className={`chip ${seats === 5 ? 'on' : ''}`} type="button" onClick={() => onSeats(5)}>
          5 мест
        </button>
      </div>
    </div>
  )
}

function Cabin({
  car,
  title,
  capacity,
  plan,
  people,
  selectedId,
  onSelect,
  onMove,
  onSwap,
}: {
  car: CarId
  title: string
  capacity: 4 | 5
  plan: DayPlan | null
  people: Person[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onMove: (car: CarId) => void
  onSwap: (id: string) => void
}) {
  const crew = plan ? crewOf(plan.seats, car, people) : []
  const selectedHere = crew.some((person) => person.id === selectedId)
  const waiting = Boolean(selectedId) && !selectedHere

  return (
    <div className={`cabin ${waiting ? 'drop' : ''}`}>
      <div className="cabin-head">
        <strong>{title}</strong>
        <span className="meta">
          {crew.length} / {capacity}
        </span>
      </div>
      <div className="crew">
        {crew.map((person) => (
          <button
            key={person.id}
            type="button"
            className={`rider ${person.role === 'passenger' ? '' : 'driver'} ${selectedId === person.id ? 'selected' : ''}`}
            onClick={() => {
              if (selectedId && selectedId !== person.id && person.role === 'passenger') {
                onSwap(person.id)
                return
              }
              if (person.role === 'passenger') {
                onSelect(selectedId === person.id ? null : person.id)
              }
            }}
          >
            <span className="who">{person.name}</span>
            <span className="pos">
              {person.role === 'passenger' ? EXP_LABEL[person.experience] : 'руль'}
              {person.size === 'l' ? ` · ${SIZE_LABEL.l}` : ''}
              {person.keepWithMe ? ' · ко мне' : ''}
            </span>
          </button>
        ))}
        {plan && crew.length < capacity && (
          <button
            type="button"
            className={`rider empty ${waiting ? 'selected' : ''}`}
            onClick={() => onMove(car)}
          >
            <span className="who">{waiting ? 'пересадить сюда' : 'есть место'}</span>
          </button>
        )}
        {!plan && <p className="hint">Пока пусто — нажми «Рассадить».</p>}
      </div>
    </div>
  )
}

function shortCrew(tour: Tour, day: DayPlan, car: CarId): string {
  return crewOf(day.seats, car, tour.people)
    .map((person) => person.name)
    .slice(0, 3)
    .join(', ')
}
