<script>
  import {fly} from 'svelte/transition'
  import {ellipsize, quantify, switcher} from 'hurdak/lib/hurdak'
  import Badge from "src/partials/Badge.svelte"
  import {formatTimestamp} from 'src/util/misc'
  import {killEvent} from 'src/util/html'
  import database from 'src/agent/database'
  import {modal} from 'src/app/ui'

  export let note
  export let type

  const pubkeys = switcher(type, {
    replies: note.repliesFrom,
    likes: note.likedBy,
    zaps: note.zappedBy,
  })

  const actionText = switcher(type, {
    replies: 'replied to your note',
    likes: 'liked your note',
    zaps: 'zapped your note',
  })

  let isOpen = false

  const openPopover = e => {
    killEvent(e)

    isOpen = true
  }

  const closePopover = e => {
    killEvent(e)

    isOpen = false
  }
</script>

<button
  class="py-2 px-3 flex flex-col gap-2 text-white cursor-pointer transition-all w-full
         border border-solid border-black hover:border-medium hover:bg-dark text-left"
  on:click={() => modal.set({type: 'note/detail', note})}>
  <div class="flex gap-2 items-center justify-between relative w-full">
    <button class="cursor-pointer" on:click={openPopover}>
      {quantify(pubkeys.length, 'person', 'people')} {actionText}.
    </button>
    {#if isOpen}
    <button in:fly={{y: 20}} class="fixed inset-0 z-10" on:click={closePopover} />
    <button
      on:click={killEvent}
      in:fly={{y: 20}}
      class="absolute top-0 mt-8 py-2 px-4 rounded border border-solid border-medium
             bg-dark grid grid-cols-2 gap-y-2 gap-x-4 z-20">
      {#each pubkeys as pubkey}
      <Badge person={database.getPersonWithFallback(pubkey)} />
      {/each}
    </button>
    {/if}
    <p class="text-sm text-light">{formatTimestamp(note.created_at)}</p>
  </div>
  <div class="ml-6 text-light">
    {ellipsize(note.content, 120)}
  </div>
</button>
