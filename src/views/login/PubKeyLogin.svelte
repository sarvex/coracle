<script lang="ts">
  import {toHex} from 'src/util/nostr'
  import Input from 'src/partials/Input.svelte'
  import Anchor from 'src/partials/Anchor.svelte'
  import Content from 'src/partials/Content.svelte'
  import Heading from 'src/partials/Heading.svelte'
  import {toast} from "src/app/ui"
  import {login} from "src/app"

  let npub = ''

  const logIn = () => {
    const pubkey = npub.startsWith('npub') ? toHex(npub) : npub

    if (!pubkey?.match(/[a-z0-9]{64}/)) {
      toast.show("error", "Sorry, but that's an invalid public key.")
    } else {
      login('pubkey', pubkey)
    }
  }
</script>


<Content size="lg" class="text-center">
  <Heading>Login with your Public Key</Heading>
  <p>
    For read-only access, enter your public key (or someone else's) below. Your
    key should start with "npub".
  </p>
  <div class="flex gap-2">
    <div class="flex-grow">
      <Input bind:value={npub} placeholder="npub...">
        <i slot="before" class="fa fa-key" />
      </Input>
    </div>
    <Anchor type="button" on:click={logIn}>Log In</Anchor>
  </div>
</Content>

