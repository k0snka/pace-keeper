import { Hono } from 'hono'
import { cors } from 'hono/cors'

type Bindings = { API_SECRET: string }

const app = new Hono<{ Bindings: Bindings }>()

app.use('/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST'],
}))

app.use('/api/*', async (c, next) => {
  const secret = c.env.API_SECRET
  if (secret && c.req.header('x-api-secret') !== secret) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  await next()
})

let currentSpeaker = '誰も話していません'
let speakerCps = 0
let lastSpeakerTime = 0

let clickTimestamps: number[] = []
const EXPIRE_TIME = 5000

// 発話占有率集計
const speakingTime: Map<string, number> = new Map()
const lastSpeedUpdate: Map<string, number> = new Map()
let sessionStartTime = Date.now()

function getActiveWaitCount(): number {
  const now = Date.now()
  clickTimestamps = clickTimestamps.filter(timestamp => now - timestamp < EXPIRE_TIME)
  return clickTimestamps.length
}

function getSpeakingShares(): Record<string, number> {
  const total = Array.from(speakingTime.values()).reduce((a, b) => a + b, 0)
  if (total === 0) return {}
  return Object.fromEntries(
    Array.from(speakingTime.entries())
      .map(([k, v]) => [k, Math.round(v / total * 100)])
      .sort((a, b) => (b[1] as number) - (a[1] as number))
  )
}

app.get('/api/room-status', (c) => {
  const now = Date.now()

  if (now - lastSpeakerTime > 3000) {
    currentSpeaker = '誰も話していません'
    speakerCps = 0
  }

  const silenceDuration = lastSpeakerTime > 0 ? Math.floor((now - lastSpeakerTime) / 1000) : null
  const currentWaitCount = getActiveWaitCount()

  return c.json({
    waitCount: currentWaitCount,
    currentSpeaker,
    speakerCps,
    speedLevel: speakerCps === 0 ? 'stop' : speakerCps > 7 ? 'fast' : 'normal',
    status: currentWaitCount > 3 ? '🚨限界' : currentWaitCount > 0 ? '✋少し待って' : '👍快適',
    speakingShares: getSpeakingShares(),
    silenceDuration,
  })
})

app.post('/api/speed', async (c) => {
  const body = await c.req.json<{ userName: string, cps: number }>()
  const now = Date.now()

  if (body.cps > 0) {
    currentSpeaker = body.userName
    speakerCps = body.cps
    lastSpeakerTime = now

    // 前回の更新から今回までの時間を発話時間として加算（最大2秒でキャップ）
    const last = lastSpeedUpdate.get(body.userName)
    if (last) {
      const delta = Math.min(now - last, 2000)
      speakingTime.set(body.userName, (speakingTime.get(body.userName) ?? 0) + delta)
    }
    lastSpeedUpdate.set(body.userName, now)
  }

  return c.json({ success: true })
})

app.post('/api/wait', (c) => {
  clickTimestamps.push(Date.now())
  const currentCount = getActiveWaitCount()
  return c.json({ success: true, currentCount })
})

app.post('/api/reset', (c) => {
  clickTimestamps = []
  currentSpeaker = '誰も話していません'
  speakerCps = 0
  speakingTime.clear()
  lastSpeedUpdate.clear()
  sessionStartTime = Date.now()
  lastSpeakerTime = 0
  return c.json({ success: true })
})

export default app
