import { shuffle, weightedPick, type Rng } from './rng'
import type { CarId, Capacity, DayPlan, Person, SeatAssignment, SeatOutcome, Tour } from './types'

function riders(tour: Tour): Person[] {
  return tour.people
}

function byId(people: Person[]): Map<string, Person> {
  return new Map(people.map((person) => [person.id, person]))
}

function carOf(seats: SeatAssignment[], personId: string): CarId | null {
  return seats.find((seat) => seat.personId === personId)?.car ?? null
}

function recentDays(history: DayPlan[], limit = 4): DayPlan[] {
  return [...history].sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit)
}

function timesInCar(history: DayPlan[], personId: string, car: CarId): number {
  return recentDays(history).filter((day) => carOf(day.seats, personId) === car).length
}

function sameCarYesterday(history: DayPlan[], personId: string, car: CarId): boolean {
  const last = recentDays(history, 1)[0]
  return last ? carOf(last.seats, personId) === car : false
}

function couplePairs(people: Person[]): [Person, Person][] {
  const seen = new Set<string>()
  const pairs: [Person, Person][] = []
  const map = byId(people)

  for (const person of people) {
    if (!person.partnerId || seen.has(person.id)) continue
    const partner = map.get(person.partnerId)
    if (!partner) continue
    if (partner.partnerId !== person.id) continue
    if (person.role !== 'passenger' && partner.role !== 'passenger') continue
    seen.add(person.id)
    seen.add(partner.id)
    pairs.push([person, partner])
  }
  return pairs
}

function friendClusters(people: Person[]): Person[][] {
  const groups = new Map<string, Person[]>()
  for (const person of people) {
    if (!person.friendGroupId || person.role !== 'passenger') continue
    const list = groups.get(person.friendGroupId) ?? []
    list.push(person)
    groups.set(person.friendGroupId, list)
  }
  return [...groups.values()].filter((group) => group.length >= 2)
}

function driverOf(people: Person[], role: 'driver1' | 'driver2'): Person | undefined {
  return people.find((person) => person.role === role)
}

function carCapacity(tour: Tour, car: CarId): Capacity {
  return car === 1 ? tour.car1Seats : tour.car2Seats
}

function passengerSlots(tour: Tour, car: CarId): number {
  return carCapacity(tour, car) - 1
}

function wantsLead(person: Person): boolean {
  return person.keepWithMe || person.experience === 'newbie'
}

function leadPull(person: Person, history: DayPlan[]): number {
  let score = 0
  if (person.keepWithMe) score += 12
  if (person.experience === 'newbie') score += 10
  const recentLead = timesInCar(history, person.id, 1)
  if (wantsLead(person) && recentLead >= 3) score -= 5
  if (sameCarYesterday(history, person.id, 1)) score -= 3
  return score
}

function largeCount(people: Person[]): number {
  return people.filter((person) => person.size === 'l').length
}

