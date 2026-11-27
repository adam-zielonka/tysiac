<script lang="ts">
  import type { Card } from '../engine/Card'
  import CardElement from './CardElement.svelte'
  import type { CardTag } from './ui'

  /** Face-up cards, or `null` entries for face-down ones. */
  export let cards: readonly (Card | null)[]
  export let size: 'hand' | 'compact' = 'hand'
  export let interactive = false
  export let label = ''
  export let possible: (card: Card) => boolean = () => false
  export let dimmed: (card: Card) => boolean = () => false
  export let tag: (card: Card) => CardTag = () => null
  export let cardLabel: (card: Card) => string = card => card.text
  export let click: (card: Card) => void = () => {}

  $: items = cards.map((card, index) => ({ key: card ? card.id : `back-${index}`, card }))
  $: concealed = cards.every(card => card === null)
</script>

<div class="hand-wrap" role="group" aria-label={label || undefined}>
  <div
    class={`hand ${size}`}
    class:concealed
    style={`--count: ${Math.max(cards.length, 1)}`}
  >
    {#each items as item (item.key)}
      <span class="slot">
        <CardElement
          card={item.card}
          {interactive}
          possible={!!item.card && possible(item.card)}
          dimmed={!!item.card && dimmed(item.card)}
          tag={item.card ? tag(item.card) : null}
          label={item.card ? cardLabel(item.card) : ''}
          {click}
        />
      </span>
    {/each}
  </div>
</div>

<style>
  .hand-wrap {
    container-type: inline-size;
    width: 100%;
    min-width: 0;
    overflow-x: auto;
    overflow-y: hidden;
    overscroll-behavior-x: contain;
    scrollbar-width: thin;
    scrollbar-color: #789985 transparent;
  }
  /* The overlap follows the card count and the width actually available. */
  .hand {
    --card-w: 76px;
    --card-h: 108px;
    --max-slot: 50px;
    --min-slot: 20px;
    --pad: 6px;
    --fit: calc((100cqw - 2 * var(--pad) - var(--card-w)) / max(1, var(--count) - 1));
    --slot: clamp(var(--min-slot), var(--fit), var(--max-slot));
    display: flex;
    justify-content: center;
    width: max-content;
    min-width: 100%;
    padding: 24px var(--pad) 6px;
  }
  .slot {
    position: relative;
    flex: 0 0 var(--slot);
    width: var(--slot);
    min-width: 0;
  }
  .slot:last-child {
    flex-basis: var(--card-w);
    width: var(--card-w);
  }
  /* Only a playable card rises over its neighbour; a dimmed one would cover
     the corner and half the clickable strip of the next card. */
  .slot:has(:global(.playable)):hover,
  .slot:focus-within {
    z-index: 2;
  }
  .compact {
    --card-w: 45px;
    --card-h: 65px;
    --max-slot: 26px;
    --min-slot: 15px;
    --pad: 3px;
    padding-top: 6px;
    padding-bottom: 3px;
  }
  .compact.concealed {
    --max-slot: 15px;
    --min-slot: 5px;
  }
  @media (max-width: 760px) {
    .compact {
      --card-w: 37px;
      --card-h: 54px;
      --max-slot: 22px;
    }
    .compact.concealed {
      --max-slot: 11px;
    }
  }
  @media (max-width: 600px) {
    .hand:not(.compact) {
      --card-w: 62px;
      --card-h: 90px;
      --max-slot: 44px;
      --pad: 4px;
    }
  }
  @media (max-width: 380px) {
    .hand:not(.compact) {
      --card-w: 56px;
      --card-h: 82px;
      --max-slot: 40px;
      --pad: 2px;
    }
  }
</style>
