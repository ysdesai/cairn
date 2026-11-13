import { useCallback, useRef, useState } from 'react'
import type { ISODate, MistakeTag, Rating } from '../../state/schema'
import { checkDate, checkMinutes } from './logic'

export interface LogFormState {
  rating: Rating | null
  minutes: string
  /** The minutes were filled in from the timer and not yet touched. */
  fromTimer: boolean
  date: ISODate
  mistakes: MistakeTag[]
  /** Pick a rating. `suggestedMinutes` fills the minutes the first time, if the person has not typed any. */
  choose: (rating: Rating, suggestedMinutes: number | null) => void
  setMinutes: (minutes: string) => void
  /** Write what will be saved back into the field (called on blur). */
  settleMinutes: () => void
  /** Why the typed minutes will be saved differently, or null. */
  minutesNote: string | null
  /** Keeps a typed date to today or earlier. Returns the date to show in the field. */
  setDate: (date: ISODate) => ISODate
  /** Why the typed date was changed, or null. */
  dateNote: string | null
  toggleMistake: (tag: MistakeTag) => void
  reset: () => void
}

/** The draft of one log entry: the rating, then the details that appear once a rating is chosen. */
export function useLogForm(today: ISODate): LogFormState {
  const [rating, setRating] = useState<Rating | null>(null)
  const [minutes, setMinutesState] = useState('')
  const [fromTimer, setFromTimer] = useState(false)
  const [date, setDateState] = useState<ISODate>(today)
  const [pulledBack, setPulledBack] = useState<string | null>(null)
  const [mistakes, setMistakes] = useState<MistakeTag[]>([])
  // Once minutes have been typed (or cleared on purpose) the timer stops suggesting a value.
  const edited = useRef(false)

  const choose = useCallback((next: Rating, suggested: number | null) => {
    setRating(next)
    if (!edited.current && suggested !== null) {
      setMinutesState(String(suggested))
      setFromTimer(true)
    }
  }, [])

  const setMinutes = useCallback((value: string) => {
    edited.current = true
    setFromTimer(false)
    setMinutesState(value)
  }, [])

  const settleMinutes = useCallback(() => setMinutesState((current) => checkMinutes(current).text), [])

  const setDate = useCallback(
    (value: ISODate): ISODate => {
      const checked = checkDate(value, today)
      setDateState(checked.date)
      setPulledBack(checked.date !== value ? checked.note : null)
      return checked.date
    },
    [today],
  )

  const toggleMistake = useCallback((tag: MistakeTag) => {
    setMistakes((current) => (current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag]))
  }, [])

  const reset = useCallback(() => {
    edited.current = false
    setRating(null)
    setMinutesState('')
    setFromTimer(false)
    setDateState(today)
    setPulledBack(null)
    setMistakes([])
  }, [today])

  const minutesNote = checkMinutes(minutes).note
  return { rating, minutes, fromTimer, date, mistakes, choose, setMinutes, settleMinutes, minutesNote, setDate, dateNote: pulledBack, toggleMistake, reset }
}