function assignCars(
  tour: Tour,
  people: Person[],
  rng: Rng,
): { cars: Map<string, CarId>; error?: string } {
  const cars = new Map<string, CarId>()
  const left = { 1: passengerSlots(tour, 1), 2: passengerSlots(tour, 2) }
  const history = tour.history
  const driver1 = driverOf(people, 'driver1')
  const driver2 = driverOf(people, 'driver2')

  if (!driver1) return { cars, error: 'Нужен водила 1 — это ты, отметь себя в составе.' }
  if (!driver2) return { cars, error: 'Нужен водила 2, иначе вторую машину вести некому.' }

  cars.set(driver1.id, 1)
  cars.set(driver2.id, 2)

  const passengers = people.filter((person) => person.role === 'passenger')
  if (passengers.length > left[1] + left[2]) {
    return {
      cars,
      error: `Людей больше, чем мест: ${passengers.length} ездоков и только ${left[1] + left[2]} пассажирских мест.`,
    }
  }

  const placed = new Set<string>([driver1.id, driver2.id])

  const canFit = (car: CarId, count: number) => left[car] >= count

  const put = (person: Person, car: CarId) => {
    cars.set(person.id, car)
    placed.add(person.id)
    if (person.role === 'passenger') left[car] -= 1
  }

  const waitingLead = () =>
    people.filter(
      (person) => person.role === 'passenger' && !placed.has(person.id) && wantsLead(person),
    ).length

  const scoreCar = (group: Person[], car: CarId): number => {
    const need = group.filter((person) => !placed.has(person.id) && person.role === 'passenger').length
    if (!canFit(car, need)) return -Infinity
    let score = rng() * 2
    const already = people.filter((person) => cars.get(person.id) === car)
    const incomingLarge =
      largeCount(group) + largeCount(already.filter((person) => person.role === 'passenger'))
    if (incomingLarge >= 3) score -= 10
    if (incomingLarge === 2) score -= 2
    if (incomingLarge <= 1) score += 4

    const leftoverLead =
      waitingLead() - group.filter((person) => !placed.has(person.id) && wantsLead(person)).length
    if (car === 1 && leftoverLead > left[1] - need) {
      score -= (leftoverLead - (left[1] - need)) * 16
    }

    for (const person of group) {
      const pull = leadPull(person, history)
      score += car === 1 ? pull : -pull * 0.7
      if (sameCarYesterday(history, person.id, car)) score -= 4
      if (person.friendGroupId) {
        const mates = already.filter((other) => other.friendGroupId === person.friendGroupId).length
        score += mates * 5
      }
    }
    return score
  }

  const placeGroup = (group: Person[], forced: CarId | null, error: string): string | undefined => {
    const pending = group.filter((person) => person.role === 'passenger' && !placed.has(person.id))
    if (pending.length === 0) return
    const options = ([1, 2] as CarId[]).filter(
      (car) => canFit(car, pending.length) && (!forced || car === forced),
    )
    if (options.length === 0) return error
    const car = weightedPick(options, (option) => scoreCar(pending, option), rng, 0.45)
    for (const person of pending) put(person, car)
  }

  for (const [a, b] of shuffle(couplePairs(people), rng)) {
    const driving = [a, b].find((person) => person.role === 'driver1' || person.role === 'driver2')
    const forced: CarId | null = driving ? (driving.role === 'driver1' ? 1 : 2) : null
    const fail = placeGroup([a, b], forced, `Пару «${a.name} и ${b.name}» некуда посадить вместе.`)
    if (fail) return { cars, error: fail }
  }

  const leadFirst = shuffle(
    people.filter(
      (person) => person.role === 'passenger' && !placed.has(person.id) && wantsLead(person),
    ),
    rng,
  )
  for (const person of leadFirst) {
    const fail = placeGroup([person], null, `Не хватает места для ${person.name}.`)
    if (fail) return { cars, error: fail }
  }

  for (const cluster of shuffle(friendClusters(people), rng)) {
    const pending = cluster.filter((person) => !placed.has(person.id) && person.role === 'passenger')
    if (pending.length === 0) continue

    const alreadyCar = cluster
      .map((person) => cars.get(person.id))
      .find((car): car is CarId => car !== undefined)

    const tryTogether = alreadyCar
      ? canFit(alreadyCar, pending.length)
        ? [alreadyCar]
        : []
      : ([1, 2] as CarId[]).filter((car) => canFit(car, pending.length))

    if (tryTogether.length > 0) {
      const car = weightedPick(tryTogether, (option) => scoreCar(pending, option), rng, 0.5)
      for (const person of pending) put(person, car)
      continue
    }

    for (const person of shuffle(pending, rng)) {
      const options = ([1, 2] as CarId[]).filter((car) => canFit(car, 1))
      if (options.length === 0) {
        return { cars, error: `Не хватает места для ${person.name}.` }
      }
      const car = weightedPick(options, (option) => scoreCar([person], option), rng, 0.45)
      put(person, car)
    }
  }

  const leftover = shuffle(
    passengers.filter((person) => !placed.has(person.id)),
    rng,
  )
  for (const person of leftover) {
    const options = ([1, 2] as CarId[]).filter((car) => canFit(car, 1))
    if (options.length === 0) {
      return { cars, error: `Не хватает места для ${person.name}.` }
    }
    const car = weightedPick(options, (option) => scoreCar([person], option), rng, 0.4)
    put(person, car)
  }

  return { cars }
}

