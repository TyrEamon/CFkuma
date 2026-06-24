import Head from 'next/head'
import { useEffect, useMemo, useState } from 'react'
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Checkbox,
  Divider,
  Group,
  NumberInput,
  Select,
  SegmentedControl,
  Slider,
  Stack,
  Switch,
  Text,
  TextInput,
  ThemeIcon,
  Tooltip,
  rem,
} from '@mantine/core'
import {
  IconAlertCircle,
  IconBell,
  IconBrandGithub,
  IconCheck,
  IconCopy,
  IconDeviceFloppy,
  IconEye,
  IconLayoutDashboard,
  IconLink,
  IconPhoto,
  IconPlus,
  IconRefresh,
  IconSettings,
  IconShield,
  IconTrash,
  IconWorld,
} from '@tabler/icons-react'
import classes from '@/styles/Admin.module.css'
import {
  CFKUMA_BACKGROUND_BLUR_QUERY_PARAM,
  CFKUMA_BACKGROUND_DIM_QUERY_PARAM,
  CFKUMA_BACKGROUND_QUERY_PARAM,
  CFKUMA_SKIN_QUERY_PARAM,
} from '@/util/theme'
import {
  AdminAppearance,
  AdminConfig,
  AdminMonitor,
  AdminMonitorCategory,
  AdminMonitorMethod,
  createDefaultAdminConfig,
} from '@/util/adminConfig'

const categoryOptions: { value: AdminMonitorCategory; label: string }[] = [
  { value: 'website', label: '网站' },
  { value: 'api', label: 'API' },
  { value: 'container', label: '容器' },
  { value: 'proxy', label: '代理节点' },
  { value: 'domain', label: '域名' },
]

const iconOptions = [
  { value: 'world', label: 'World' },
  { value: 'api', label: 'API' },
  { value: 'box', label: 'Box' },
  { value: 'server', label: 'Server' },
  { value: 'shield', label: 'Shield' },
  { value: 'world-www', label: 'WWW' },
  { value: 'database', label: 'Database' },
]

const emptyMonitor: AdminMonitor = {
  id: '',
  name: '',
  category: 'website',
  method: 'GET',
  target: '',
  expectedCodes: '200',
  timeout: 10000,
  group: '项目',
  icon: 'world',
  enabled: true,
}

const defaultConfig = createDefaultAdminConfig()

function categoryLabel(category: AdminMonitorCategory) {
  return categoryOptions.find((item) => item.value === category)?.label ?? category
}

function categoryColor(category: AdminMonitorCategory) {
  return {
    website: 'blue',
    api: 'teal',
    container: 'violet',
    proxy: 'indigo',
    domain: 'cyan',
  }[category]
}

function normalizeId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function MonitorTypeIcon({ category }: { category: AdminMonitorCategory }) {
  const iconMap = {
    website: IconWorld,
    api: IconLink,
    container: IconLayoutDashboard,
    proxy: IconShield,
    domain: IconBrandGithub,
  }
  const Icon = iconMap[category]

  return (
    <ThemeIcon color={categoryColor(category)} variant="light" radius="md" size="md">
      <Icon style={{ width: rem(17), height: rem(17) }} stroke={1.9} />
    </ThemeIcon>
  )
}

