import { useState } from 'react'
import { EXP_LABEL, ROLE_LABEL, SIZE_LABEL } from '../labels'
import type { Experience, Person, Role, Size, Tour } from '../types'
import type { Action } from '../state'

const ROLES: Role[] = ['driver1', 'driver2', 'passenger']
const EXPS: Experience[] = ['newbie', 'regular']
const SIZES: Size[] = ['s', 'm', 'l']

interface Props {
  tour: Tour
  dispatch: (action: Action) => void
}

export function Roster({ tour, dispatch }: Props) {
  const [draft, setDraft] = useState('')
  const [groupName, setGroupName] = useState('')

  const add = () => {
    const names = draft
      .split(/[\n,;]+/)
      .map((name) => name.trim())
      .filter(Boolean)
    if (!names.length) return
    dispatch({ type: 'addPeople', names })
    setDraft('')
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Состав</h2>
        <span className="meta">
          {tour.people.length} в списке
        </span>
      </div>

      <div className="adder">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={'Имена — с новой строки или через запятую\nКатя\nДима, Оля'}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) add()
          }}
        />
        <div className="adder-row">
          <button className="btn primary" type="button" onClick={add}>
            Добавить
          </button>
          <span className="hint">⌘/Ctrl + Enter</span>
        </div>
      </div>

      <div className="people">
        {tour.people.map((person) => (
          <PersonCard
            key={person.id}
            person={person}
            tour={tour}
            dispatch={dispatch}
          />
        ))}
      </div>

      <div className="adder-row" style={{ marginTop: 16 }}>
        <input
          className="inline-input"
          value={groupName}
          onChange={(event) => setGroupName(event.target.value)}
          placeholder="Новая группа своих: палатка, двор..."
        />
        <button
          className="btn ghost"
          type="button"
          onClick={() => {
            dispatch({ type: 'addFriendGroup', name: groupName })
            setGroupName('')
          }}
        >
          Группа
        </button>
      </div>
    </section>
  )
}

function PersonCard({
  person,
  tour,
  dispatch,
}: {
  person: Person
  tour: Tour
  dispatch: (action: Action) => void
}) {
  const partners = tour.people.filter((other) => other.id !== person.id)

  return (
    <article className="person">
      <div className="person-top">
        <input
          className="ghost-input"
          value={person.name}
          onChange={(event) =>
            dispatch({ type: 'renamePerson', id: person.id, name: event.target.value })
          }
        />
        <button
          className="btn tiny danger"
          type="button"
          onClick={() => dispatch({ type: 'removePerson', id: person.id })}
        >
          убрать
        </button>
      </div>

      <div className="chips">
        {ROLES.map((role) => (
          <button
            key={role}
            className={`chip ${person.role === role ? 'on' : ''}`}
            type="button"
            onClick={() => dispatch({ type: 'setRole', id: person.id, role })}
          >
            {ROLE_LABEL[role]}
          </button>
        ))}
      </div>
      <div className="chips">
        {EXPS.map((experience) => (
          <button
            key={experience}
            className={`chip moss ${person.experience === experience ? 'on' : ''}`}
            type="button"
            onClick={() => dispatch({ type: 'setExperience', id: person.id, experience })}
          >
            {EXP_LABEL[experience]}
          </button>
        ))}
      </div>
      <div className="chips">
        {SIZES.map((size) => (
          <button
            key={size}
            className={`chip steel ${person.size === size ? 'on' : ''}`}
            type="button"
            onClick={() => dispatch({ type: 'setSize', id: person.id, size })}
          >
            {SIZE_LABEL[size]}
          </button>
        ))}
        {person.role === 'passenger' && (
          <button
            className={`chip ember ${person.keepWithMe ? 'on' : ''}`}
            type="button"
            onClick={() => dispatch({ type: 'toggleKeep', id: person.id })}
          >
            ко мне
          </button>
        )}
      </div>

      {person.role === 'passenger' && (
        <div className="person-tools">
          <label className="field">
            <span className="tiny-label">Пара</span>
            <select
              value={person.partnerId ?? ''}
              onChange={(event) =>
                dispatch({
                  type: 'setPartner',
                  id: person.id,
                  partnerId: event.target.value || null,
                })
              }
            >
              <option value="">не делить не с кем</option>
              {partners.map((other) => (
                <option key={other.id} value={other.id}>
                  {other.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="tiny-label">Свои</span>
            <select
              value={person.friendGroupId ?? ''}
              onChange={(event) =>
                dispatch({
                  type: 'setFriendGroup',
                  id: person.id,
                  groupId: event.target.value || null,
                })
              }
            >
              <option value="">без группы</option>
              {tour.friendGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </article>
  )
}
