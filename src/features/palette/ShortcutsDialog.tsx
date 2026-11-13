import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { Fragment } from 'react'
import { SHORTCUTS } from '../../app/shortcuts'
import { useUi } from '../../app/ui'
import { Button, cx, Kbd, keyLabels, Modal } from '../../ui'
import s from './ShortcutsDialog.module.css'

/** What a screen reader hears for a shortcut, since the keycaps are decorative. */
function spoken(keys: string): string {
  if (keys === '+') return 'plus'
  if (keys === '-') return 'minus'
  const sequence = keys.includes(' ') && !keys.includes('+')
  return keyLabels(keys).join(sequence ? ' then ' : ' ')
}

/** The legend page: every shortcut in the app, grouped the way the screens use them. */
export default function ShortcutsDialog() {
  const open = useUi((u) => u.shortcutsOpen)
  const setOpen = useUi((u) => u.setShortcutsOpen)
  const count = SHORTCUTS.reduce((n, group) => n + group.items.length, 0)

  return (
    <Modal open={open} onOpenChange={setOpen} title="Keyboard shortcuts" width={720} bare>
      <header className={s.head}>
        <div className={s.headMain}>
          <span className="eyebrow">Legend</span>
          <p className="title">
            Keys of the <em>atlas</em>
          </p>
          <p className={s.lede}>Every shortcut, grouped by where it works. Nothing fires while you are typing in a field.</p>
        </div>
        <span className={cx('eyebrow', s.tally)}>
          <span className="num">{count}</span> keys · <span className="num">{SHORTCUTS.length}</span> sheets
        </span>
        <Dialog.Close asChild>
          <Button variant="ghost" size="sm" iconOnly icon={<X />} aria-label="Close" className={s.close} />
        </Dialog.Close>
      </header>
      <div className={s.scale} aria-hidden="true" />

      <div className={s.columns}>
        {SHORTCUTS.map((group, index) => (
          <section key={group.title} className={s.group} aria-labelledby={`keys-${index}`}>
            <div className={s.groupHead}>
              <h3 id={`keys-${index}`} className={cx('eyebrow', s.groupTitle)}>
                {group.title}
              </h3>
              <p className={s.where}>{group.where}</p>
            </div>
            <ul className={s.items}>
              {group.items.map((item) => (
                <li key={`${item.keys}:${item.label}`} className={s.item}>
                  <span className={s.label}>{item.label}</span>
                  <span className="sr-only">{item.keys.split(' / ').map(spoken).join(' or ')}</span>
                  <span className={s.keys} aria-hidden="true">
                    {item.keys.split(' / ').map((alt, i) => (
                      <Fragment key={alt}>
                        {i > 0 ? <span className={s.or}>or</span> : null}
                        <Kbd keys={alt} />
                      </Fragment>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Modal>
  )
}
