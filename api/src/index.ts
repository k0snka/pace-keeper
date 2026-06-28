import { Hono } from 'hono'
import { cors } from 'hono/cors'

// --- Bindings ---
type Bindings = {
  API_SECRET: string
  ROOMS: DurableObjectNamespace
}

// --- Router ---
const app = new Hono<{ Bindings: Bindings }>()

app.use('/*', cors({ origin: '*', allowMethods: ['GET', 'POST'] }))

app.use('/api/*', async (c, next) => {
  const secret = c.env.API_SECRET
  if (secret && c.req.header('x-api-secret') !== secret) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  await next()
})

// 全リクエストを対応するルームのDurable Objectに転送
app.all('/api/*', async (c) => {
  let roomId: string | undefined
  let forwarded: Request

  if (c.req.method === 'GET') {
    roomId = c.req.query('roomId')
    forwarded = c.req.raw
  } else {
    const body = await c.req.json().catch(() => ({}))
    roomId = body.roomId
    // bodyを読み終えているので再構築して転送
    forwarded = new Request(c.req.raw, {
      body: JSON.stringify(body),
      headers: c.req.raw.headers,
    })
  }

  if (!roomId) return c.json({ error: 'roomId is required' }, 400)

  const id = c.env.ROOMS.idFromName(roomId)
  const obj = c.env.ROOMS.get(id)
  const doRes = await obj.fetch(forwarded)
  // DO のレスポンスはヘッダーがイミュータブルなので新しい Response に包む
  return new Response(doRes.body, {
    status: doRes.status,
    headers: new Headers(doRes.headers),
  })
})

export default app

// --- Durable Object ---
const EXPIRE_TIME = 5000

type State = {
  currentSpeaker: string
  speakerCps: number
  lastSpeakerTime: number
  clickTimestamps: number[]
  speakingTime: Record<string, number>
  lastSpeedUpdate: Record<string, number>
}

export class RoomObject {
  state: DurableObjectState
  s: State

  constructor(state: DurableObjectState) {
    this.state = state
    this.s = {
      currentSpeaker: '誰も話していません',
      speakerCps: 0,
      lastSpeakerTime: 0,
      clickTimestamps: [],
      speakingTime: {},
      lastSpeedUpdate: {},
    }
    // 再起動時にストレージから復元
    this.state.blockConcurrencyWhile(async () => {
      const saved = await this.state.storage.get<State>('s')
      if (saved) this.s = saved
    })
  }

  async save() {
    await this.state.storage.put('s', this.s)
  }

  getActiveWaitCount(): number {
    const now = Date.now()
    this.s.clickTimestamps = this.s.clickTimestamps.filter(t => now - t < EXPIRE_TIME)
    return this.s.clickTimestamps.length
  }

  getSpeakingShares(): Record<string, number> {
    const total = Object.values(this.s.speakingTime).reduce((a, b) => a + b, 0)
    if (total === 0) return {}
    return Object.fromEntries(
      Object.entries(this.s.speakingTime)
        .map(([k, v]) => [k, Math.round(v / total * 100)])
        .sort((a, b) => (b[1] as number) - (a[1] as number))
    )
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const now = Date.now()

    if (request.method === 'GET' && url.pathname === '/api/room-status') {
      if (now - this.s.lastSpeakerTime > 3000) {
        this.s.currentSpeaker = '誰も話していません'
        this.s.speakerCps = 0
      }
      const waitCount = this.getActiveWaitCount()
      const silenceDuration = this.s.lastSpeakerTime > 0
        ? Math.floor((now - this.s.lastSpeakerTime) / 1000)
        : null

      return Response.json({
        waitCount,
        currentSpeaker: this.s.currentSpeaker,
        speakerCps: this.s.speakerCps,
        speedLevel: this.s.speakerCps === 0 ? 'stop' : this.s.speakerCps > 7 ? 'fast' : 'normal',
        status: waitCount > 3 ? '🚨限界' : waitCount > 0 ? '✋少し待って' : '👍快適',
        speakingShares: this.getSpeakingShares(),
        silenceDuration,
      })
    }

    if (request.method === 'POST' && url.pathname === '/api/speed') {
      const body = await request.json<{ userName: string; cps: number }>()
      if (body.cps > 0) {
        this.s.currentSpeaker = body.userName
        this.s.speakerCps = body.cps
        this.s.lastSpeakerTime = now

        const last = this.s.lastSpeedUpdate[body.userName]
        if (last) {
          const delta = Math.min(now - last, 2000)
          this.s.speakingTime[body.userName] = (this.s.speakingTime[body.userName] ?? 0) + delta
        }
        this.s.lastSpeedUpdate[body.userName] = now
        await this.save()
      }
      return Response.json({ success: true })
    }

    if (request.method === 'POST' && url.pathname === '/api/wait') {
      this.s.clickTimestamps.push(now)
      await this.save()
      return Response.json({ success: true, currentCount: this.getActiveWaitCount() })
    }

    if (request.method === 'POST' && url.pathname === '/api/reset') {
      this.s = {
        currentSpeaker: '誰も話していません',
        speakerCps: 0,
        lastSpeakerTime: 0,
        clickTimestamps: [],
        speakingTime: {},
        lastSpeedUpdate: {},
      }
      await this.save()
      return Response.json({ success: true })
    }

    return new Response('Not Found', { status: 404 })
  }
}
