import { uid } from './ids'
import { emptyTour } from './seed'
import type { AppState, DayPlan, Experience, Person, Role, Size, Tour } from './types'

export type Action =
  | { type: 'hydrate'; state: AppState }
  | { type: 'createTour'; name: string }
  | { type: 'selectTour'; id: string }
  | { type: 'renameTour'; name: string }
  | { type: 'deleteTour'; id: string }
  | { type: 'setCarSeats'; car: 1 | 2; seats: 4 | 5 }
  | { type: 'setCarName'; car: 1 | 2; name: string }
  | { type: 'addPeople'; names: string[] }
  | { type: 'renamePerson'; id: string; name: string }
  | { type: 'setRole'; id: string; role: Role }
  | { type: 'setExperience'; id: string; experience: Experience }
  | { type: 'setSize'; id: string; size: Size }
  | { type: 'toggleKeep'; id: string }
  | { type: 'setPartner'; id: string; partnerId: string | null }
  | { type: 'setFriendGroup'; id: string; groupId: string | null }
  | { type: 'addFriendGroup'; name: string }
  | { type: 'removePerson'; id: string }
  | { type: 'setDraft'; plan: DayPlan | null }
  | { type: 'saveDraft' }
  | { type: 'removeHistory'; id: string }

function activeTour(state: AppState): Tour | null {
  return state.tours.find((tour) => tour.id === state.activeTourId) ?? null
}

function updateActive(state: AppState, recipe: (tour: Tour) => Tour): AppState {
  if (!state.activeTourId) return state
  return {
    ...state,
    tours: state.tours.map((tour) => (tour.id === state.activeTourId ? recipe(tour) : tour)),
  }
}

function updatePerson(tour: Tour, id: string, recipe: (person: Person) => Person): Tour {
  return {
    ...tour,
    people: tour.people.map((person) => (person.id === id ? recipe(person) : person)),
    draft: null,
  }
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'hydrate':
      return action.state
    case 'createTour': {
      const tour = emptyTour(action.name.trim() || 'Новый выезд')
      return { tours: [...state.tours, tour], activeTourId: tour.id }
    }
    case 'selectTour':
      return { ...state, activeTourId: action.id }
    case 'renameTour':
      return updateActive(state, (tour) => ({ ...tour, name: action.name }))
    case 'deleteTour': {
      const tours = state.tours.filter((tour) => tour.id !== action.id)
      const activeTourId =
        state.activeTourId === action.id ? (tours[0]?.id ?? null) : state.activeTourId
      return { tours, activeTourId }
    }
    case 'setCarSeats':
      return updateActive(state, (tour) => ({
        ...tour,
        car1Seats: action.car === 1 ? action.seats : tour.car1Seats,
        car2Seats: action.car === 2 ? action.seats : tour.car2Seats,
        draft: null,
      }))
    case 'setCarName':
      return updateActive(state, (tour) => ({
        ...tour,
        car1Name: action.car === 1 ? action.name : tour.car1Name,
        car2Name: action.car === 2 ? action.name : tour.car2Name,
      }))
    case 'addPeople':
      return updateActive(state, (tour) => {
        const existing = new Set(tour.people.map((person) => person.name.trim().toLowerCase()))
        const added: Person[] = []
        for (const raw of action.names) {
          const name = raw.trim()
          if (!name || existing.has(name.toLowerCase())) continue
          existing.add(name.toLowerCase())
          added.push({
            id: uid('p'),
            name,
            role: 'passenger',
            experience: 'regular',
            size: 'm',
            keepWithMe: false,
            partnerId: null,
            friendGroupId: null,
          })
        }
        return { ...tour, people: [...tour.people, ...added], draft: null }
      })
    case 'renamePerson':
      return updateActive(state, (tour) => updatePerson(tour, action.id, (person) => ({
        ...person,
        name: action.name,
      })))
    case 'setRole':
      return updateActive(state, (tour) => {
        const nextRole = action.role
        return {
          ...tour,
          draft: null,
          people: tour.people.map((person) => {
            if (person.id === action.id) return { ...person, role: nextRole }
            if (nextRole !== 'passenger' && person.role === nextRole) {
              return { ...person, role: 'passenger' }
            }
            return person
          }),
        }
      })
    case 'setExperience':
      return updateActive(state, (tour) =>
        updatePerson(tour, action.id, (person) => ({ ...person, experience: action.experience })),
      )
    case 'setSize':
      return updateActive(state, (tour) =>
        updatePerson(tour, action.id, (person) => ({ ...person, size: action.size })),
      )
    case 'toggleKeep':
      return updateActive(state, (tour) =>
        updatePerson(tour, action.id, (person) => ({ ...person, keepWithMe: !person.keepWithMe })),
      )
    case 'setPartner':
      return updateActive(state, (tour) => {
        const id = action.id
        const partnerId = action.partnerId
        return {
          ...tour,
          draft: null,
          people: tour.people.map((person) => {
            if (person.id === id) return { ...person, partnerId }
            if (person.id === partnerId) return { ...person, partnerId: id }
            if (person.partnerId === id || person.partnerId === partnerId) {
              return { ...person, partnerId: null }
            }
            return person
          }),
        }
      })
    case 'setFriendGroup':
      return updateActive(state, (tour) =>
        updatePerson(tour, action.id, (person) => ({ ...person, friendGroupId: action.groupId })),
      )
    case 'addFriendGroup': {
      const name = action.name.trim()
      if (!name) return state
      return updateActive(state, (tour) => ({
        ...tour,
        friendGroups: [...tour.friendGroups, { id: uid('g'), name }],
      }))
    }
    case 'removePerson':
      return updateActive(state, (tour) => ({
        ...tour,
        draft: null,
        people: tour.people
          .filter((person) => person.id !== action.id)
          .map((person) =>
            person.partnerId === action.id ? { ...person, partnerId: null } : person,
          ),
      }))
    case 'setDraft':
      return updateActive(state, (tour) => ({ ...tour, draft: action.plan }))
    case 'saveDraft':
      return updateActive(state, (tour) => {
        if (!tour.draft) return tour
        const rest = tour.history.filter((day) => day.date !== tour.draft!.date)
        return {
          ...tour,
          history: [tour.draft, ...rest].slice(0, 24),
        }
      })
    case 'removeHistory':
      return updateActive(state, (tour) => ({
        ...tour,
        history: tour.history.filter((day) => day.id !== action.id),
      }))
    default:
      return state
  }
}

export function currentTour(state: AppState): Tour | null {
  return activeTour(state)
}
