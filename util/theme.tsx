import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'

export type CfkumaSkin = 'plain' | 'aurora'

export const CFKUMA_SKIN_STORAGE_KEY = 'cfkuma-skin'

// Replace these two URLs when the owner has final background images.
export const AURORA_BG: Record<'light' | 'dark', string> = {
  light: 'https://rapi.mtcacg.top/ri/h/1347.webp',
  dark: 'https://rapi.mtcacg.top/ri/h/1347.webp',
}

type CfkumaThemeContextValue = {
  skin: CfkumaSkin
  setSkin: (skin: CfkumaSkin) => void
  toggleSkin: () => void
}

const CfkumaThemeContext = createContext<CfkumaThemeContextValue | null>(null)

function isCfkumaSkin(value: string | null): value is CfkumaSkin {
  return value === 'plain' || value === 'aurora'
}

function getInitialSkin(): CfkumaSkin {
  if (typeof window === 'undefined') return 'plain'

  const params = new URLSearchParams(window.location.search)
  const skinParam = params.get('cfkuma-skin')
  if (isCfkumaSkin(skinParam)) return skinParam

  try {
    const savedSkin = window.localStorage.getItem(CFKUMA_SKIN_STORAGE_KEY)
    return isCfkumaSkin(savedSkin) ? savedSkin : 'plain'
  } catch {
    return 'plain'
  }
}

export function CfkumaThemeProvider({ children }: { children: React.ReactNode }) {
  const [skin, setSkinState] = useState<CfkumaSkin>(getInitialSkin)

  const setSkin = (nextSkin: CfkumaSkin) => {
    setSkinState(nextSkin)
  }

  useEffect(() => {
    document.documentElement.dataset.cfkumaSkin = skin
    document.documentElement.style.setProperty('--cfkuma-aurora-bg-light', `url("${AURORA_BG.light}")`)
    document.documentElement.style.setProperty('--cfkuma-aurora-bg-dark', `url("${AURORA_BG.dark}")`)

    try {
      window.localStorage.setItem(CFKUMA_SKIN_STORAGE_KEY, skin)
    } catch {
      // localStorage can be unavailable in restricted browser modes.
    }
  }, [skin])

  const value = useMemo<CfkumaThemeContextValue>(
    () => ({
      skin,
      setSkin,
      toggleSkin: () => setSkinState((currentSkin) => (currentSkin === 'plain' ? 'aurora' : 'plain')),
    }),
    [skin]
  )

  return (
    <CfkumaThemeContext.Provider value={value}>
      <div className="cfkuma-background" aria-hidden />
      <div className="cfkuma-app-shell">{children}</div>
    </CfkumaThemeContext.Provider>
  )
}

export function useCfkumaTheme() {
  const context = useContext(CfkumaThemeContext)
  if (!context) {
    throw new Error('useCfkumaTheme must be used inside CfkumaThemeProvider')
  }
  return context
}
