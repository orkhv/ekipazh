import { formatDate } from './ids'
import type { CarId, DayPlan, Person, Tour } from './types'

function driverOf(people: Person[], car: CarId): Person | undefined {
  return people.find((person) => person.role === (car === 1 ? 'driver1' : 'driver2'))
}

function carTitle(driverName: string | undefined, fallback: string): string {
  const name = driverName?.trim()
  if (!name) return fallback
  if (/^я$/i.test(name)) return 'Моя машина'

  const last = name.slice(-1).toLowerCase()
  const stem = name.slice(0, -1)
  const stemLast = stem.slice(-1).toLowerCase()

  if (last === 'й' || last === 'ь') return `Машина ${stem}я`
  if (last === 'я') return `Машина ${stem}и`
  if (last === 'а') {
    return `Машина ${stem}${'кгхжчшщ'.includes(stemLast) ? 'и' : 'ы'}`
  }
  return `Машина ${name}а`
}

export function planAsText(tour: Tour, plan: DayPlan): string {
  const lines = [formatDate(plan.date)]

  for (const car of [1, 2] as CarId[]) {
    const driver = driverOf(tour.people, car)
    const fallback = car === 1 ? tour.car1Name : tour.car2Name
    const passengers = plan.seats
      .map((seat) => tour.people.find((person) => person.id === seat.personId && seat.car === car))
      .filter((person): person is Person => person !== undefined && person.role === 'passenger')

    lines.push('', carTitle(driver?.name, fallback))
    for (const person of passengers) {
      lines.push(`• ${person.name}`)
    }
  }

  return lines.join('\n').trim()
}
