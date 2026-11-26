<script lang="ts">
  import { tr } from '../i18n'
  import type { Card } from '../engine/Card'
  import type { CardTag } from './ui'

  /** `null` renders a face-down card without revealing its identity. */
  export let card: Card | null
  /** Interactive cards are buttons; table cards are plain images. */
  export let interactive = false
  export let possible = false
  export let dimmed = false
  export let highlight = false
  /** Small label above the card, e.g. a marriage bonus "+100". */
  export let tag: CardTag = null
  export let label = ''
  export let click: (card: Card) => void = () => {}

  $: hidden = card === null
  $: ariaLabel = hidden ? $tr('Zakryta karta') : label || card!.text
</script>

{#if interactive}
  <button
    type="button"
    class="card"
    class:back={hidden}
    class:playable={!hidden && possible}
    class:dimmed
    class:highlight
    class:red={card?.colorStyle === 'red'}
    disabled={hidden || !possible}
    aria-label={ariaLabel}
    on:click={() => card && click(card)}
  >
    {#if tag}<span class={`tag ${tag.kind}`} aria-hidden="true">{tag.text}</span>{/if}
    {#if card}
      <span class="corner" aria-hidden="true"
        ><b>{card.figureText}</b><span>{card.colorText}</span></span
      >
      <span class="suit" aria-hidden="true">{card.colorText}</span>
      <span class="corner bottom" aria-hidden="true"
        ><b>{card.figureText}</b><span>{card.colorText}</span></span
      >
    {:else}
      <span class="back-pattern"><span>♥</span></span>
    {/if}
  </button>
{:else}
  <span
    class="card"
    class:back={hidden}
    class:dimmed
    class:highlight
    class:red={card?.colorStyle === 'red'}
    role="img"
    aria-label={ariaLabel}
  >
    {#if tag}<span class={`tag ${tag.kind}`} aria-hidden="true">{tag.text}</span>{/if}
    {#if card}
      <span class="corner" aria-hidden="true"
        ><b>{card.figureText}</b><span>{card.colorText}</span></span
      >
      <span class="suit" aria-hidden="true">{card.colorText}</span>
      <span class="corner bottom" aria-hidden="true"
        ><b>{card.figureText}</b><span>{card.colorText}</span></span
      >
    {:else}
      <span class="back-pattern" aria-hidden="true"><span>♥</span></span>
    {/if}
  </span>
{/if}

<style>
  /* Size comes from the container through --card-w and --card-h. */
  .card {
    --w: var(--card-w, 76px);
    position: relative;
    display: block;
    width: var(--w);
    height: var(--card-h, 108px);
    padding: 0;
    flex-shrink: 0;
    border: 1px solid #d9d9cd;
    border-radius: calc(var(--w) * 0.105);
    background: linear-gradient(140deg, #fffef8, #efeee5);
    color: #26322f;
    box-shadow:
      0 3px 5px #0003,
      inset 0 0 0 3px #fff5;
    font-family: Georgia, 'Times New Roman', serif;
    opacity: 1;
    text-align: left;
    transition:
      transform 160ms,
      box-shadow 160ms,
      filter 160ms;
  }
  .red {
    color: #be494b;
  }
  .corner {
    position: absolute;
    top: calc(var(--w) * 0.07);
    left: calc(var(--w) * 0.075);
    display: flex;
    flex-direction: column;
    align-items: center;
    font-size: clamp(9px, calc(var(--w) * 0.2), 16px);
    line-height: 1.05;
  }
  .corner b {
    font-size: clamp(11px, calc(var(--w) * 0.24), 18px);
    font-weight: 600;
    letter-spacing: -0.04em;
  }
  .bottom {
    inset: auto calc(var(--w) * 0.075) calc(var(--w) * 0.07) auto;
    transform: rotate(180deg);
  }
  .suit {
    display: grid;
    place-items: center;
    height: 100%;
    font-size: calc(var(--w) * 0.55);
  }
  .playable {
    cursor: pointer;
    border-color: #b9e7c9;
    box-shadow:
      0 0 0 2px #b2e3c657,
      0 5px 12px #0003;
  }
  .playable:hover,
  .playable:focus-visible {
    transform: translateY(-8px);
    box-shadow:
      0 0 0 2px #bceace,
      0 12px 22px #0004;
    outline: none;
  }
  .dimmed {
    filter: brightness(0.72) saturate(0.7);
  }
  .highlight {
    border-color: #f2e6a7;
    box-shadow:
      0 0 0 3px #e9d98299,
      0 8px 18px #0005;
  }
  .tag {
    position: absolute;
    z-index: 3;
    bottom: calc(100% + 3px);
    left: -2px;
    padding: 1px 5px;
    border-radius: 6px;
    background: #f1dc8e;
    color: #3d3214;
    box-shadow: 0 2px 4px #0004;
    font:
      700 11px/16px 'DM Sans',
      system-ui,
      sans-serif;
    white-space: nowrap;
    pointer-events: none;
  }
  /* Narrow hands overlap a lot: notes shrink to a dot, bonuses to small print. */
  @media (max-width: 600px) {
    .tag {
      padding: 0 3px;
      font-size: 10px;
      line-height: 14px;
    }
    .tag.note {
      left: 3px;
      width: 9px;
      height: 9px;
      padding: 0;
      border-radius: 50%;
      font-size: 0;
    }
  }
  .back {
    padding: calc(var(--w) * 0.066);
    background: #d2d5c9;
    border-color: #9cafa5;
  }
  .back-pattern {
    display: grid;
    place-items: center;
    height: 100%;
    border-radius: calc(var(--w) * 0.05);
    border: 1px solid #a4bdac;
    background-color: #294c45;
    background-image:
      repeating-linear-gradient(
        45deg,
        transparent,
        transparent 5px,
        #b0d8bd14 5px,
        #b0d8bd14 6px
      ),
      repeating-linear-gradient(
        -45deg,
        transparent,
        transparent 5px,
        #b0d8bd14 5px,
        #b0d8bd14 6px
      );
  }
  .back-pattern > span {
    display: grid;
    place-items: center;
    width: calc(var(--w) * 0.37);
    height: calc(var(--w) * 0.46);
    border: 1px solid #a2b98d99;
    border-radius: 50%;
    color: #d5b9ae;
    font-size: calc(var(--w) * 0.26);
    background: #294c45;
  }
  @media (prefers-reduced-motion: reduce) {
    .card {
      transition: none;
    }
  }
</style>
