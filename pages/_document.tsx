import { Html, Head, Main, NextScript } from 'next/document'
import { ColorSchemeScript } from '@mantine/core'

const MANTINE_COLOR_SCHEME_STORAGE_KEY = 'mantine-color-scheme-value'

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <ColorSchemeScript
          defaultColorScheme="auto"
          localStorageKey={MANTINE_COLOR_SCHEME_STORAGE_KEY}
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
