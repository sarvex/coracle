<script lang="ts">
  import {prop} from 'ramda'
  import {nip19} from 'nostr-tools'
  import Content from 'src/partials/Content.svelte'
  import QRCode from 'src/partials/QRCode.svelte'
  import {getPubkeyWriteRelays} from 'src/agent/relays'

  export let person

  const {pubkey} = person
  const relays = [prop('url', getPubkeyWriteRelays(pubkey))]
  const nprofile = nip19.nprofileEncode({pubkey, relays})
</script>

<Content size="lg">
  <QRCode code={nprofile} />
  <div class="text-center text-light">
    Copy or scan from a nostr app to share this profile.
  </div>
</Content>
