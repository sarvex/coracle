<script lang="ts">
  import {nip05, nip19} from "nostr-tools"
  import {toast} from "src/app/ui"
  import Content from "src/partials/Content.svelte"
  import RelayCard from "src/views/relays/RelayCard.svelte"
  import {copyToClipboard} from "src/util/html"
  import {warn} from "src/util/logger"
  import {onMount} from "svelte"
  import {fly} from "svelte/transition"

  export let person

  // local items
  let nip05ProfileData = null
  let nip05QueryEndpoint = null
  let nProfile = null
  let npub = nip19.npubEncode(person.pubkey)

  // local state
  let loaded = false

  onMount(() => {
    if (person && person.verified_as) {
      // get target URI
      nip05QueryEndpoint = getNip05QueryEndpoint(person.verified_as)

      // calculate nProfile from NIP05 data, if available
      nProfile = nip19.nprofileEncode({
        pubkey: person.pubkey,
        relays: person.relays,
      })

      // fetch data
      nip05
        .queryProfile(person.verified_as)
        .then((data) => {
          nip05ProfileData = data

          // recalculate nprofile using NIP05 relay data, if specified.
          // In theory, those *should* be the user's prefered relay set.
          if (nip05ProfileData?.relays?.length) {
            nProfile = nip19.nprofileEncode({
              pubkey: person.pubkey,
              relays: nip05ProfileData.relays,
            })
          }
        })
        .catch((err) => {
          warn("NIP05 profile retrieval failed")
        })
        .finally(() => {
          loaded = true
        })
    } else {
      loaded = true
    }
  })

  // Construct NIP05 URL from identifier.
  function getNip05QueryEndpoint(identifier) {
    if (!identifier) return null

    let name, domain

    if (identifier.match(/^.*@.*$/)) {
      [name, domain] = identifier.split("@")
    } else {
      // In case of no name (domain-only), mimick the reasonable
      // (but somewhat questionable) behaviour of nostr-tools/nip05,
      // which defaults the name value
      [name, domain] = ["_", identifier]
    }
    return `https://${domain}/.well-known/nostr.json?name=${name}`
  }

  // helper: clipboard & toast
  function copy(text) {
    copyToClipboard(text)
    toast.show("info", `Copied.`)
  }
</script>

<div in:fly={{y: 20}}>
  <Content>
    <h1 class="staatliches text-2xl">Profile Details</h1>
    <div>
      <div class="text-lg mb-1">Public Key (Hex)</div>
      <div class="text-sm font-mono">
        <button
          class="fa-solid fa-copy cursor-pointer"
          on:click={() => copy(person.pubkey)}
        />
        {person.pubkey}
      </div>
    </div>
    <div>
      <div class="text-lg mb-1">Public Key (npub)</div>
      <div class="text-sm font-mono">
        {#if npub}
          <button
            class="fa-solid fa-copy cursor-pointer"
            on:click={() => copy(npub)}
          />
        {/if}
        {npub}
      </div>
    </div>
    {#if nProfile}
    <div>
      <div class="text-lg mb-1">nprofile</div>
      <div class="text-sm font-mono break-all">
          <button
            class="fa-solid fa-copy cursor-pointer inline"
            on:click={() => copy(nProfile)}
          />
        {nProfile}
      </div>
    </div>
    {/if}
    <h1 class="staatliches text-2xl mt-4">NIP05</h1>
    {#if loaded && person.verified_as}
      <div>
        <div class="text-lg mb-1">NIP05 Identifier</div>
        <div class="text-sm font-mono">
          {#if person.verified_as}
            <button
              class="fa-solid fa-copy cursor-pointer inline"
              on:click={() => copy(person.verified_as)}
            />
          {/if}
          {person.verified_as || "?"}
        </div>
      </div>

      <div>
        <div class="text-lg mb-1">NIP05 Validation Endpoint</div>
        <div class="text-sm font-mono">
          {#if nip05QueryEndpoint}
            <button
              class="fa-solid fa-copy cursor-pointer inline"
              on:click={() => copy(nip05QueryEndpoint)}
            />
          {/if}

          {nip05QueryEndpoint || "?"}
        </div>
      </div>

      {#if nip05ProfileData}
        <div>
          <div class="text-lg mb-2">NIP05 Relay Configuration</div>
          {#if nip05ProfileData?.relays?.length}
            <p class="text-sm mb-4 text-light">
              These relays are advertised by the NIP05 identifier's validation endpoint.
            </p>

            <div class="grid grid-cols-1 gap-4">
              {#each nip05ProfileData?.relays as url}
              <RelayCard relay={{url}} />
              {/each}
            </div>
          {:else}
            <p class="text-sm mb-4 text-light">
              <i class="fa-solid fa-info-circle" />
              No relays are advertised by the NIP05 identifier's validation endpoint.
            </p>
          {/if}
        </div>
      {:else}
        <p>
          <i class="fa-solid fa-warning text-warning mr-2" />
          Could not fetch NIP05 data.
        </p>
      {/if}
    {:else}
      <p class="text-sm mb-4 text-light">
        <i class="fa-solid fa-info-circle" />
        NIP05 identifier not available.
      </p>
    {/if}
  </Content>
</div>
