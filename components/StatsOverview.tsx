import { MonitorState, MonitorTarget } from '@/types/config'
import {
  formatAvailability,
  getMonitorDownCount,
  getOverallAvailability,
} from '@/components/monitorMetrics'
import { Group, Paper, SimpleGrid, Text, ThemeIcon, rem } from '@mantine/core'
import {
  IconActivityHeartbeat,
  IconAlertTriangle,
  IconChartBar,
  IconCircleCheck,
} from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'

export default function StatsOverview({
  monitors,
  state,
}: {
  monitors: MonitorTarget[]
  state: MonitorState
}) {
  const { t } = useTranslation('common')
  const total = monitors.length
  const down = getMonitorDownCount(
    state,
    monitors.map((monitor) => monitor.id)
  )
  const up = Math.max(total - down, 0)
  const availability = formatAvailability(getOverallAvailability(state, monitors))

  const stats = [
    {
      label: t('Total monitors'),
      value: total,
      color: 'gray',
      icon: IconActivityHeartbeat,
      detail: t('Configured checks'),
    },
    {
      label: t('Online monitors'),
      value: up,
      color: 'green',
      icon: IconCircleCheck,
      detail: t('Healthy now'),
    },
    {
      label: t('Offline monitors'),
      value: down,
      color: down > 0 ? 'red' : 'gray',
      icon: IconAlertTriangle,
      detail: down > 0 ? t('Needs attention') : t('No active outage'),
    },
    {
      label: t('Overall uptime'),
      value: `${availability}%`,
      color: 'teal',
      icon: IconChartBar,
      detail: t('Average availability'),
    },
  ]

  return (
    <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md" mt="xl">
      {stats.map((stat) => {
        const Icon = stat.icon
        return (
          <Paper key={stat.label} className="cfkuma-surface" withBorder radius="md" p="md" shadow="xs">
            <Group justify="space-between" align="flex-start" gap="xs" wrap="nowrap">
              <div>
                <Text size="xs" c="dimmed" fw={700} tt="uppercase">
                  {stat.label}
                </Text>
                <Text fw={800} style={{ fontSize: rem(28), lineHeight: 1.15 }}>
                  {stat.value}
                </Text>
                <Text size="xs" c="dimmed" mt={2}>
                  {stat.detail}
                </Text>
              </div>
              <ThemeIcon color={stat.color} variant="light" radius="xl" size="lg">
                <Icon style={{ width: rem(18), height: rem(18) }} />
              </ThemeIcon>
            </Group>
          </Paper>
        )
      })}
    </SimpleGrid>
  )
}
