<script lang="ts">
  import cx from "classnames"

  export let initialValue: string | number = ""
  export let wrapperClass = ""
  export let value = initialValue

  const className = cx(
    $$props.class,
    "rounded bg-light shadow-inset py-2 px-4 pr-10 text-black w-full placeholder:text-placeholder",
    {"pl-10": $$slots.before, "pr-10": $$slots.after},
  )
</script>

<div class={cx(wrapperClass, "relative")}>
  <input {...$$props} class={className} bind:value on:change on:input />
  {#if $$slots.before}
  <div class="absolute top-0 left-0 pt-3 px-3 text-dark flex gap-2">
    <slot name="before" />
  </div>
  {/if}
  {#if $$slots.after}
  <div class="absolute top-0 right-0 pt-3 px-3 text-dark flex gap-2 bg-light rounded m-px">
    <slot name="after" />
  </div>
  {/if}
</div>
