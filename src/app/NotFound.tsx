import { Link } from 'react-router-dom'
import { CompassGlyph, Empty } from '../ui'
import button from '../ui/Button.module.css'
import { ROUTES } from './nav'

export function NotFound() {
  return (
    <div className="page">
      <Empty
        seed={404}
        icon={<CompassGlyph size={56} />}
        title="Off the map"
        body="There is nothing at this address. The trail picks up again from today's route."
        action={
          <Link to={ROUTES.today} className={`${button.btn} ${button.primary} ${button.md}`}>
            Back to Today
          </Link>
        }
      />
    </div>
  )
}
