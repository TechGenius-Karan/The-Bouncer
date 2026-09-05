// Replaces the static public/sitemap.xml, which could only ever list the home
// page. Every past puzzle is now its own indexable URL, and a sitemap that
// doesn't mention them leaves Google to find them by crawling links alone.
//
// Same spoiler cut-off as archive.ts: only dates strictly before today. A
// sitemap entry for today's puzzle would advertise the answer page before the
// day is over.

import { pastPuzzleFilter } from './_shared/archiveQuery'
import { renderSitemap } from './_shared/archiveView'
import { getCollections } from './_shared/db'
import { resolvePuzzleDateString } from './_shared/puzzleDate'

function xml(body: string): Response {
  return new Response(body, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=3600, s-maxage=86400',
    },
  })
}

export default async (): Promise<Response> => {
  const today = resolvePuzzleDateString()
  try {
    const { puzzles } = await getCollections()
    const docs = await puzzles
      .find(pastPuzzleFilter(today), { projection: { date: 1 } })
      .sort({ date: -1 })
      .toArray()
    return xml(renderSitemap(docs.map((d) => d.date as string)))
  } catch (err) {
    // A broken sitemap is worse than a small one: Google reports a fetch error
    // against the whole site rather than simply seeing fewer URLs. Fall back to
    // the two pages that always exist.
    console.error('sitemap: falling back to static entries', err)
    return xml(renderSitemap([]))
  }
}
