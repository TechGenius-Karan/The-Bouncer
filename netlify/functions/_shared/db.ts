import { MongoClient, type Db } from 'mongodb'
import type { AiReviewDoc, PuzzleDoc, ResultDoc, RuleDoc, WordDoc } from './types'

const uri: string = (() => {
  const value = process.env.MONGODB_URI
  if (!value) throw new Error('MONGODB_URI environment variable is not set')
  return value
})()

// Serverless functions can be invoked repeatedly against a warm container —
// caching the client across invocations avoids opening a fresh MongoDB
// connection on every request.
//
// Caching alone was NOT enough, and the gap caused a real outage: the driver
// defaults to maxPoolSize 100, so each warm instance could hold 100
// connections. Atlas's free M0 tier allows 500 in total, and this project has
// 16 functions — six busy instances exhausted the cluster, which then refused
// new connections. The symptom was intermittent 502s ("error decoding lambda
// response") while already-warm instances kept working fine, plus Atlas
// "approaching connection limit" alerts.
const CLIENT_OPTIONS = {
  // Sized for the ADMIN fan-out, not the game.
  //
  // Netlify Functions (Lambda) serve one request per container, so the only
  // concurrency inside a single player request is Promise.all — two queries in
  // get-round, none in check-swipe. Ten simultaneous players means ten
  // containers with their own pools, not ten connections from this one. So
  // raising this number cannot make the game faster; the player path can never
  // use more than about two.
  //
  // What it does help is admin-list-pending, which maps
  // resolveFullPuzzleDetail over every pending puzzle at 2 queries each — ~36
  // concurrent queries for 18 puzzles. At 20 that resolves in two rounds
  // instead of eight.
  //
  // Ceiling check: ~14 warm function-containers were observed holding 135
  // connections at maxPoolSize 10, so 20 lands near 270 of Atlas M0's 500 —
  // leaving real headroom for local dev, CLI scripts and the Atlas UI, which
  // all draw from the same 500. If connections creep toward the limit again,
  // this is the number to lower.
  maxPoolSize: 20,
  // Nothing here is latency-critical enough to justify holding sockets open
  // on an idle instance that Netlify may keep around for a long while.
  minPoolSize: 0,
  maxIdleTimeMS: 60_000,
  // Netlify sync functions are killed at 26s, so the driver's 30s default
  // could never surface as anything but a 502 with an empty body. Failing at
  // 8s lets the function return a real error the client can show instead.
  serverSelectionTimeoutMS: 8_000,
  // With a small pool, a fan-out can exhaust it briefly. Default is to wait
  // forever, which on Netlify means hanging until the 26s kill and returning
  // an empty-body 502 — the exact symptom that made the outage hard to read.
  // Failing at 10s surfaces a real error instead.
  waitQueueTimeoutMS: 10_000,
}

let cachedClient: MongoClient | null = null

async function getDb(): Promise<Db> {
  if (!cachedClient) {
    const client = new MongoClient(uri, CLIENT_OPTIONS)
    try {
      await client.connect()
    } catch (err) {
      // Never cache a client that failed to connect: the assignment used to
      // happen before connect(), so one bad startup poisoned every later
      // invocation on that instance until Netlify recycled it.
      await client.close().catch(() => {})
      throw err
    }
    cachedClient = client
  }
  return cachedClient.db()
}

export async function getCollections() {
  const db = await getDb()
  return {
    words: db.collection<WordDoc>('words'),
    rules: db.collection<RuleDoc>('rules'),
    puzzles: db.collection<PuzzleDoc>('puzzles'),
    results: db.collection<ResultDoc>('results'),
    aiReviews: db.collection<AiReviewDoc>('aiReviews'),
  }
}
