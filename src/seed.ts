import { uid } from './ids'
import type { AppState, Person, Tour } from './types'

function person(partial: Omit<Person, 'id'>): Person {
  return { ...partial, id: uid('p') }
}

export function emptyTour(name = 'Новый выезд'): Tour {
  const me = person({
    name: 'Я',
    role: 'driver1',
    experience: 'regular',
    size: 'm',
    keepWithMe: false,
    partnerId: null,
    friendGroupId: null,
  })
  const second = person({
    name: 'Водила 2',
    role: 'driver2',
    experience: 'regular',
    size: 'm',
    keepWithMe: false,
    partnerId: null,
    friendGroupId: null,
  })
  return {
    id: uid('tour'),
    name,
    car1Seats: 5,
    car2Seats: 5,
    car1Name: 'Машина 1',
    car2Name: 'Машина 2',
    people: [me, second],
    friendGroups: [],
    history: [],
    draft: null,
  }
}

export function demoTour(): Tour {
  const friends = { id: uid('g'), name: 'палатка' }
  const katya = person({
    name: 'Катя',
    role: 'passenger',
    experience: 'newbie',
    size: 's',
    keepWithMe: true,
    partnerId: null,
    friendGroupId: null,
  })
  const dima = person({
    name: 'Дима',
    role: 'passenger',
    experience: 'regular',
    size: 'l',
    keepWithMe: false,
    partnerId: null,
    friendGroupId: null,
  })
  const olya = person({
    name: 'Оля',
    role: 'passenger',
    experience: 'regular',
    size: 'm',
    keepWithMe: false,
    partnerId: dima.id,
    friendGroupId: null,
  })
  dima.partnerId = olya.id

  const igor = person({
    name: 'Игорь',
    role: 'passenger',
    experience: 'newbie',
    size: 'l',
    keepWithMe: false,
    partnerId: null,
    friendGroupId: friends.id,
  })
  const nika = person({
    name: 'Ника',
    role: 'passenger',
    experience: 'regular',
    size: 'm',
    keepWithMe: false,
    partnerId: null,
    friendGroupId: friends.id,
  })
  const max = person({
    name: 'Макс',
    role: 'passenger',
    experience: 'regular',
    size: 'l',
    keepWithMe: false,
    partnerId: null,
    friendGroupId: null,
  })
  const lena = person({
    name: 'Лена',
    role: 'passenger',
    experience: 'newbie',
    size: 's',
    keepWithMe: false,
    partnerId: null,
    friendGroupId: null,
  })

  return {
    id: uid('tour'),
    name: 'Алтай, сентябрь',
    car1Seats: 5,
    car2Seats: 5,
    car1Name: 'Моя',
    car2Name: 'Вторая',
    people: [
      person({
        name: 'Я',
        role: 'driver1',
        experience: 'regular',
        size: 'm',
        keepWithMe: false,
        partnerId: null,
        friendGroupId: null,
      }),
      person({
        name: 'Серёжа',
        role: 'driver2',
        experience: 'regular',
        size: 'l',
        keepWithMe: false,
        partnerId: null,
        friendGroupId: null,
      }),
      katya,
      dima,
      olya,
      igor,
      nika,
      max,
      lena,
    ],
    friendGroups: [friends],
    history: [],
    draft: null,
  }
}

export function seedState(): AppState {
  const tour = demoTour()
  return { tours: [tour], activeTourId: tour.id }
}
