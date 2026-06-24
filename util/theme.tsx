import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { AdminAppearance } from '@/util/adminConfig'

export type CfkumaSkin = 'plain' | 'aurora'

export const CFKUMA_SKIN_STORAGE_KEY = 'cfkuma-skin'
export const CFKUMA_SKIN_QUERY_PARAM = 'cfkuma-skin'
export const CFKUMA_BACKGROUND_QUERY_PARAM = 'cfkuma-bg'
export const CFKUMA_BACKGROUND_DIM_QUERY_PARAM = 'cfkuma-bg-dim'
export const CFKUMA_BACKGROUND_BLUR_QUERY_PARAM = 'cfkuma-bg-blur'
export const CFKUMA_SURFACE_OPACITY_QUERY_PARAM = 'cfkuma-surface-opacity'

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

type BackgroundOverride = {
  hasQueryOverride: boolean
  imageUrl?: string
  dim: number
  blur: number
  surfaceOpacity: number
}

const DEFAULT_BACKGROUND_OVERRIDE: BackgroundOverride = {
  hasQueryOverride: false,
  dim: 58,
  blur: 0,
  surfaceOpacity: 74,
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function isSupportedBackgroundUrl(value: string) {
  try {
    const parsed = new URL(value, window.location.origin)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function normalizeBackgroundUrl(value: string | null) {
  if (!value) return undefined

  const trimmed = value.trim()
  if (!trimmed || trimmed.length > 2048) return undefined

  return isSupportedBackgroundUrl(trimmed) ? trimmed : undefined
}

function normalizeNumber(value: string | null, fallback: number, min: number, max: number) {
  if (!value) return fallback

  const parsed = Number(value)
  return Number.isFinite(parsed) ? clamp(parsed, min, max) : fallback
}

function cssUrl(value: string) {
  return `url(${JSON.stringify(value)})`
}

function getInitialBackgroundOverride(): BackgroundOverride {
  if (typeof window === 'undefined') return DEFAULT_BACKGROUND_OVERRIDE

  const params = new URLSearchParams(window.location.search)
  if (!params.has(CFKUMA_BACKGROUND_QUERY_PARAM)) return DEFAULT_BACKGROUND_OVERRIDE
  return {
    hasQueryOverride: true,
    imageUrl: normalizeBackgroundUrl(params.get(CFKUMA_BACKGROUND_QUERY_PARAM)),
    dim: normalizeNumber(params.get(CFKUMA_BACKGROUND_DIM_QUERY_PARAM), 58, 20, 82),
    blur: normalizeNumber(params.get(CFKUMA_BACKGROUND_BLUR_QUERY_PARAM), 0, 0, 10),
    surfaceOpacity: normalizeNumber(params.get(CFKUMA_SURFACE_OPACITY_QUERY_PARAM), 74, 35, 95),
  }
}

function isCfkumaSkin(value: string | null): value is CfkumaSkin {
  return value === 'plain' || value === 'aurora'
}

function getInitialSkin(initialAppearance?: AdminAppearance): CfkumaSkin {
  if (typeof window === 'undefined') return 'plain'

  const params = new URLSearchParams(window.location.search)
  const skinParam = params.get(CFKUMA_SKIN_QUERY_PARAM)
  if (isCfkumaSkin(skinParam)) return skinParam
  if (params.has(CFKUMA_BACKGROUND_QUERY_PARAM)) return 'aurora'

  try {
    const savedSkin = window.localStorage.getItem(CFKUMA_SKIN_STORAGE_KEY)
    return isCfkumaSkin(savedSkin) ? savedSkin : initialAppearance?.backgroundUrl ? 'aurora' : 'plain'
  } catch {
    return initialAppearance?.backgroundUrl ? 'aurora' : 'plain'
  }
}

export function CfkumaThemeProvider({
  children,
  initialAppearance,
}: {
  children: React.ReactNode
  initialAppearance?: AdminAppearance
}) {
  const [skin, setSkinState] = useState<CfkumaSkin>(() => getInitialSkin(initialAppearance))
  const [backgroundOverride] = useState<BackgroundOverride>(getInitialBackgroundOverride)

  const setSkin = (nextSkin: CfkumaSkin) => {
    setSkinState(nextSkin)
  }

  useEffect(() => {
    document.documentElement.dataset.cfkumaSkin = skin
    const backgroundUrl = backgroundOverride.imageUrl ?? initialAppearance?.backgroundUrl ?? AURORA_BG.light
    const dim = (
      backgroundOverride.hasQueryOverride
        ? backgroundOverride.dim
        : initialAppearance?.backgroundDim ?? backgroundOverride.dim
    ) / 100
    const lightStart = clamp(0.22 + dim * 0.86, 0.42, 0.88)
    const lightEnd = clamp(0.18 + dim * 0.78, 0.36, 0.78)
    const darkStart = clamp(0.18 + dim * 0.82, 0.34, 0.84)
    const darkEnd = clamp(0.22 + dim * 0.88, 0.42, 0.9)
    const blur = backgroundOverride.hasQueryOverride
      ? backgroundOverride.blur
      : initialAppearance?.backgroundBlur ?? backgroundOverride.blur
    const surfaceOpacity = (
      backgroundOverride.hasQueryOverride
        ? backgroundOverride.surfaceOpacity
        : initialAppearance?.surfaceOpacity ?? backgroundOverride.surfaceOpacity
    ) / 100

    document.documentElement.style.setProperty('--cfkuma-aurora-bg-light', cssUrl(backgroundUrl))
    document.documentElement.style.setProperty(
      '--cfkuma-aurora-bg-dark',
      cssUrl(backgroundOverride.imageUrl ?? initialAppearance?.backgroundUrl ?? AURORA_BG.dark)
    )
    document.documentElement.style.setProperty('--cfkuma-aurora-light-overlay-start', lightStart.toFixed(2))
    document.documentElement.style.setProperty('--cfkuma-aurora-light-overlay-end', lightEnd.toFixed(2))
    document.documentElement.style.setProperty('--cfkuma-aurora-dark-overlay-start', darkStart.toFixed(2))
    document.documentElement.style.setProperty('--cfkuma-aurora-dark-overlay-end', darkEnd.toFixed(2))
    document.documentElement.style.setProperty('--cfkuma-aurora-bg-blur', `${blur}px`)
    document.documentElement.style.setProperty('--cfkuma-surface-opacity', surfaceOpacity.toFixed(2))

    try {
      window.localStorage.setItem(CFKUMA_SKIN_STORAGE_KEY, skin)
    } catch {
      // localStorage can be unavailable in restricted browser modes.
    }
  }, [backgroundOverride, initialAppearance, skin])

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
