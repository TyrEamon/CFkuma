import { MonitorState, MonitorTarget } from '@/types/config'
import { Accordion, Container, Group, SimpleGrid, Text } from '@mantine/core'
import MonitorCard from './MonitorCard'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getMonitorDownCount } from '@/components/monitorMetrics'
import { PageConfigGroup } from '@/types/config'

function getStatusTextColor(state: MonitorState, ids: string[]) {
  const downCount = getMonitorDownCount(state, ids)
  if (downCount === 0) {
    return '#059669'
  } else if (downCount === ids.length) {
    return '#df484a'
  } else {
    return '#f29030'
  }
}

function MonitorGrid({ monitors, state }: { monitors: MonitorTarget[]; state: MonitorState }) {
  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3, xl: 4 }} spacing="md">
      {monitors.map((monitor) => (
        <MonitorCard key={monitor.id} monitor={monitor} state={state} />
      ))}
    </SimpleGrid>
  )
}

export default function MonitorList({
  monitors,
  state,
  group,
}: {
  monitors: MonitorTarget[]
  state: MonitorState
  group?: PageConfigGroup
}) {
  const { t } = useTranslation('common')
  const groupedMonitor = group && Object.keys(group).length > 0
  let content

  // Load expanded groups from localStorage when rendering in the browser.
  const [expandedGroups, setExpandedGroups] = useState<string[]>(() => {
    if (typeof localStorage === 'undefined') return Object.keys(group || {})

    const savedExpandedGroups = localStorage.getItem('expandedGroups')
    return savedExpandedGroups ? JSON.parse(savedExpandedGroups) : Object.keys(group || {})
  })
  useEffect(() => {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem('expandedGroups', JSON.stringify(expandedGroups))
  }, [expandedGroups])

  if (groupedMonitor) {
    content = (
      <Accordion
        multiple
        defaultValue={Object.keys(group)}
        variant="contained"
        value={expandedGroups}
        onChange={(values) => setExpandedGroups(values)}
      >
        {Object.keys(group).map((groupName) => {
          const orderedMonitors = monitors
            .filter((monitor) => group[groupName].includes(monitor.id))
            .sort((a, b) => group[groupName].indexOf(a.id) - group[groupName].indexOf(b.id))
          const downCount = getMonitorDownCount(state, group[groupName])

          return (
            <Accordion.Item key={groupName} value={groupName}>
              <Accordion.Control>
                <Group justify="space-between" wrap="nowrap" style={{ width: '100%' }}>
                  <Text fw={700} truncate="end">
                    {groupName}
                  </Text>
                  <Text
                    fw={700}
                    size="sm"
                    style={{ paddingRight: 5, color: getStatusTextColor(state, group[groupName]) }}
                  >
                    {group[groupName].length - downCount}/{group[groupName].length}{' '}
                    {t('Operational')}
                  </Text>
                </Group>
              </Accordion.Control>
              <Accordion.Panel>
                <MonitorGrid monitors={orderedMonitors} state={state} />
              </Accordion.Panel>
            </Accordion.Item>
          )
        })}
      </Accordion>
    )
  } else {
    content = <MonitorGrid monitors={monitors} state={state} />
  }

  return (
    <Container size="xl" mt="xl" px="md">
      {content}
    </Container>
  )
}
