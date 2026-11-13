/** Transient interface state shared across the shell: which global overlays are open. */
import { create } from 'zustand'

interface UiState {
  paletteOpen: boolean
  shortcutsOpen: boolean
  setPaletteOpen: (open: boolean) => void
  setShortcutsOpen: (open: boolean) => void
}

export const useUi = create<UiState>((set) => ({
  paletteOpen: false,
  shortcutsOpen: false,
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
}))

export const openPalette = () => useUi.getState().setPaletteOpen(true)
export const openShortcuts = () => useUi.getState().setShortcutsOpen(true)
