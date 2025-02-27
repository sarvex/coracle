<script lang="ts">
  import {last} from 'ramda'
  import {onMount} from 'svelte'
  import {tweened} from 'svelte/motion'
  import {fly, fade} from 'svelte/transition'
  import {navigate} from 'svelte-routing'
  import {log} from 'src/util/logger'
  import {renderContent} from 'src/util/html'
  import {displayPerson, Tags, toHex} from 'src/util/nostr'
  import Tabs from "src/partials/Tabs.svelte"
  import Content from "src/partials/Content.svelte"
  import Anchor from "src/partials/Anchor.svelte"
  import Spinner from "src/partials/Spinner.svelte"
  import NewNoteButton from "src/views/notes/NewNoteButton.svelte"
  import Notes from "src/views/person/Notes.svelte"
  import Likes from "src/views/person/Likes.svelte"
  import Relays from "src/views/person/Relays.svelte"
  import user from "src/agent/user"
  import {sampleRelays, getPubkeyWriteRelays} from "src/agent/relays"
  import network from "src/agent/network"
  import database from "src/agent/database"
  import {routes, modal} from "src/app/ui"

  export let npub
  export let activeTab
  export let relays = []

  const interpolate = (a, b) => t => a + Math.round((b - a) * t)
  const {petnamePubkeys, canPublish} = user
  const getRelays = () => sampleRelays(relays.concat(getPubkeyWriteRelays(pubkey)))

  let pubkey = toHex(npub)
  let following = false
  let followers = new Set()
  let followersCount = tweened(0, {interpolate, duration: 1000})
  let person = database.getPersonWithFallback(pubkey)
  let loading = true
  let showActions = false
  let actions = []

  $: following = $petnamePubkeys.includes(pubkey)

  $: {
    actions = []

    if (showActions) {
      actions.push({onClick: share, label: 'Share', icon: 'share-nodes'})

      if (following) {
        actions.push({onClick: unfollow, label: 'Unfollow', icon: 'user-minus'})
      } else if (user.getPubkey() !== pubkey) {
        actions.push({onClick: follow, label: 'Follow', icon: 'user-plus'})
      }

      if ($canPublish) {
        actions.push({onClick: () => navigate(`/messages/${npub}`), label: 'Message', icon: 'envelope'})
        actions.push({onClick: openAdvanced, label: 'Advanced', icon: 'sliders'})
      }

      actions.push({onClick: openProfileInfo, label: 'Profile', icon: 'info'})

      if (user.getPubkey() === pubkey && $canPublish) {
        actions.push({onClick: () => navigate('/profile'), label: 'Edit', icon: 'edit'})
      }
    }
  }


  onMount(async () => {
    log('Person', npub, person)

    document.title = displayPerson(person)

    // Refresh our person
    network.loadPeople([pubkey], {force: true}).then(() => {
      person = database.getPersonWithFallback(pubkey)
      loading = false
    })

    // Prime our followers count
    database.people.all().forEach(p => {
      if (Tags.wrap(p.petnames).type("p").values().all().includes(pubkey)) {
        followers.add(p.pubkey)
        followersCount.set(followers.size)
      }
    })

    // Round out our followers count
    await network.load({
      shouldProcess: false,
      relays: getRelays(),
      filter: [{kinds: [3], '#p': [pubkey]}],
      onChunk: events => {
        for (const e of events) {
          followers.add(e.pubkey)
        }

        followersCount.set(followers.size)
      },
    })
  })

  const toggleActions = () => {
    showActions = !showActions
  }

  const setActiveTab = tab => navigate(routes.person(pubkey, tab))

  const showFollows = () => {
    const pubkeys = Tags.wrap(person.petnames).pubkeys()

    modal.set({type: 'person/list', pubkeys})
   }

  const showFollowers = () => {
    modal.set({type: 'person/list', pubkeys: Array.from(followers)})
   }

  const follow = async () => {
    const [{url}] = getRelays()

    user.addPetname(pubkey, url, displayPerson(person))
  }

  const unfollow = async () => {
    user.removePetname(pubkey)
  }

  const openAdvanced = () => {
    modal.set({type: 'person/settings', person})
  }

  const openProfileInfo = () => {
    modal.set({type: 'person/info', person})
  }

  const share = () => {
    modal.set({type: 'person/share', person})
  }
</script>

<svelte:window on:click={() => { showActions = false }} />

<div
  class="absolute w-full h-64"
  style="z-index: -1;
         background-size: cover;
         background-image:
          linear-gradient(to bottom, rgba(0, 0, 0, 0.3), #0f0f0e),
          url('{person.kind0?.banner}')" />

<Content>
  <div class="flex gap-4">
    <div
      class="overflow-hidden w-16 h-16 sm:w-32 sm:h-32 rounded-full bg-cover bg-center shrink-0 border border-solid border-white"
      style="background-image: url({person.kind0?.picture})" />
    <div class="flex flex-col gap-4 flex-grow">
      <div class="flex justify-between items-start gap-4">
        <div class="flex-grow flex flex-col gap-2">
          <div class="flex items-center gap-2">
            <h1 class="text-2xl">{displayPerson(person)}</h1>
          </div>
          {#if person.verified_as}
          <div class="flex gap-1 text-sm">
            <i class="fa fa-user-check text-accent" />
            <span class="text-light">{last(person.verified_as.split('@'))}</span>
          </div>
          {/if}
        </div>
        <div class="whitespace-nowrap flex gap-3 flex-wrap relative">
          <div on:click|stopPropagation={toggleActions} class="px-5 py-2 cursor-pointer">
            <i class="fa fa-xl fa-ellipsis-vertical" />
          </div>
          <div class="absolute top-0 right-0 mt-12 flex flex-col gap-2 opacity-90 z-10">
            <div
              class="absolute inset-0 bg-black rounded-full"
              class:hidden={!showActions}
              style="filter: blur(15px)"
              transition:fade|local />
            {#each actions as {onClick, href, label, icon}, i}
            <div
              class="flex gap-2 justify-end items-center z-10 cursor-pointer"
              in:fly|local={{y: 20, delay: i * 30}}
              out:fly|local={{y: 20, delay: (actions.length - i - 1) * 30}}
              on:click={onClick}>
              <div class="text-light">{label}</div>
              <Anchor type="button-circle">
                <i class={`fa fa-${icon}`} />
              </Anchor>
            </div>
            {/each}
          </div>
        </div>
      </div>
      <p>{@html renderContent(person?.kind0?.about || '')}</p>
      {#if person?.petnames}
      <div class="flex gap-8" in:fly={{y: 20}}>
        <button on:click={showFollows}>
          <strong>{person.petnames.length}</strong> following
        </button>
        <button on:click={showFollowers}>
          <strong>{$followersCount}</strong> followers
        </button>
      </div>
      {/if}
    </div>
  </div>

  <Tabs tabs={['notes', 'likes', 'relays']} {activeTab} {setActiveTab} />

  {#if activeTab === 'notes'}
  <Notes {pubkey} />
  {:else if activeTab === 'likes'}
  <Likes {pubkey} />
  {:else if activeTab === 'relays'}
    {#if person?.relays}
    <Relays person={person} />
    {:else if loading}
    <Spinner />
    {:else}
    <Content size="lg" class="text-center">
      Unable to show network for this person.
    </Content>
    {/if}
  {/if}
</Content>

<NewNoteButton {pubkey} />
