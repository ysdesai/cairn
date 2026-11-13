import { motion } from 'framer-motion'
import { VOLATILE_STORAGE_MESSAGE, useStore } from '../../state/store'
import { PageHeader, listContainer } from '../../ui'
import { AboutSection } from './AboutSection'
import { AppearanceSection } from './AppearanceSection'
import { DataSection } from './DataSection'
import { DemoSection } from './DemoSection'
import { PlanSection } from './PlanSection'
import { RevisionsSection } from './RevisionsSection'
import { TargetsSection } from './TargetsSection'
import s from './Settings.module.css'

export default function SettingsScreen() {
  const volatile = useStore((state) => state.storageError === VOLATILE_STORAGE_MESSAGE)
  return (
    <div className="page">
      <PageHeader
        sheet="07"
        name="Settings"
        terrain={7}
        meta={volatile ? 'Not being kept' : 'Stored in this browser'}
        title={
          <>
            Set the <em>pace</em>. Keep a <em>copy</em>.
          </>
        }
      />
      <motion.div className={s.sections} variants={listContainer} initial="initial" animate="enter">
        <PlanSection />
        <RevisionsSection />
        <TargetsSection />
        <AppearanceSection />
        <DataSection />
        <DemoSection />
        <AboutSection />
      </motion.div>
    </div>
  )
}
