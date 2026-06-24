import { Divider } from '@mantine/core'
import { pageConfig } from '@/uptime.config'
import { PageConfig } from '@/types/config'

export default function Footer({ config = pageConfig }: { config?: PageConfig }) {
  const defaultFooter =
    '<p style="text-align: center; font-size: 12px; margin-top: 10px;"> Open-source monitoring and status page powered by <a href="https://github.com/TyrEamon/CFkuma" target="_blank">CFkuma</a>. </p>'

  return (
    <>
      <Divider mt="lg" />
      <div dangerouslySetInnerHTML={{ __html: config.customFooter ?? defaultFooter }} />
    </>
  )
}
