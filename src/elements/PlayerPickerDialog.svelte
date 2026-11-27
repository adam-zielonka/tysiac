<script lang="ts">
  import { tr } from '../i18n'
  import { BOT_TYPES, PlayerType } from '../engine/PlayerType'
  import { strategies } from '../engine/strategies'
  import PlayerAvatar from './PlayerAvatar.svelte'

  export let enabled = true
  export let seat = 0
  export let player: PlayerType = PlayerType.Human
  export let select: (type: PlayerType) => void = () => {}

  let dialog: HTMLDialogElement

  /** Only the bottom seat may be you; every seat may be a bot. */
  $: players = seat === 0 ? [PlayerType.Human, ...BOT_TYPES] : [...BOT_TYPES]
  $: titleId = `player-picker-title-${seat}`
  $: descriptionId = `player-picker-description-${seat}`

  export function show(): void {
    if (!enabled) return
    if (!dialog.open) dialog.showModal()
    dialog.scrollTop = 0
  }

  export function close(): void {
    dialog?.close()
  }

  function choose(type: PlayerType): void {
    if (!enabled) return
    select(type)
    dialog.close()
  }
</script>

<dialog bind:this={dialog} aria-labelledby={titleId} aria-describedby={descriptionId}>
  <div class="dialog-heading">
    <h2 id={titleId}>{$tr('Wybierz gracza · fotel {seat}', { seat: seat + 1 })}</h2>
    <button
      type="button"
      class="close-button"
      on:click={() => dialog.close()}
      aria-label={$tr('Zamknij wybór gracza')}>×</button
    >
  </div>
  <p class="dialog-description" id={descriptionId}>
    {seat === 0
      ? $tr('Kliknij kafelek, aby wybrać gracza. Wybierz bota, aby obserwować grę.')
      : $tr('Kliknij kafelek, aby wybrać gracza.')}
  </p>
  <div class="strategy-grid">
    {#each players as type (type)}
      {@const strategy = strategies[type]}
      {@const id = `picker-${seat}-${type}`}
      <div
        class="strategy-option"
        class:seat-option={type === PlayerType.Human}
        class:chosen={player === type}
      >
        <button
          type="button"
          class="strategy-card"
          aria-pressed={player === type}
          aria-label={`${$tr(strategy.name)}, ${$tr(strategy.method)}`}
          aria-describedby={`${id}-summary ${id}-knowledge`}
          on:click={() => choose(type)}
        >
          <span class="strategy-heading">
            <PlayerAvatar {type} />
            <span class="identity">
              <span class="name">{$tr(strategy.name)}</span>
              <span class="method">{$tr(strategy.method)}</span>
            </span>
            {#if player === type}
              <span class="selected" aria-hidden="true">{$tr('Wybrany')}</span>
            {/if}
          </span>
          <span class="description" id={`${id}-summary`}>{$tr(strategy.summary)}</span>
          <span
            class="knowledge"
            class:full-knowledge={type === PlayerType.AZ}
            id={`${id}-knowledge`}
          >
            {$tr(strategy.information)}
          </span>
        </button>
        {#if strategy.description !== strategy.summary}
          <details class="details">
            <summary aria-label={$tr('Szczegóły: {name}', { name: $tr(strategy.name) })}
              >{$tr('Szczegóły')}</summary
            >
            <p>{$tr(strategy.description)}</p>
          </details>
        {/if}
      </div>
    {/each}
  </div>
</dialog>

<style>
  dialog {
    width: min(1080px, calc(100% - 32px));
    max-height: calc(100dvh - 32px);
    padding: 0 20px 20px;
    overflow: auto;
    overscroll-behavior: contain;
    color: var(--text);
    background: #1a2921;
    border: 1px solid #60785c;
    border-radius: 16px;
    box-shadow: 0 20px 80px #0006;
  }
  dialog::backdrop {
    background: #07110dd9;
  }
  .dialog-heading {
    position: sticky;
    top: 0;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 0;
    background: #1a2921;
    border-bottom: 1px solid var(--line);
  }
  h2 {
    margin: 0;
    font-size: 19px;
    font-weight: 550;
    line-height: 1.4;
  }
  .close-button {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 44px;
    height: 44px;
    padding: 0;
    color: var(--text);
    background: transparent;
    border: 1px solid var(--line);
    border-radius: 8px;
    font: inherit;
    font-size: 26px;
    cursor: pointer;
  }
  .close-button:hover {
    background: #304333;
  }
  .dialog-description {
    margin: 10px 0;
    color: #b2c0a8;
    font-size: 14px;
    line-height: 1.6;
  }
  .strategy-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
    gap: 12px;
  }
  /* The tile: the choice button and, below it, the full description. */
  .strategy-option {
    display: flex;
    flex-direction: column;
    min-width: 0;
    background: #23362a;
    border: 1px solid var(--line);
    border-radius: 10px;
    transition:
      background 150ms,
      border-color 150ms;
  }
  .strategy-option:has(.strategy-card:hover) {
    background: #304333;
    border-color: #829576;
  }
  .strategy-option.chosen {
    background: #2b4030;
    border-color: #c5dda9;
    box-shadow: inset 0 0 0 1px #c5dda9;
  }
  .strategy-card {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
    min-height: 44px;
    padding: 14px;
    color: var(--text);
    background: transparent;
    border: 0;
    border-radius: 10px;
    font: inherit;
    text-align: left;
    overflow-wrap: anywhere;
    cursor: pointer;
  }
  /* The tile's button already has bottom padding above the details. */
  .strategy-card:has(+ .details) {
    padding-bottom: 4px;
  }
  .details {
    margin: 0 14px 4px;
    color: #b2c0a8;
    font-size: 13px;
    line-height: 1.5;
  }
  .details summary {
    display: flex;
    align-items: center;
    gap: 6px;
    width: fit-content;
    min-height: 44px;
    color: #c8d7b9;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    list-style: none;
  }
  .details summary::-webkit-details-marker {
    display: none;
  }
  .details summary::before {
    content: '▸';
    color: #9fb29e;
  }
  .details[open] summary::before {
    content: '▾';
  }
  .details summary:focus-visible {
    outline: 2px solid #c5dda9;
    outline-offset: 2px;
    border-radius: 4px;
  }
  .details p {
    margin: 0;
    overflow-wrap: anywhere;
  }
  button:focus-visible {
    outline: 2px solid #c5dda9;
    outline-offset: 4px;
  }
  .strategy-heading {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
  }
  .identity {
    flex: 1;
    min-width: 100px;
  }
  .name,
  .method {
    display: block;
  }
  .name {
    margin-bottom: 4px;
    font-size: 18px;
    font-weight: 550;
  }
  .method,
  .knowledge {
    color: #b6c9a6;
    font-size: 12px;
    line-height: 1.5;
  }
  .selected {
    padding: 4px 7px;
    color: #233629;
    background: #d1dfb4;
    border-radius: 5px;
    font-size: 12px;
    font-weight: 650;
  }
  .description {
    flex: 1;
    color: #b2c0a8;
    font-size: 14px;
    line-height: 1.5;
  }
  .knowledge {
    width: 100%;
    padding-top: 10px;
    border-top: 1px solid var(--line);
  }
  .full-knowledge {
    padding: 8px 10px;
    color: #e2c9f4;
    background: #c9b0e114;
    border: 1px solid #c9b0e14d;
    border-radius: 6px;
    font-weight: 650;
  }
  @media (min-width: 601px) {
    .seat-option {
      grid-column: 1 / -1;
    }
    .seat-option .strategy-card {
      display: grid;
      grid-template-columns: minmax(200px, 1fr) 2fr;
      gap: 4px 16px;
      align-items: center;
    }
    .seat-option .strategy-heading {
      grid-row: span 2;
    }
    .seat-option .knowledge {
      padding-top: 0;
      border-top: 0;
    }
  }
  @media (min-width: 1000px) {
    .strategy-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }
  @media (max-width: 600px) {
    dialog {
      padding: 0 16px 16px;
    }
    .strategy-card {
      padding: 12px;
    }
    .details {
      margin-inline: 12px;
    }
    .strategy-grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .strategy-option {
      transition: none;
    }
  }
</style>
