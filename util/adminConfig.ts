import { pageConfig, workerConfig } from '../uptime.config'
import { MonitorCategory, MonitorTarget } from '../types/config'

export const ADMIN_CONFIG_STORE_KEY = 'admin-config'

export type AdminMonitorCategory = MonitorCategory
export type AdminMonitorMethod = 'GET' | 'POST' | 'HEAD' | 'TCP_PING'

export type AdminMonitor = {
  id: string
  name: string
  category: AdminMonitorCategory
  method: AdminMonitorMethod
  target: string
  expectedCodes: string
  timeout: number
  group: string
  icon: string
  enabled: boolean
}

export type AdminAppearance = {
  title: string
  logoUrl: string
  backgroundUrl: string
  backgroundDim: number
  backgroundBlur: number
}

export type AdminConfig = {
  version: 1
  appearance: AdminAppearance
  monitors: AdminMonitor[]
  updatedAt?: string
}

const DEFAULT_BACKGROUND_URL = 'https://rapi.mtcacg.top/ri/h/1347.webp'
const LEGACY_DEFAULT_TITLES = new Set(["lyc8503's Status Page", 'CFkuma Status'])
const LEGACY_DEFAULT_LOGOS = new Set(['/logo.svg'])

function monitorToAdminMonitor(monitor: MonitorTarget, group = '项目'): AdminMonitor {
  return {
    id: monitor.id,
    name: monitor.name,
    category: monitor.category ?? 'website',
    method: monitor.method === 'TCP_PING' ? 'TCP_PING' : ((monitor.method || 'GET').toUpperCase() as AdminMonitorMethod),
    target: monitor.target,
    expectedCodes: monitor.expectedCodes?.join(',') ?? '200',
    timeout: monitor.timeout ?? 10000,
    group,
    icon: monitor.icon ?? 'world',
    enabled: true,
  }
}

function getStaticGroupForMonitor(monitorId: string) {
  const groups = pageConfig.group ?? {}
  return Object.keys(groups).find((groupName) => groups[groupName].includes(monitorId)) ?? '项目'
}

export function createDefaultAdminConfig(): AdminConfig {
  return {
    version: 1,
    appearance: {
      title: pageConfig.title ?? 'CFkuma Status',
      logoUrl: pageConfig.logo ?? '/logo.svg',
      backgroundUrl: DEFAULT_BACKGROUND_URL,
      backgroundDim: 58,
      backgroundBlur: 0,
    },
    monitors: workerConfig.monitors.map((monitor) => monitorToAdminMonitor(monitor, getStaticGroupForMonitor(monitor.id))),
  }
}

function normalizeId(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80)
}

function normalizeText(value: unknown, fallback = '') {
  const text = String(value ?? '').trim()
  return text || fallback
}

function normalizeCategory(value: unknown): AdminMonitorCategory {
  return ['website', 'api', 'container', 'proxy', 'domain'].includes(String(value))
    ? (value as AdminMonitorCategory)
    : 'website'
}

function normalizeMethod(value: unknown): AdminMonitorMethod {
  const method = String(value ?? 'GET').toUpperCase()
  return ['GET', 'POST', 'HEAD', 'TCP_PING'].includes(method) ? (method as AdminMonitorMethod) : 'GET'
}

function normalizeExpectedCodes(value: unknown) {
  return String(value ?? '')
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((code) => Number.isInteger(code) && code >= 100 && code <= 599)
}

function normalizeNumber(value: unknown, fallback: number, min: number, max: number) {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) return fallback
  return Math.min(Math.max(Math.round(numberValue), min), max)
}

function normalizeMonitor(value: any): AdminMonitor | null {
  const id = normalizeId(value?.id || value?.name)
  const name = normalizeText(value?.name)
  const target = normalizeText(value?.target)
  if (!id || !name || !target) return null

  const method = normalizeMethod(value?.method)
  return {
    id,
    name,
    category: normalizeCategory(value?.category),
    method,
    target,
    expectedCodes: method === 'TCP_PING' ? '' : normalizeExpectedCodes(value?.expectedCodes).join(','),
    timeout: normalizeNumber(value?.timeout, method === 'TCP_PING' ? 5000 : 10000, 1000, 60000),
    group: normalizeText(value?.group, '未分组'),
    icon: normalizeText(value?.icon, 'world'),
    enabled: value?.enabled !== false,
  }
}

function normalizeUrlLike(value: unknown, fallback: string) {
  const text = normalizeText(value, fallback)
  if (text.startsWith('/') || text.startsWith('http://') || text.startsWith('https://')) return text
  return fallback
}

function normalizeAppearanceTitle(value: unknown, fallback: string) {
  const title = normalizeText(value, fallback)
  return LEGACY_DEFAULT_TITLES.has(title) ? fallback : title
}

function normalizeAppearanceLogo(value: unknown, fallback: string) {
  const logo = normalizeUrlLike(value, fallback)
  return LEGACY_DEFAULT_LOGOS.has(logo) ? fallback : logo
}

export function normalizeAdminConfig(value: unknown): AdminConfig {
  const fallback = createDefaultAdminConfig()
  const raw = (value && typeof value === 'object' ? value : {}) as any
  const appearance = raw.appearance ?? {}
  const monitors = Array.isArray(raw.monitors)
    ? (raw.monitors as unknown[])
        .map(normalizeMonitor)
        .filter((monitor: AdminMonitor | null): monitor is AdminMonitor => monitor !== null)
    : fallback.monitors
  const uniqueMonitors = monitors.filter(
    (monitor, index, list) => list.findIndex((item) => item.id === monitor.id) === index
  )

  return {
    version: 1,
    appearance: {
      title: normalizeAppearanceTitle(appearance.title, fallback.appearance.title),
      logoUrl: normalizeAppearanceLogo(appearance.logoUrl, fallback.appearance.logoUrl),
      backgroundUrl: normalizeUrlLike(appearance.backgroundUrl, fallback.appearance.backgroundUrl),
      backgroundDim: normalizeNumber(appearance.backgroundDim, fallback.appearance.backgroundDim, 20, 82),
      backgroundBlur: normalizeNumber(appearance.backgroundBlur, fallback.appearance.backgroundBlur, 0, 10),
    },
    monitors: uniqueMonitors,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : undefined,
  }
}

export function adminMonitorToMonitorTarget(monitor: AdminMonitor): MonitorTarget | null {
  if (!monitor.enabled) return null

  const target: MonitorTarget = {
    id: monitor.id,
    name: monitor.name,
    method: monitor.method,
    target: monitor.target,
    category: monitor.category,
    icon: monitor.icon,
    timeout: monitor.timeout,
  }

  const expectedCodes = normalizeExpectedCodes(monitor.expectedCodes)
  if (monitor.method !== 'TCP_PING' && expectedCodes.length > 0) target.expectedCodes = expectedCodes

  return target
}

export function adminConfigToMonitors(config: AdminConfig) {
  return config.monitors
    .map(adminMonitorToMonitorTarget)
    .filter((monitor): monitor is MonitorTarget => monitor !== null)
}

export function adminConfigToGroup(config: AdminConfig) {
  return config.monitors.reduce<Record<string, string[]>>((groups, monitor) => {
    if (!monitor.enabled) return groups
    const group = monitor.group || '未分组'
    groups[group] ??= []
    groups[group].push(monitor.id)
    return groups
  }, {})
}
