<script lang="ts">
  /** Accessible name; without it the icon is decorative. */
  export let label = ''
</script>

<svg
  class="lock-icon"
  viewBox="0 0 12 14"
  role={label ? 'img' : undefined}
  aria-label={label || undefined}
  aria-hidden={label ? undefined : 'true'}
  >{#if label}<title>{label}</title>{/if}<path
    d="M3.6 6.2V4.6a2.4 2.4 0 0 1 4.8 0v1.6"
  /><rect x="1.6" y="6.2" width="8.8" height="6.8" rx="1.6" /></svg
>

<style>
  .lock-icon {
    display: inline-block;
    width: 0.8em;
    height: 0.95em;
    flex-shrink: 0;
    vertical-align: -0.08em;
  }
  path {
    fill: none;
    stroke: currentColor;
    stroke-width: 1.6;
  }
  rect {
    fill: currentColor;
  }
</style>
