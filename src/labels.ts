import type { Experience, Role, Size } from './types'

export const ROLE_LABEL: Record<Role, string> = {
  driver1: 'водила 1',
  driver2: 'водила 2',
  passenger: 'ездок',
}

export const EXP_LABEL: Record<Experience, string> = {
  newbie: 'новичок',
  regular: 'бывалый',
}

export const SIZE_LABEL: Record<Size, string> = {
  s: 'компакт',
  m: 'обычный',
  l: 'крупный',
}

export const GROUP_LETTERS = ['А', 'Б', 'В', 'Г', 'Д', 'Е']
