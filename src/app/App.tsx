import { MotionConfig } from 'framer-motion'
import { lazy } from 'react'
import { createHashRouter, RouterProvider } from 'react-router-dom'
import { useStatus } from '../state/hooks'
import { ConfirmHost, TipProvider, Toaster } from '../ui'
import { NotFound } from './NotFound'
import { lazyChunk } from './screens'
import { Shell } from './Shell'
import { Splash } from './Splash'

// Each screen is its own chunk: the first paint only pays for the screen being opened.
// They are fetched ahead of time too (see screens.ts), so opening one never waits on the network.
const TodayScreen = lazyChunk('today')
const MapScreen = lazyChunk('map')
const ProblemsScreen = lazyChunk('problems')
const DrillScreen = lazyChunk('drill')
const MockScreen = lazyChunk('mock')
const InsightsScreen = lazyChunk('insights')
const SettingsScreen = lazyChunk('settings')
// The component specimen sheet exists only in development builds.
const Kit = import.meta.env.DEV ? lazy(() => import('./Kit')) : null

// Hash routing: the built app is plain static files and works from any folder on any host.
const router = createHashRouter(
  [
    {
      path: '/',
      element: <Shell />,
      children: [
        { index: true, element: <TodayScreen /> },
        { path: 'map/:topicId?', element: <MapScreen /> },
        { path: 'problems', element: <ProblemsScreen /> },
        { path: 'drill', element: <DrillScreen /> },
        { path: 'mock', element: <MockScreen /> },
        { path: 'insights', element: <InsightsScreen /> },
        { path: 'settings', element: <SettingsScreen /> },
        ...(Kit ? [{ path: 'kit', element: <Kit /> }] : []),
        { path: '*', element: <NotFound /> },
      ],
    },
  ],
  {
    future: {
      v7_relativeSplatPath: true,
      v7_fetcherPersist: true,
      v7_normalizeFormMethod: true,
      v7_partialHydration: true,
      v7_skipActionErrorRevalidation: true,
    },
  },
)

export function App() {
  const status = useStatus()
  return (
    <MotionConfig reducedMotion="user">
      <TipProvider delayDuration={350} skipDelayDuration={150}>
        {status === 'loading' ? <Splash /> : <RouterProvider router={router} future={{ v7_startTransition: true }} />}
        <Toaster />
        <ConfirmHost />
      </TipProvider>
    </MotionConfig>
  )
}
