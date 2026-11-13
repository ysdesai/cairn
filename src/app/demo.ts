import { actions } from '../state/store'
import { toast } from '../ui'

/**
 * Leave the demo and bring the person's own data back, with the same confirmation (and the same
 * failure message) wherever the control lives. Resolves true when the demo ended.
 */
export async function exitDemo(): Promise<boolean> {
  try {
    await actions.clearDemo()
    toast({ message: 'Your data is back', detail: 'The demo has ended.', tone: 'success', id: 'demo-exit' })
    return true
  } catch {
    toast({ message: 'That did not work', detail: 'Nothing was changed. Try again.', id: 'demo-exit' })
    return false
  }
}