export default function AdminPage() {
  useEffect(() => {
    document.body.style.display = ''
  }, [])

  const [section, setSection] = useState('monitors')
  const [monitors, setMonitors] = useState(defaultConfig.monitors)
  const [draft, setDraft] = useState<AdminMonitor>(emptyMonitor)
  const [appearance, setAppearance] = useState<AdminAppearance>(defaultConfig.appearance)
  const [copiedPreviewLink, setCopiedPreviewLink] = useState(false)
  const [loadingConfig, setLoadingConfig] = useState(true)
  const [savingConfig, setSavingConfig] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const enabledCount = monitors.filter((monitor) => monitor.enabled).length

  const groups = useMemo(() => {
    return Array.from(new Set(monitors.map((monitor) => monitor.group).filter(Boolean)))
  }, [monitors])

  const currentConfig: AdminConfig = useMemo(
    () => ({
      version: 1,
      appearance,
      monitors,
    }),
    [appearance, monitors]
  )

  const loadConfig = async (silent = false) => {
    if (!silent) setLoadingConfig(true)
    setErrorMessage('')

    try {
      const response = await fetch('/api/admin/config', { cache: 'no-store' })
      if (!response.ok) throw new Error(`读取配置失败：${response.status}`)
      const payload = (await response.json()) as { config: AdminConfig }
      setAppearance(payload.config.appearance)
      setMonitors(payload.config.monitors)
      if (silent) setStatusMessage('已同步 D1 配置。')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '读取配置失败')
    } finally {
      setLoadingConfig(false)
    }
  }

  useEffect(() => {
    void loadConfig()
  }, [])

  const previewLink = useMemo(() => {
    if (typeof window === 'undefined') return ''

    const url = new URL('/', window.location.origin)
    const backgroundUrl = appearance.backgroundUrl.trim()
    url.searchParams.set(CFKUMA_SKIN_QUERY_PARAM, 'aurora')
    if (backgroundUrl) url.searchParams.set(CFKUMA_BACKGROUND_QUERY_PARAM, backgroundUrl)
    url.searchParams.set(CFKUMA_BACKGROUND_DIM_QUERY_PARAM, String(appearance.backgroundDim))
    url.searchParams.set(CFKUMA_BACKGROUND_BLUR_QUERY_PARAM, String(appearance.backgroundBlur))
    return url.toString()
  }, [appearance])

  const previewStyle = {
    '--admin-preview-bg': `url("${appearance.backgroundUrl}")`,
    '--admin-preview-dim': appearance.backgroundDim / 100,
    '--admin-preview-blur': `${appearance.backgroundBlur}px`,
  } as React.CSSProperties

  const updateDraft = <K extends keyof AdminMonitor>(key: K, value: AdminMonitor[K]) => {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  const addMonitor = () => {
    const id = normalizeId(draft.id || draft.name)
    if (!id || !draft.name.trim() || !draft.target.trim()) return

    const nextMonitor = {
      ...draft,
      id,
      name: draft.name.trim(),
      target: draft.target.trim(),
      group: draft.group.trim() || '未分组',
    }

    setMonitors((current) => [nextMonitor, ...current.filter((monitor) => monitor.id !== id)])
    setDraft(emptyMonitor)
  }

  const removeMonitor = (id: string) => {
    setMonitors((current) => current.filter((monitor) => monitor.id !== id))
  }

  const toggleMonitor = (id: string) => {
    setMonitors((current) =>
      current.map((monitor) =>
        monitor.id === id ? { ...monitor, enabled: !monitor.enabled } : monitor
      )
    )
  }

  const saveConfig = async () => {
    setSavingConfig(true)
    setStatusMessage('')
    setErrorMessage('')

    try {
      const response = await fetch('/api/admin/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: currentConfig }),
      })
      const payload = (await response.json()) as { config?: AdminConfig; error?: string }
      if (!response.ok || !payload.config) throw new Error(payload.error ?? `保存失败：${response.status}`)

      setAppearance(payload.config.appearance)
      setMonitors(payload.config.monitors)
      setStatusMessage('已保存到 D1。下一次 Worker 定时任务会使用这份监控配置。')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '保存失败')
    } finally {
      setSavingConfig(false)
    }
  }

  const copyPreviewLink = async () => {
    if (!previewLink) return

    if (navigator.clipboard) {
      await navigator.clipboard.writeText(previewLink)
    } else {
      const input = document.createElement('textarea')
      input.value = previewLink
      input.style.position = 'fixed'
      input.style.opacity = '0'
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      input.remove()
    }
    setCopiedPreviewLink(true)
    window.setTimeout(() => setCopiedPreviewLink(false), 1400)
  }

  return (
    <>
      <Head>
        <title>CFkuma Admin</title>
      </Head>

      <main className={classes.shell}>
        <aside className={classes.sidebar}>
          <div className={classes.brandBlock}>
            <div className={classes.brandMark}>CF</div>
            <div>
              <Text fw={800} size="lg">
                CFkuma
              </Text>
              <Text size="xs" c="dimmed">
                Admin Console
              </Text>
            </div>
          </div>

          <nav className={classes.navList} aria-label="Admin sections">
            <button
              className={classes.navItem}
              data-active={section === 'monitors' || undefined}
              onClick={() => setSection('monitors')}
            >
              <IconLayoutDashboard size={18} />
              <span>监控</span>
            </button>
            <button
              className={classes.navItem}
              data-active={section === 'appearance' || undefined}
              onClick={() => setSection('appearance')}
            >
              <IconPhoto size={18} />
              <span>外观</span>
            </button>
            <button className={classes.navItem} onClick={() => setSection('notify')}>
              <IconBell size={18} />
              <span>通知</span>
            </button>
            <button className={classes.navItem} onClick={() => setSection('settings')}>
              <IconSettings size={18} />
              <span>设置</span>
            </button>
          </nav>

          <div className={classes.sidebarFooter}>
            <Badge color="blue" variant="light">
              D1 connected
            </Badge>
            <Text size="xs" c="dimmed">
              保存后由 Worker 定时任务接管监控
            </Text>
          </div>
        </aside>

        <section className={classes.workspace}>
          <header className={classes.topbar}>
            <div>
              <Text size="xs" fw={700} c="blue">
                管理后台
              </Text>
              <h1>监控与状态页配置</h1>
            </div>
            <Group gap="xs" wrap="nowrap">
              <Button
                component="a"
                href={previewLink || '/'}
                target="_blank"
                variant="default"
                leftSection={<IconEye size={16} />}
                radius="md"
              >
                打开效果链接
              </Button>
              <Button leftSection={<IconCopy size={16} />} radius="md" onClick={copyPreviewLink}>
                {copiedPreviewLink ? '已复制' : '复制链接'}
              </Button>
              <Button
                leftSection={<IconDeviceFloppy size={16} />}
                radius="md"
                onClick={saveConfig}
                loading={savingConfig}
              >
                保存配置
              </Button>
            </Group>
          </header>

          {loadingConfig && (
            <Alert color="blue" variant="light" radius="md" mb="md" icon={<IconRefresh size={16} />}>
              正在读取 D1 配置...
            </Alert>
          )}

          {statusMessage && (
            <Alert color="green" variant="light" radius="md" mb="md" icon={<IconCheck size={16} />}>
              {statusMessage}
            </Alert>
          )}

          {errorMessage && (
            <Alert color="red" variant="light" radius="md" mb="md" icon={<IconAlertCircle size={16} />}>
              {errorMessage}
            </Alert>
          )}

          <div className={classes.summaryGrid}>
            <div className={classes.metricTile}>
              <Text size="xs" c="dimmed" fw={700}>
                监控总数
              </Text>
              <strong>{monitors.length}</strong>
            </div>
            <div className={classes.metricTile}>
              <Text size="xs" c="dimmed" fw={700}>
                已启用
              </Text>
              <strong>{enabledCount}</strong>
            </div>
            <div className={classes.metricTile}>
              <Text size="xs" c="dimmed" fw={700}>
                分组
              </Text>
              <strong>{groups.length}</strong>
            </div>
          </div>

          <div className={classes.contentGrid}>
            <div className={classes.mainColumn}>
              <section className={classes.panel}>
                <div className={classes.panelHeader}>
                  <div>
                    <Text size="xs" fw={700} c="teal">
                      MONITORS
                    </Text>
                    <h2>添加监控</h2>
                  </div>
                  <SegmentedControl
                    radius="md"
                    value={draft.method === 'TCP_PING' ? 'TCP' : 'HTTP'}
                    onChange={(value) =>
                      updateDraft('method', value === 'TCP' ? 'TCP_PING' : 'GET')
                    }
                    data={['HTTP', 'TCP']}
                  />
                </div>

                <div className={classes.formGrid}>
                  <TextInput
                    label="名称"
                    placeholder="香港 VPS SSH"
                    value={draft.name}
                    onChange={(event) => updateDraft('name', event.currentTarget.value)}
                    radius="md"
                  />
                  <TextInput
                    label="ID"
                    placeholder="hk_vps_ssh"
                    value={draft.id}
                    onChange={(event) => updateDraft('id', event.currentTarget.value)}
                    radius="md"
                  />
                  <Select
                    label="类型"
                    data={categoryOptions}
                    value={draft.category}
                    onChange={(value) =>
                      updateDraft('category', (value as AdminMonitorCategory) ?? 'website')
                    }
                    radius="md"
                  />
                  <Select
                    label="图标"
                    data={iconOptions}
                    value={draft.icon}
                    onChange={(value) => updateDraft('icon', value ?? 'world')}
                    radius="md"
                  />
                  <TextInput
                    className={classes.fullSpan}
                    label={draft.method === 'TCP_PING' ? '目标 host:port' : '目标 URL'}
                    placeholder={
                      draft.method === 'TCP_PING' ? '1.2.3.4:443' : 'https://example.com/health'
                    }
                    value={draft.target}
                    onChange={(event) => updateDraft('target', event.currentTarget.value)}
                    radius="md"
                  />
                  <TextInput
                    label="期望状态码"
                    placeholder="200,301,302"
                    value={draft.method === 'TCP_PING' ? '' : draft.expectedCodes}
                    disabled={draft.method === 'TCP_PING'}
                    onChange={(event) => updateDraft('expectedCodes', event.currentTarget.value)}
                    radius="md"
                  />
                  <NumberInput
                    label="超时 ms"
                    min={1000}
                    step={500}
                    value={draft.timeout}
                    onChange={(value) => updateDraft('timeout', Number(value) || 10000)}
                    radius="md"
                  />
                  <TextInput
                    label="分组"
                    placeholder="项目 / VPS / 容器 / 代理节点"
                    value={draft.group}
                    onChange={(event) => updateDraft('group', event.currentTarget.value)}
                    radius="md"
                  />
                  <div className={classes.formActions}>
                    <Checkbox
                      label="启用"
                      checked={draft.enabled}
                      onChange={(event) => updateDraft('enabled', event.currentTarget.checked)}
                    />
                    <Button leftSection={<IconPlus size={16} />} onClick={addMonitor} radius="md">
                      添加
                    </Button>
                  </div>
                </div>
              </section>

              <section className={classes.panel}>
                <div className={classes.panelHeaderCompact}>
                  <div>
                    <Text size="xs" fw={700} c="teal">
                      LIST
                    </Text>
                    <h2>监控列表</h2>
                  </div>
                  <Button
                    variant="default"
                    leftSection={<IconRefresh size={16} />}
                    radius="md"
                    onClick={() => loadConfig(true)}
                  >
                    同步 D1
                  </Button>
                </div>

                <div className={classes.monitorList}>
                  {monitors.map((monitor) => (
                    <article className={classes.monitorRow} key={monitor.id}>
                      <Group gap="sm" wrap="nowrap" className={classes.monitorIdentity}>
                        <MonitorTypeIcon category={monitor.category} />
                        <div>
                          <Group gap="xs" wrap="nowrap">
                            <Text fw={700}>{monitor.name}</Text>
                            <Badge color={categoryColor(monitor.category)} variant="light">
                              {categoryLabel(monitor.category)}
                            </Badge>
                          </Group>
                          <Text size="sm" c="dimmed" truncate="end">
                            {monitor.target}
                          </Text>
                        </div>
                      </Group>
                      <div className={classes.rowMeta}>
                        <Text size="xs" c="dimmed" fw={700}>
                          {monitor.method}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {monitor.group}
                        </Text>
                      </div>
                      <Group gap="xs" wrap="nowrap" justify="flex-end">
                        <Switch
                          checked={monitor.enabled}
                          onChange={() => toggleMonitor(monitor.id)}
                          aria-label={`Toggle ${monitor.name}`}
                        />
                        <Tooltip label="删除">
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            radius="md"
                            onClick={() => removeMonitor(monitor.id)}
                            aria-label={`Delete ${monitor.name}`}
                          >
                            <IconTrash size={17} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </article>
                  ))}
                </div>
              </section>
            </div>

            <aside className={classes.sideColumn}>
              <section className={classes.panel}>
                <div className={classes.panelHeaderCompact}>
                  <div>
                    <Text size="xs" fw={700} c="blue">
                      APPEARANCE
                    </Text>
                    <h2>外观设置</h2>
                  </div>
                </div>

                <Stack gap="sm">
                  <TextInput
                    label="状态页标题"
                    value={appearance.title}
                    onChange={(event) =>
                      setAppearance((current) => ({ ...current, title: event.currentTarget.value }))
                    }
                    radius="md"
                  />
                  <TextInput
                    label="Logo 链接"
                    value={appearance.logoUrl}
                    onChange={(event) =>
                      setAppearance((current) => ({ ...current, logoUrl: event.currentTarget.value }))
                    }
                    radius="md"
                  />
                  <TextInput
                    label="背景图链接"
                    value={appearance.backgroundUrl}
                    onChange={(event) =>
                      setAppearance((current) => ({ ...current, backgroundUrl: event.currentTarget.value }))
                    }
                    radius="md"
                  />
                  <TextInput
                    label="状态页效果链接"
                    value={previewLink}
                    readOnly
                    radius="md"
                  />
                  <div>
                    <Group justify="space-between" mb={6}>
                      <Text size="sm" fw={500}>
                        背景压暗
                      </Text>
                      <Text size="sm" c="dimmed">
                        {appearance.backgroundDim}%
                      </Text>
                    </Group>
                    <Slider
                      min={20}
                      max={82}
                      value={appearance.backgroundDim}
                      onChange={(value) =>
                        setAppearance((current) => ({ ...current, backgroundDim: value }))
                      }
                    />
                  </div>
                  <div>
                    <Group justify="space-between" mb={6}>
                      <Text size="sm" fw={500}>
                        背景模糊
                      </Text>
                      <Text size="sm" c="dimmed">
                        {appearance.backgroundBlur}px
                      </Text>
                    </Group>
                    <Slider
                      min={0}
                      max={10}
                      value={appearance.backgroundBlur}
                      onChange={(value) =>
                        setAppearance((current) => ({ ...current, backgroundBlur: value }))
                      }
                    />
                  </div>
                </Stack>
              </section>

              <section className={classes.previewPanel} style={previewStyle}>
                <div className={classes.previewBackdrop} />
                <div className={classes.previewContent}>
                  <Group justify="space-between" align="center" wrap="nowrap">
                    <Group gap="xs" wrap="nowrap">
                      <div className={classes.previewLogo}>
                        <IconPhoto size={18} />
                      </div>
                      <Text fw={800}>{appearance.title || 'Status Page'}</Text>
                    </Group>
                    <Badge color="green" variant="filled">
                      Online
                    </Badge>
                  </Group>

                  <Divider my="md" opacity={0.32} />

                  <Stack gap="sm">
                    {monitors.slice(0, 4).map((monitor) => (
                      <div className={classes.previewMonitor} key={monitor.id}>
                        <Group gap="xs" wrap="nowrap">
                          <span className={classes.statusDot} data-enabled={monitor.enabled || undefined} />
                          <Text size="sm" fw={700} truncate="end">
                            {monitor.name}
                          </Text>
                        </Group>
                        <Text size="xs" c="dimmed">
                          {monitor.enabled ? '正常' : '停用'}
                        </Text>
                      </div>
                    ))}
                  </Stack>

                  <div className={classes.previewFooter}>
                    <IconCheck size={15} />
                    <span>{enabledCount} 个监控启用</span>
                  </div>
                </div>
              </section>
            </aside>
          </div>
        </section>
      </main>
    </>
  )
}
