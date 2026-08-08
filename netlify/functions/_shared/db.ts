import { MongoClient, type Db } from 'mongodb'
import type { PuzzleDoc, ResultDoc, RuleDoc, WordDoc } from './types'

const uri: string = (() => {
  const value = process.env.MONGODB_URI
  if (!value) throw new Error('MONGODB_URI environment variable is not set')
  return value
})()

// Serverless functions can be invoked repeatedly against a warm container —
// caching the client across invocations avoids opening a fresh MongoDB
// connection (and exhausting Atlas's connection limit) on every request.
let cachedClient: MongoClient | null = null

async function getDb(): Promise<Db> {
  if (!cachedClient) {
    cachedClient = new MongoClient(uri)
    await cachedClient.connect()
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
  }
}
