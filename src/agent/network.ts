import type {MyEvent} from 'src/util/types'
import {assoc, uniq, uniqBy, prop, propEq, reject, groupBy, pluck} from 'ramda'
import {personKinds, findReplyId} from 'src/util/nostr'
import {log} from 'src/util/logger'
import {chunk} from 'hurdak/lib/hurdak'
import {batch, timedelta, now} from 'src/util/misc'
import {
  getRelaysForEventParent, getAllPubkeyWriteRelays, aggregateScores,
  getRelaysForEventChildren, sampleRelays,
} from 'src/agent/relays'
import database from 'src/agent/database'
import pool from 'src/agent/pool'
import sync from 'src/agent/sync'

const getStalePubkeys = pubkeys => {
  // If we're not reloading, only get pubkeys we don't already know about
  return uniq(pubkeys).filter(pubkey => {
    const p = database.people.get(pubkey)

    return !p || p.updated_at < now() - timedelta(1, 'days')
  })
}

const listen = ({relays, filter, onChunk = null, shouldProcess = true}) => {
  return pool.subscribe({
    filter,
    relays,
    onEvent: batch(300, chunk => {
      if (shouldProcess) {
        sync.processEvents(chunk)
      }

      if (onChunk) {
        onChunk(chunk)
      }
    }),
  })
}

const load = ({relays, filter, onChunk = null, shouldProcess = true, timeout = 6000}) => {
  return new Promise(resolve => {
    const now = Date.now()
    const done = new Set()
    const allEvents = []

    const attemptToComplete = async () => {
      const sub = await subPromise

      // If we've already unsubscribed we're good
      if (!sub.isActive()) {
        return
      }

      const isDone = done.size === relays.length
      const isTimeout = Date.now() - now >= timeout

      if (isTimeout) {
        const timedOutRelays = reject(r => done.has(r.url), relays)

        log(
          `Timing out ${timedOutRelays.length}/${relays.length} relays after ${timeout}ms`,
          timedOutRelays
        )

        timedOutRelays.forEach(relay => {
          const conn = pool.getConnection(relay.url)

          if (conn) {
            conn.stats.timeouts += 1
          }
        })
      }

      if (isDone || isTimeout) {
        sub.unsub()
        resolve(allEvents)
      }
    }

    // If a relay takes too long, give up
    setTimeout(attemptToComplete, timeout)

    const subPromise = pool.subscribe({
      relays,
      filter,
      onEvent: batch(300, chunk => {
        if (shouldProcess) {
          sync.processEvents(chunk)
        }

        if (onChunk) {
          onChunk(chunk)
        }

        for (const event of chunk) {
          allEvents.push(event)
        }
      }),
      onEose: url => {
        done.add(url)
        attemptToComplete()
      },
      onError: url => {
        done.add(url)
        attemptToComplete()
      },
    })
  }) as Promise<MyEvent[]>
}

const loadPeople = async (pubkeys, {relays = null, kinds = personKinds, force = false} = {}) => {
  pubkeys = uniq(pubkeys)

  // If we're not reloading, only get pubkeys we don't already know about
  if (!force) {
    pubkeys = getStalePubkeys(pubkeys)
  }

  await Promise.all(
    chunk(256, pubkeys).map(async chunk => {
      await load({
        relays: sampleRelays(relays || getAllPubkeyWriteRelays(chunk), 0.5),
        filter: {kinds, authors: chunk},
      })
    })
  )
}

const loadParents = (notes, opts = {}) => {
  const notesWithParent = notes.filter(findReplyId)

  if (notesWithParent.length === 0) {
    return []
  }

  return load({
    relays: sampleRelays(aggregateScores(notesWithParent.map(getRelaysForEventParent)), 0.3),
    filter: {kinds: [1], ids: notesWithParent.map(findReplyId)},
    ...opts,
  })
}

const streamContext = ({notes, onChunk, depth = 0}) =>
  // Some relays reject very large filters, send multiple subscriptions
  Promise.all(
    chunk(256, notes).map(async events => {
      // Instead of recurring to depth, trampoline so we can batch requests
      while (events.length > 0 && depth > 0) {
        const chunk = events.splice(0)
        const authors = getStalePubkeys(pluck('pubkey', chunk))
        const filter = [{kinds: [1, 7, 9735], '#e': pluck('id', chunk)}] as Array<object>
        const relays = sampleRelays(aggregateScores(chunk.map(getRelaysForEventChildren)))

        // Load authors and reactions in one subscription
        if (authors.length > 0) {
          filter.push({kinds: personKinds, authors})
        }

        depth -= 1

        const promise = load({relays, filter, onChunk})

        // Don't await the promise when we're on the last level, since we won't be
        // displaying those replies, and we await `load` before showing children
        // to reduce reflow
        if (depth > 0) {
          events = await promise
        }
      }
    })
  )

const applyContext = (notes, context) => {
  context = context.map(assoc('isContext', true))

  const replies = context.filter(propEq('kind', 1))
  const reactions = context.filter(propEq('kind', 7))
  const zaps = context.filter(propEq('kind', 9735))

  const repliesByParentId = groupBy(findReplyId, replies)
  const reactionsByParentId = groupBy(findReplyId, reactions)
  const zapsByParentId = groupBy(findReplyId, zaps)

  const annotate = ({replies = [], reactions = [], zaps = [], ...note}) => {
    const combinedReplies = replies.concat(repliesByParentId[note.id] || [])
    const combinedReactions = reactions.concat(reactionsByParentId[note.id] || [])
    const combinedZaps = zaps.concat(zapsByParentId[note.id] || [])

    return {
      ...note,
      replies: uniqBy(prop('id'), combinedReplies).map(annotate),
      reactions: uniqBy(prop('id'), combinedReactions),
      zaps: uniqBy(prop('id'), combinedZaps),
    }
  }

  return notes.map(annotate)
}

export default {
  listen, load, loadPeople, personKinds, loadParents, streamContext, applyContext,
}