function scoreAssignment(
  seats: SeatAssignment[],
  people: Person[],
  history: DayPlan[],
  avoid?: SeatAssignment[],
): number {
  let score = 0

  for (const [a, b] of couplePairs(people)) {
    const carA = carOf(seats, a.id)
    const carB = carOf(seats, b.id)
    if (carA && carB && carA !== carB) score -= 80
    else score += 18
  }

  for (const cluster of friendClusters(people)) {
    const cars = new Set(cluster.map((person) => carOf(seats, person.id)).filter(Boolean))
    if (cars.size === 1) score += 12 + cluster.length
    else score -= 6 * (cars.size - 1)
  }

  for (const person of people) {
    if (person.role !== 'passenger') continue
    const car = carOf(seats, person.id)
    if (!car) continue
    if (wantsLead(person)) {
      score += car === 1 ? 22 : -16
      if (person.keepWithMe && car === 1) score += 10
      if (person.experience === 'newbie' && car === 1) score += 6
    }
    if (sameCarYesterday(history, person.id, car)) score -= 7
    score -= timesInCar(history, person.id, car) * 2
  }

  const leadNewbies = people.filter(
    (person) =>
      person.experience === 'newbie' &&
      person.role === 'passenger' &&
      carOf(seats, person.id) === 1,
  ).length
  const allNewbies = people.filter(
    (person) => person.experience === 'newbie' && person.role === 'passenger',
  ).length
  if (allNewbies > 0) score += leadNewbies * 3

  const large1 = largeCount(people.filter((person) => carOf(seats, person.id) === 1))
  const large2 = largeCount(people.filter((person) => carOf(seats, person.id) === 2))
  score -= Math.abs(large1 - large2) * 5

  if (avoid) {
    const sameCar = people.filter((person) => carOf(seats, person.id) === carOf(avoid, person.id)).length
    score -= sameCar * 6
  }

  return score
}

function explain(tour: Tour, seats: SeatAssignment[], people: Person[]): string[] {
  const notes: string[] = []

  for (const [a, b] of couplePairs(people)) {
    const car = carOf(seats, a.id)
    if (car && car === carOf(seats, b.id)) {
      notes.push(`Пара ${a.name} и ${b.name} едут вместе в машине ${car}.`)
    }
  }

  for (const cluster of friendClusters(people)) {
    const groupName =
      tour.friendGroups.find((group) => group.id === cluster[0]?.friendGroupId)?.name ?? 'свои'
    const cars = new Set(cluster.map((person) => carOf(seats, person.id)))
    const names = cluster.map((person) => person.name).join(', ')
    if (cars.size === 1) {
      notes.push(`Группа «${groupName}» (${names}) в одной машине.`)
    } else {
      notes.push(`Группу «${groupName}» пришлось слегка развести — иначе не сходились места.`)
    }
  }

  const newbies = people.filter((person) => person.experience === 'newbie' && person.role === 'passenger')
  const withLead = newbies.filter((person) => carOf(seats, person.id) === 1)
  if (withLead.length) {
    notes.push(
      `Новички ${withLead.map((person) => person.name).join(', ')} ближе к тебе — так спокойнее в первые выезды.`,
    )
  }
  const flagged = people.filter(
    (person) => person.keepWithMe && person.role === 'passenger' && carOf(seats, person.id) === 1,
  )
  if (flagged.length) {
    notes.push(`Флаг «ко мне»: ${flagged.map((person) => person.name).join(', ')}.`)
  }

  const large = people.filter((person) => person.size === 'l' && person.role === 'passenger')
  if (large.length >= 2) {
    const in1 = large.filter((person) => carOf(seats, person.id) === 1).map((person) => person.name)
    const in2 = large.filter((person) => carOf(seats, person.id) === 2).map((person) => person.name)
    if (in1.length && in2.length) {
      notes.push(`Крупных развели: ${in1.join(', ')} и ${in2.join(', ')}. Кто куда сядет внутри — уже сами.`)
    }
  }

  const moved = people.filter((person) => {
    const last = recentDays(tour.history, 1)[0]
    if (!last) return false
    const prev = carOf(last.seats, person.id)
    const now = carOf(seats, person.id)
    return prev && now && prev !== now
  })
  if (moved.length >= 2) {
    notes.push('Состав машин сегодня другой, чтобы не кататься одними и теми же экипажами.')
  }

  return notes.slice(0, 6)
}

