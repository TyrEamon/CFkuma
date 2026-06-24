import { workerConfig } from '../uptime.config'

export const ADMIN_PASSWORD_ENV = 'ADMIN_PASSWORD_PROTECTION'
export const STATUS_PASSWORD_ENV = 'PASSWORD_PROTECTION'

function readEnv(name: string) {
  const value = process.env[name]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

export function getAdminPasswordProtection() {
  return readEnv(ADMIN_PASSWORD_ENV) ?? workerConfig.adminPasswordProtection
}

export function getStatusPasswordProtection() {
  return readEnv(STATUS_PASSWORD_ENV) ?? workerConfig.passwordProtection
}
