import { MonitorCategory, MonitorTarget } from '@/types/config'
import { ThemeIcon, rem } from '@mantine/core'
import {
  IconActivity,
  IconApi,
  IconBox,
  IconBrandGithub,
  IconCloud,
  IconCode,
  IconDatabase,
  IconDeviceDesktop,
  IconLink,
  IconNetwork,
  IconPhoto,
  IconRss,
  IconServer,
  IconShield,
  IconWorld,
  IconWorldWww,
} from '@tabler/icons-react'
import type { ComponentType, CSSProperties } from 'react'

type IconComponent = ComponentType<{ style?: CSSProperties; stroke?: number }>

type MonitorIconDefinition = {
  icon: IconComponent
  color: string
}

const iconRegistry: Record<string, IconComponent> = {
  activity: IconActivity,
  api: IconApi,
  box: IconBox,
  cloud: IconCloud,
  code: IconCode,
  database: IconDatabase,
  'device-desktop': IconDeviceDesktop,
  github: IconBrandGithub,
  'brand-github': IconBrandGithub,
  link: IconLink,
  network: IconNetwork,
  photo: IconPhoto,
  rss: IconRss,
  server: IconServer,
  shield: IconShield,
  world: IconWorld,
  'world-www': IconWorldWww,
}

const categoryDefaults: Record<MonitorCategory, MonitorIconDefinition> = {
  website: { icon: IconWorld, color: 'blue' },
  api: { icon: IconApi, color: 'teal' },
  container: { icon: IconBox, color: 'violet' },
  proxy: { icon: IconShield, color: 'indigo' },
  domain: { icon: IconWorldWww, color: 'cyan' },
}

const fallbackIcon: MonitorIconDefinition = { icon: IconActivity, color: 'gray' }

function resolveMonitorIcon(monitor: Pick<MonitorTarget, 'icon' | 'category'>): MonitorIconDefinition {
  const namedIcon = monitor.icon ? iconRegistry[monitor.icon] : undefined
  if (namedIcon) {
    return {
      icon: namedIcon,
      color: monitor.category ? categoryDefaults[monitor.category].color : fallbackIcon.color,
    }
  }

  if (monitor.category) return categoryDefaults[monitor.category]

  return fallbackIcon
}

export default function MonitorIcon({ monitor }: { monitor: Pick<MonitorTarget, 'icon' | 'category'> }) {
  const { icon: Icon, color } = resolveMonitorIcon(monitor)

  return (
    <ThemeIcon
      aria-hidden
      className="cfkuma-monitor-icon"
      color={color}
      variant="light"
      radius="md"
      size="md"
      style={{ flex: '0 0 auto' }}
    >
      <Icon style={{ width: rem(17), height: rem(17) }} stroke={1.9} />
    </ThemeIcon>
  )
}
