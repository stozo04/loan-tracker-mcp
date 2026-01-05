import { parseISO } from 'date-fns'

export function parseLocalISODate(value: string) {
  return parseISO(value)
}