export function seatTour(tour: Tour, rng: Rng, avoid?: SeatAssignment[]): SeatOutcome {
  const people = riders(tour)
  const attempts = 280
  let best: { seats: SeatAssignment[]; score: number } | null = null
  let lastError = 'Не удалось собрать рассадку.'

  for (let i = 0; i < attempts; i += 1) {
    const placed = assignCars(tour, people, rng)
    if (placed.error) {
      lastError = placed.error
      continue
    }
    const seats: SeatAssignment[] = people
      .filter((person) => placed.cars.has(person.id))
      .map((person) => ({ personId: person.id, car: placed.cars.get(person.id)! }))
    const score = scoreAssignment(seats, people, tour.history, avoid)
    if (!best || score > best.score) best = { seats, score }
  }

  if (!best) return { ok: false, error: lastError }

  return {
    ok: true,
    seats: best.seats,
    notes: explain(tour, best.seats, people),
    score: best.score,
  }
}

export function planFromSeats(
  id: string,
  date: string,
  seats: SeatAssignment[],
  notes: string[],
  score: number,
): DayPlan {
  return { id, date, seats, notes, score }
}

export function occupancy(tour: Tour): { riding: number; seats: number } {
  return {
    riding: riders(tour).length,
    seats: tour.car1Seats + tour.car2Seats,
  }
}

export function crewOf(seats: SeatAssignment[], car: CarId, people: Person[]): Person[] {
  const map = byId(people)
  return seats
    .filter((row) => row.car === car)
    .map((row) => map.get(row.personId))
    .filter((person): person is Person => Boolean(person))
    .sort((a, b) => Number(a.role === 'passenger') - Number(b.role === 'passenger'))
}

export function moveToCar(
  seats: SeatAssignment[],
  personId: string,
  targetCar: CarId,
  people: Person[],
  tour: Tour,
): SeatAssignment[] | null {
  const person = people.find((row) => row.id === personId)
  const current = seats.find((row) => row.personId === personId)
  if (!person || !current || person.role !== 'passenger') return null
  if (current.car === targetCar) return seats
  const taken = seats.filter((row) => row.car === targetCar).length
  if (taken >= carCapacity(tour, targetCar)) return null
  return seats.map((row) => (row.personId === personId ? { personId, car: targetCar } : row))
}

export function swapCars(
  seats: SeatAssignment[],
  firstId: string,
  secondId: string,
  people: Person[],
): SeatAssignment[] | null {
  const first = people.find((row) => row.id === firstId)
  const second = people.find((row) => row.id === secondId)
  const a = seats.find((row) => row.personId === firstId)
  const b = seats.find((row) => row.personId === secondId)
  if (!first || !second || !a || !b) return null
  if (first.role !== 'passenger' || second.role !== 'passenger') return null
  if (a.car === b.car) return seats
  return seats.map((row) => {
    if (row.personId === firstId) return { personId: firstId, car: b.car }
    if (row.personId === secondId) return { personId: secondId, car: a.car }
    return row
  })
}
