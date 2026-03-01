/**
 * Mock Statement Store server for testing.
 *
 * Mimics the Substrate People chain's statement store RPCs:
 * - system_chain → returns chain name
 * - rpc_methods → returns available statement_ methods
 * - statement_submit → accepts any statement (no allowance check)
 * - statement_subscribeStatement → pushes statements to all subscribers
 *
 * All statements are stored in memory and broadcast to subscribers.
 */

import { WebSocketServer, type WebSocket } from 'ws'

interface JsonRpcRequest {
  jsonrpc: string
  id: number | string
  method: string
  params: any[]
}

export function createMockStatementStore(port: number): Promise<{
  url: string
  close: () => void
}> {
  return new Promise((resolve, reject) => {
    const wss = new WebSocketServer({ port })
    const statements: string[] = [] // All submitted statement hex strings
    const subscribers = new Map<WebSocket, Set<string>>() // ws → subscription IDs

    wss.on('listening', () => {
      const url = `ws://127.0.0.1:${port}`
      console.log(`[MockStatementStore] Listening on ${url}`)
      resolve({
        url,
        close: () => {
          wss.clients.forEach(ws => ws.close())
          wss.close()
          console.log('[MockStatementStore] Closed')
        },
      })
    })

    wss.on('error', reject)

    wss.on('connection', (ws) => {
      subscribers.set(ws, new Set())

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString()) as JsonRpcRequest
          handleRpc(ws, msg)
        } catch {
          // Ignore malformed messages
        }
      })

      ws.on('close', () => {
        subscribers.delete(ws)
      })
    })

    function handleRpc(ws: WebSocket, req: JsonRpcRequest) {
      const { id, method, params } = req

      switch (method) {
        case 'system_chain':
          send(ws, { jsonrpc: '2.0', id, result: 'Mock Statement Store' })
          break

        case 'rpc_methods':
          send(ws, {
            jsonrpc: '2.0',
            id,
            result: {
              methods: [
                'system_chain',
                'rpc_methods',
                'statement_submit',
                'statement_subscribeStatement',
                'statement_unsubscribeStatement',
              ],
            },
          })
          break

        case 'statement_submit': {
          // Accept the statement (no allowance check)
          const statementHex = params?.[0] || ''
          if (typeof statementHex === 'string' && statementHex.startsWith('0x')) {
            statements.push(statementHex)

            // Broadcast to all subscribers
            for (const [subscriber, subs] of subscribers) {
              for (const subId of subs) {
                send(subscriber, {
                  jsonrpc: '2.0',
                  method: 'statement_subscribeStatement',
                  params: {
                    subscription: subId,
                    result: {
                      data: {
                        statements: [statementHex],
                      },
                    },
                  },
                })
              }
            }
          }

          send(ws, { jsonrpc: '2.0', id, result: 'new' })
          break
        }

        case 'statement_subscribeStatement': {
          const subId = `sub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
          const subs = subscribers.get(ws)
          if (subs) {
            subs.add(subId)
          }

          // Send subscription confirmation
          send(ws, { jsonrpc: '2.0', id, result: subId })

          // Send all existing statements to new subscriber
          if (statements.length > 0) {
            send(ws, {
              jsonrpc: '2.0',
              method: 'statement_subscribeStatement',
              params: {
                subscription: subId,
                result: {
                  data: {
                    statements: [...statements],
                  },
                },
              },
            })
          }
          break
        }

        case 'statement_unsubscribeStatement': {
          const unsubId = params?.[0]
          const subs = subscribers.get(ws)
          if (subs && unsubId) {
            subs.delete(unsubId)
          }
          send(ws, { jsonrpc: '2.0', id, result: true })
          break
        }

        default:
          send(ws, {
            jsonrpc: '2.0',
            id,
            error: { code: -32601, message: `Method not found: ${method}` },
          })
      }
    }

    function send(ws: WebSocket, msg: any) {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify(msg))
      }
    }
  })
}
