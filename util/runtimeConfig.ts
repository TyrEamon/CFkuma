import type { Env } from '../worker/src'
import { getFromStore, setToStore } from '../worker/src/store'
import {
  ADMIN_CONFIG_STORE_KEY,
  AdminConfig,
  adminConfigToGroup,
  adminConfigToMonitors,
  createDefaultAdminConfig,
  normalizeAdminConfig,
} from './adminConfig'
import { pageConfig, workerConfig } from '../uptime.config'
import { PageConfig, WorkerConfig } from '../types/config'

const memoryStore = new Map<string, string>()

async function getStoredValue(env: Env | undefined, key: string) {
  if (env?.UPTIMEFLARE_D1 == null) return memoryStore.get(key) ?? null
  return getFromStore(env, key)
}

async function setStoredValue(env: Env | undefined, key: string, value: string) {
  if (env?.UPTIMEFLARE_D1 == null) {
    memoryStore.set(key, value)
    return
  }

  await setToStore(env, key, value)
}

export async function getAdminConfig(env: Env | undefined): Promise<AdminConfig> {
  const storedConfig = await getStoredValue(env, ADMIN_CONFIG_STORE_KEY)
  if (!storedConfig) return createDefaultAdminConfig()

  try {
    return normalizeAdminConfig(JSON.parse(storedConfig))
  } catch {
    return createDefaultAdminConfig()
  }
}

export async function saveAdminConfig(env: Env | undefined, config: unknown): Promise<AdminConfig> {
  const normalizedConfig = normalizeAdminConfig({
    ...(config && typeof config === 'object' ? config : {}),
    updatedAt: new Date().toISOString(),
  })

  await setStoredValue(env, ADMIN_CONFIG_STORE_KEY, JSON.stringify(normalizedConfig))
  return normalizedConfig
}

export async function getRuntimeConfig(env: Env | undefined): Promise<{
  adminConfig: AdminConfig
  pageConfig: PageConfig
  workerConfig: WorkerConfig
}> {
  const adminConfig = await getAdminConfig(env)
  const runtimeMonitors = adminConfigToMonitors(adminConfig)

  return {
    adminConfig,
    pageConfig: {
      ...pageConfig,
      title: adminConfig.appearance.title || pageConfig.title,
      logo: adminConfig.appearance.logoUrl || pageConfig.logo,
      group: adminConfigToGroup(adminConfig),
    },
    workerConfig: {
      ...workerConfig,
      monitors: runtimeMonitors,
    },
  }
}
