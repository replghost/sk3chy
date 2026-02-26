export function useOnChainSettings() {
  const enabled = useState<boolean>('onchain-enabled', () => false)
  return { enabled }
}
