<script lang="ts">
  import {onMount} from 'svelte'
  import {partition, propEq, uniqBy, sortBy, prop} from 'ramda'
  import {slide} from 'svelte/transition'
  import {quantify} from 'hurdak/lib/hurdak'
  import {createScroller, now, Cursor} from 'src/util/misc'
  import {asDisplayEvent, mergeFilter} from 'src/util/nostr'
  import Spinner from 'src/partials/Spinner.svelte'
  import Content from 'src/partials/Content.svelte'
  import Note from "src/views/notes/Note.svelte"
  import user from 'src/agent/user'
  import network from 'src/agent/network'
  import {modal} from "src/app/ui"
  import {mergeParents} from "src/app"

  export let filter
  export let relays = []
  export let shouldDisplay = null
  export let parentsTimeout = 500

  let notes = []
  let notesBuffer = []

  const since = now()
  const maxNotes = 100
  const cursor = new Cursor()

  const processNewNotes = async newNotes => {
    newNotes = user.muffle(newNotes)

    if (shouldDisplay) {
      newNotes = newNotes.filter(shouldDisplay)
    }

    // Load parents before showing the notes so we have hierarchy. Give it a short
    // timeout, since this is really just a nice-to-have
    const combined = uniqBy(
      prop('id'),
      newNotes
        .filter(propEq('kind', 1))
        .concat(await network.loadParents(newNotes, {timeout: parentsTimeout}))
        .map(asDisplayEvent)
    )

    // Stream in additional data
    network.streamContext({
      depth: 2,
      notes: combined,
      onChunk: context => {
        notes = network.applyContext(notes, user.muffle(context))
      },
    })

    // Show replies grouped by parent whenever possible
    return mergeParents(combined)
  }

  const loadBufferedNotes = () => {
    // Drop notes at the end if there are a lot
    notes = uniqBy(
      prop('id'),
      notesBuffer.concat(notes).slice(0, maxNotes)
    )

    notesBuffer = []
  }


  const onChunk = async newNotes => {
    const chunk = sortBy(e => -e.created_at, await processNewNotes(newNotes))
    const [bottom, top] = partition(e => e.created_at < since, chunk)

    // Slice new notes in case someone leaves the tab open for a long time
    notes = uniqBy(prop('id'), notes.concat(bottom))
    notesBuffer = top.concat(notesBuffer).slice(0, maxNotes)

    cursor.update(notes)
  }

  onMount(() => {
    const sub = network.listen({relays, filter: mergeFilter(filter, {since}), onChunk})

    const scroller = createScroller(() => {
      if ($modal) {
        return
      }

      return network.load({relays, filter: mergeFilter(filter, cursor.getFilter()), onChunk})
    })

    return () => {
      scroller.stop()
      sub.then(s => s?.unsub())
    }
  })
</script>

<Content size="inherit" class="pt-6">
  {#if notesBuffer.length > 0}
  <button
    in:slide
    class="cursor-pointer text-center underline text-light"
    on:click={loadBufferedNotes}>
    Load {quantify(notesBuffer.length, 'new note')}
  </button>
  {/if}

  <div class="flex flex-col gap-4">
    {#each notes as note (note.id)}
    <Note depth={2} {note} />
    {/each}
  </div>

  <Spinner />
</Content>
