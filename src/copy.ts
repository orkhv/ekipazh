import { formatDate } from './ids'
import type { CarId, DayPlan, Person, Tour } from './types'

function nameOf(people: Person[], id: string): string {
  return people.find((person) => person.id === id)?.name ?? '—'
}

export function planAsText(tour: Tour, plan: DayPlan): string {
  const lines = [`Экипажи · ${formatDate(plan.date)} · ${tour.name}`, '']

  for (const car of [1, 2] as CarId[]) {
    const title = car === 1 ? tour.car1Name : tour.car2Name
    const rows = plan.seats
      .filter((seat) => seat.car === car)
      .sort((a, b) => {
        const personA = tour.people.find((person) => person.id === a.personId)
        const personB = tour.people.find((person) => person.id === b.personId)
        return Number(personA?.role === 'passenger') - Number(personB?.role === 'passenger')
      })
    lines.push(`${title}`)
    for (const row of rows) {
      const person = tour.people.find((item) => item.id === row.personId)
      const mark = person?.role === 'passenger' ? '' : ' — руль'
      lines.push(`• ${nameOf(tour.people, row.personId)}${mark}`)
    }
    lines.push('')
  }

  if (plan.notes.length) {
    lines.push(plan.notes.join('\n'))
  }

  return lines.join('\n').trim()
}
