// bulletin-deploy loads this file at publish time. Keep it dependency-free so
// deployment works even when the CLI is installed globally or fetched with npx.
const defineConfig = <T>(config: T): T => config

const rawDomain = process.env.BULLETIN_DEPLOY_DOMAIN ?? process.env.APP_DOTNS_DOMAIN ?? 'sk3chy.dot'
const domain = rawDomain.endsWith('.dot') ? rawDomain : `${rawDomain}.dot`

export default defineConfig({
  domain,
  displayName: 'sk3chy',
  description: 'A peer-to-peer drawing and guessing game for the Polkadot Host.',
  icon: { path: './docs/screenshots/index-final.png', format: 'png' },
  executables: [
    {
      kind: 'app',
      path: './dist',
      appVersion: [0, 1, 0]
    }
  ]
})
