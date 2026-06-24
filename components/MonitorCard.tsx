import { MonitorState, MonitorTarget } from '@/types/config'
import {
  formatAvailability,
  getLatestLatency,
  getMonitorAvailability,
  getMonitorStatus,
  getMonitorStatusColor,
} from '@/components/monitorMetrics'
import { getColor } from '@/util/color'
import { Badge, Box, Group, Paper, Text, Tooltip } from '@mantine/core'
import MonitorIcon from './MonitorIcon'
import { useTranslation } from 'react-i18next'

const moment = require('moment')

type MonitorCardProps = {
  monitor: MonitorTarget
  state: MonitorState
}

function formatLatency(ping?: number) {
  if (ping === undefined) return '--'
  return `${Math.round(ping)} ms`
}

function formatRelativeTime(time?: number) {
  if (!time) return '--'
  return moment(time * 1000).fromNow()
}

function MiniLatencyBars({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values, 1)

  return (
    <Group gap={3} wrap="nowrap" align="flex-end" style={{ height: 36 }}>
      {values.map((value, index) => {
        const height = 8 + Math.round((value / max) * 24)
        return (
          <Box
            key={`${value}-${index}`}
            style={{
              flex: 1,
              minWidth: 3,
              height,
              borderRadius: 3,
              background: color,
              opacity: 0.32 + (index / Math.max(values.length - 1, 1)) * 0.5,
            }}
          />
        )
      })}
    </Group>
  )
}

export default function MonitorCard({ monitor, state }: MonitorCardProps) {
  const { t } = useTranslation('common')
  const status = getMonitorStatus(state, monitor.id)
  const statusColor = getMonitorStatusColor(status)
  const availability = getMonitorAvailability(state, monitor.id)
  const availabilityText = formatAvailability(availability)
  const latestLatency = getLatestLatency(state, monitor.id)
  const latencyValues = (state.latency[monitor.id] ?? []).slice(-18).map((point) => point.ping)
  const cardLabel = t('Open monitor detail', { name: monitor.name })

  return (
    <Paper
      className="cfkuma-surface"
      component="a"
      href={`#${monitor.id}`}
      aria-label={cardLabel}
      withBorder
      radius="md"
      p="md"
      shadow="xs"
      style={{
        display: 'block',
        color: 'inherit',
        textDecoration: 'none',
        minHeight: 178,
        '--cfkuma-card-hover-shadow': '0 12px 30px rgba(15, 23, 42, 0.12)',
        transition: 'transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease',
        cursor: 'pointer',
      } as React.CSSProperties}
      onMouseEnter={(event) => {
        event.currentTarget.style.transform = 'translateY(-2px)'
        event.currentTarget.style.boxShadow = 'var(--cfkuma-card-hover-shadow)'
        event.currentTarget.style.borderColor = statusColor
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.transform = 'translateY(0)'
        event.currentTarget.style.boxShadow = ''
        event.currentTarget.style.borderColor = ''
      }}
    >
      <Group justify="space-between" align="flex-start" gap="sm" wrap="nowrap">
        <Group gap="xs" wrap="nowrap" style={{ minWidth: 0, flex: '1 1 auto' }}>
          <Box
            aria-hidden
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              background: statusColor,
              boxShadow: `0 0 0 4px ${statusColor}1f`,
              flex: '0 0 auto',
            }}
          />
          <MonitorIcon monitor={monitor} />
          <Tooltip label={monitor.tooltip || monitor.name} disabled={!monitor.tooltip}>
            <Text fw={700} truncate="end" style={{ minWidth: 0, flex: '1 1 auto' }}>
              {monitor.name}
            </Text>
          </Tooltip>
        </Group>
        <Badge color={status === 'down' ? 'red' : status === 'up' ? 'green' : 'gray'} variant="light">
          {availabilityText}%
        </Badge>
      </Group>

      <Box mt="lg">
        {latencyValues.length > 0 ? (
          <MiniLatencyBars values={latencyValues} color={getColor(availability, false)} />
        ) : (
          <Text size="sm" c="dimmed">
            {t('No Data')}
          </Text>
        )}
      </Box>

      <Group justify="space-between" align="flex-end" mt="lg" gap="sm" wrap="nowrap">
        <div>
          <Text size="xs" c="dimmed" fw={700} tt="uppercase">
            {t('Latest latency')}
          </Text>
          <Text fw={700}>{formatLatency(latestLatency?.ping)}</Text>
        </div>
        <div style={{ textAlign: 'right', minWidth: 0 }}>
          <Text size="xs" c="dimmed" fw={700} tt="uppercase">
            {t('Last check')}
          </Text>
          <Group gap={4} justify="flex-end" wrap="nowrap">
            <Text size="sm" c="dimmed" truncate="end">
              {formatRelativeTime(latestLatency?.time)}
            </Text>
          </Group>
        </div>
      </Group>
    </Paper>
  )
}
