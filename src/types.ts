export type Role = 'driver1' | 'driver2' | 'passenger'
export type Experience = 'newbie' | 'regular'
export type Size = 's' | 'm' | 'l'
export type CarId = 1 | 2
export type Capacity = 4 | 5

export interface Person {
  id: string
  name: string
  role: Role
  experience: Experience
  size: Size
  keepWithMe: boolean
  partnerId: string | null
  friendGroupId: string | null
}

export interface FriendGroup {
  id: string
  name: string
}

export interface SeatAssignment {
  personId: string
  car: CarId
}

export interface DayPlan {
  id: string
  date: string
  seats: SeatAssignment[]
  notes: string[]
  score: number
}

export interface Tour {
  id: string
  name: string
  car1Seats: Capacity
  car2Seats: Capacity
  car1Name: string
  car2Name: string
  people: Person[]
  friendGroups: FriendGroup[]
  history: DayPlan[]
  draft: DayPlan | null
}

export interface AppState {
  tours: Tour[]
  activeTourId: string | null
}

export interface SeatResult {
  ok: true
  seats: SeatAssignment[]
  notes: string[]
  score: number
}

export interface SeatError {
  ok: false
  error: string
}

export type SeatOutcome = SeatResult | SeatError
