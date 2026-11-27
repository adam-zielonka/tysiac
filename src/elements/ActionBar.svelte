<script lang="ts">
  import { tr } from '../i18n'
  import { store } from '../engine/Store'
  import { nextSeat } from '../engine/rules'
  import type { Action } from '../engine/Deal'
  import { nearestOption, seatNames, stepOption } from './ui'

  const { game } = store
  /** Recipient of the next card in the giving phase (shared with the hand). */
  export let giftTarget = -1
  /** Called after every action, e.g. to keep keyboard focus nearby. */
  export let afterAct: () => void = () => {}

  let bidValue = 0
  let contractValue = 0
  let bidKey = ''
  let contractKey = ''

  $: deal = $game.deal
  $: phase = deal?.phase
  $: humanTurn =
    $game.status === 'playing' && $game.turn === 0 && $game.players[0].isHuman && !!deal
  $: names = seatNames($game.playersSelect, $tr)
  $: nameOf = (seat: number) => names[seat]
  $: bidOptions = humanTurn && phase === 'bidding' ? deal!.bidOptions() : []
  $: contractOptions = humanTurn && phase === 'contract' ? deal!.contractOptions() : []
  $: resetBid(bidOptions)
  $: resetContract(contractOptions)
  $: recipients =
    humanTurn && phase === 'giving'
      ? [nextSeat(deal!.declarer), nextSeat(deal!.declarer, 2)]
      : []
  $: pending = humanTurn && phase === 'giving' ? deal!.pendingRecipients() : []
  $: if (pending.length && !pending.includes(giftTarget)) giftTarget = pending[0]
  $: giftOf = (seat: number) => deal?.s.gifts.find(gift => gift.to === seat)?.card

  /** Start each decision from the smallest legal value. */
  function resetBid(options: number[]): void {
    const key = options.join(',')
    if (key === bidKey) return
    bidKey = key
    bidValue = options[0] ?? 0
  }

  function resetContract(options: number[]): void {
    const key = options.join(',')
    if (key === contractKey) return
    contractKey = key
    contractValue = options[0] ?? 0
  }

  function act(action: Action): void {
    game.act(0, action)
    afterAct()
  }

  function bid(): void {
    if (!bidOptions.length) return
    act({ type: 'bid', value: nearestOption(bidOptions, bidValue) })
  }

  function contract(): void {
    if (!contractOptions.length) return
    act({ type: 'contract', value: nearestOption(contractOptions, contractValue) })
  }
</script>

<div class="hand-actions">
  {#if humanTurn && phase === 'bidding'}
    <button type="button" class="button subtle" on:click={() => act({ type: 'pass' })}
      >{$tr('Pas')}</button
    >
    <div class="stepper" role="group" aria-label={$tr('Wysokość licytacji')}>
      <button
        type="button"
        aria-label={$tr('Mniej o 10')}
        aria-disabled={!bidOptions.length || bidValue <= bidOptions[0]}
        on:click={() => (bidValue = stepOption(bidOptions, bidValue, -1))}>−</button
      >
      <output aria-live="polite">{bidOptions.length ? bidValue : '—'}</output>
      <button
        type="button"
        aria-label={$tr('Więcej o 10')}
        aria-disabled={!bidOptions.length || bidValue >= (bidOptions.at(-1) ?? 0)}
        on:click={() => (bidValue = stepOption(bidOptions, bidValue, 1))}>+</button
      >
    </div>
    <button
      type="button"
      class="button primary"
      disabled={!bidOptions.length}
      on:click={bid}
      >{bidOptions.length
        ? $tr('Licytuj {value}', { value: bidValue })
        : $tr('Licytuj')}</button
    >
  {:else if humanTurn && phase === 'musik'}
    <button type="button" class="button primary" on:click={() => act({ type: 'take' })}
      >{$tr('Weź musik')}</button
    >
  {:else if humanTurn && phase === 'giving'}
    <div class="recipients" role="group" aria-label={$tr('Komu oddać kartę')}>
      <span class="recipients-label">{$tr('Oddaj kartę:')}</span>
      {#each recipients as seat (seat)}
        {@const given = giftOf(seat)}
        <button
          type="button"
          class="recipient"
          class:given={!!given}
          aria-pressed={!given && giftTarget === seat}
          disabled={!!given}
          on:click={() => (giftTarget = seat)}
          >{nameOf(seat)}{#if given}<span class="given-card">
              ✓ {given.text}</span
            >{/if}</button
        >
      {/each}
    </div>
  {:else if humanTurn && phase === 'contract'}
    <div class="stepper" role="group" aria-label={$tr('Wysokość kontraktu')}>
      <button
        type="button"
        aria-label={$tr('Mniej o 10')}
        aria-disabled={contractValue <= (contractOptions[0] ?? 0)}
        on:click={() => (contractValue = stepOption(contractOptions, contractValue, -1))}
        >−</button
      >
      <output aria-live="polite">{contractValue}</output>
      <button
        type="button"
        aria-label={$tr('Więcej o 10')}
        aria-disabled={contractValue >= (contractOptions.at(-1) ?? 0)}
        on:click={() => (contractValue = stepOption(contractOptions, contractValue, 1))}
        >+</button
      >
    </div>
    <button type="button" class="button primary" on:click={contract}
      >{$tr('Graj za {value}', { value: contractValue })}</button
    >
  {/if}
</div>

<style>
  .hand-actions {
    display: flex;
    justify-content: flex-end;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    min-height: 46px;
    padding-top: 2px;
  }
  .hand-actions .button {
    min-height: 44px;
    min-width: 44px;
    padding: 10px 14px;
    font-size: 14px;
    line-height: 20px;
  }
  .stepper {
    display: inline-flex;
    align-items: stretch;
    height: 44px;
    border: 1px solid #8baf8580;
    border-radius: 7px;
    overflow: hidden;
    background: #c0d7aa0b;
  }
  .stepper button {
    width: 44px;
    border: 0;
    background: transparent;
    color: #e2eedb;
    font-size: 20px;
    line-height: 1;
    cursor: pointer;
  }
  /* aria-disabled keeps focus on a button at the end of the range (stepping
     further does nothing), where a disabled button would drop it. */
  .stepper button:hover:not([aria-disabled='true']) {
    background: #304333;
  }
  .stepper button[aria-disabled='true'] {
    opacity: 0.35;
    cursor: default;
  }
  .stepper button:focus-visible {
    outline-offset: -3px;
  }
  .stepper output {
    display: grid;
    place-items: center;
    min-width: 48px;
    border-inline: 1px solid #8baf8544;
    color: #f6f1d8;
    font:
      600 17px Georgia,
      serif;
    font-variant-numeric: tabular-nums;
  }
  .recipients {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
  }
  .recipients-label {
    color: #c8d7b9;
    font-size: 14px;
  }
  .recipient {
    min-height: 44px;
    padding: 8px 14px;
    border: 1px solid #637b5b;
    border-radius: 7px;
    background: transparent;
    color: #c8d4bb;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }
  .recipient[aria-pressed='true'] {
    background: #d1dfb4;
    color: #233629;
    border-color: #d1dfb4;
  }
  .recipient:not([aria-pressed='true']):not(:disabled):hover {
    background: #304333;
  }
  .recipient.given {
    border-style: dashed;
    cursor: default;
    color: #a9bca9;
  }
  .given-card {
    font-weight: 500;
  }
  @media (max-width: 760px) {
    .hand-actions {
      justify-content: center;
      gap: 6px;
    }
    .hand-actions .button {
      padding-inline: 12px;
    }
    .recipients {
      justify-content: center;
    }
  }
</style>
