<script lang="ts">
  import { tr as tx } from '../i18n'
  import { store } from '../engine/Store'
  import { PlayerType } from '../engine/PlayerType'
  import LockIcon from './LockIcon.svelte'
  import { formatNumber, joinNames, matchEnd, seatNames, signed } from './ui'

  const { game } = store

  $: result = $game.deal?.result() ?? null
  /** The written record: deltas after the 800 lock. */
  $: record = $game.records.find(entry => entry.number === $game.dealNumber)
  $: deltas = record?.deltas ?? result?.deltas ?? [0, 0, 0]
  $: locked = record?.locked ?? [false, false, false]
  $: anyLocked = locked.some(Boolean)
  $: lockLabel = $tx('{score}+: punkty tylko jako rozgrywający', {
    score: $game.lockScore,
  })
  $: gameOver = $game.status === 'gameOver'
  $: names = seatNames($game.playersSelect, $tx)
  $: nameOf = (seat: number) => names[seat]
  $: humanWins =
    $game.winners.length === 1 &&
    $game.winners[0] === 0 &&
    $game.playersSelect[0] === PlayerType.Human
  $: winnerText = humanWins
    ? $tx('Wygrywasz partię!')
    : $game.winners.length > 1
      ? $tx('Remis: {names}', { names: joinNames($game.winners.map(nameOf), $tx) })
      : $tx('Partię wygrywa {name}', { name: nameOf($game.winners[0] ?? 0) })
  $: ending = gameOver && record ? matchEnd(record, $game.winners, $game.target) : null
  $: endingText = !ending
    ? ''
    : ending.kind === 'highest'
      ? $tx('Rozgrywający nie osiągnął {target}, więc wygrywa najwyższy wynik.', {
          target: $game.target,
        })
      : ending.rivals.length
        ? $tx(
            'Rozgrywający, który osiąga {target}, wygrywa — nawet gdy obrońca ma tyle samo lub więcej ({names}).',
            { target: $game.target, names: joinNames(ending.rivals.map(nameOf), $tx) },
          )
        : $tx('Rozgrywający osiąga {target} i wygrywa partię.', { target: $game.target })
</script>

{#if result}
  <div class="summary" class:game-over={gameOver}>
    <div class="summary-heading">
      <span class="caption-label"
        >{gameOver
          ? $tx('Koniec partii')
          : $tx('Koniec rozdania {number}', { number: $game.dealNumber })}</span
      >
      <strong
        >{result.declarer === 0 && $game.playersSelect[0] === PlayerType.Human
          ? $tx('Twój kontrakt: {value}', { value: result.contract })
          : $tx('{name} gra za {value}', {
              name: nameOf(result.declarer),
              value: result.contract,
            })}</strong
      >
      <span class="verdict" class:failed={!result.made}
        >{result.made
          ? $tx('✓ Kontrakt ugrany ({points} pkt)', {
              points: result.points[result.declarer],
            })
          : $tx('✗ Kontrakt nieugrany ({points} pkt)', {
              points: result.points[result.declarer],
            })}</span
      >
    </div>
    <table>
      <caption class="visually-hidden">{$tx('Wynik rozdania')}</caption>
      <thead>
        <tr>
          <th scope="col">{$tx('Gracz')}</th>
          <th scope="col">{$tx('Karty')}</th>
          <th scope="col">{$tx('Meldunki')}</th>
          <th scope="col">{$tx('Zapis')}</th>
          <th scope="col">{$tx('Razem')}</th>
        </tr>
      </thead>
      <tbody>
        {#each [0, 1, 2] as seat}
          <tr class:declarer={seat === result.declarer}>
            <th scope="row"
              >{nameOf(seat)}{#if seat === result.declarer}<span
                  class="star"
                  aria-hidden="true"
                >
                  ★</span
                ><span class="visually-hidden">
                  ({$tx('gra za {value}', { value: result.contract })})</span
                >{/if}</th
            >
            <td>{result.cardPoints[seat]}</td>
            <td>{result.meldPoints[seat] || '–'}</td>
            {#if locked[seat]}
              <td class="delta locked" title={lockLabel}
                ><span aria-hidden="true">0 <LockIcon /></span><span
                  class="visually-hidden">0, {lockLabel}</span
                ></td
              >
            {:else}
              <td
                class="delta"
                class:negative={deltas[seat] < 0}
                class:positive={deltas[seat] > 0}>{signed(deltas[seat])}</td
              >
            {/if}
            <td class="total" class:winner={gameOver && $game.winners.includes(seat)}
              >{formatNumber($game.scores[seat])}</td
            >
          </tr>
        {/each}
      </tbody>
    </table>
    {#if anyLocked}
      <p class="lock-note">
        <LockIcon />
        {$tx('{score}+: obrońca z co najmniej {score} pkt nie zapisuje punktów.', {
          score: $game.lockScore,
        })}
      </p>
    {/if}
    {#if gameOver}
      <p class="winner-text">{winnerText}</p>
      {#if endingText}<p class="ending-text">{endingText}</p>{/if}
      <button type="button" class="button primary" on:click={() => game.prepare()}
        >{$tx('Nowa partia')}</button
      >
    {:else}
      <button type="button" class="button primary" on:click={() => game.nextDeal()}
        >{$tx('Następne rozdanie')}</button
      >
    {/if}
  </div>
{/if}

<style>
  .summary {
    display: grid;
    justify-items: center;
    gap: 10px;
    width: min(100%, 360px);
    margin: 0 auto;
    padding: 12px 12px 14px;
    border: 1px solid #a8c8a744;
    border-radius: 12px;
    background: #0f2a20e6;
    box-shadow: 0 10px 30px #0004;
    animation: rise 220ms ease-out;
  }
  .summary-heading {
    display: grid;
    justify-items: center;
    gap: 2px;
    text-align: center;
  }
  .caption-label {
    color: #b8cbb8;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  strong {
    color: #f0f3e6;
    font-size: 15px;
    font-weight: 650;
  }
  .verdict {
    margin-top: 3px;
    padding: 2px 9px;
    border-radius: 6px;
    background: #c9e4a126;
    color: #d6ecb8;
    font-size: 13px;
    font-weight: 650;
  }
  .verdict.failed {
    background: #e2a4ad26;
    color: #f0b8bf;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
    font-variant-numeric: tabular-nums;
  }
  th,
  td {
    padding: 5px 4px;
    border-bottom: 1px solid #c5d3b51c;
    text-align: right;
    white-space: nowrap;
  }
  thead th {
    color: #a9bca9;
    font-size: 11px;
    font-weight: 600;
  }
  th:first-child {
    text-align: left;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 90px;
  }
  tbody th {
    color: #e2eadb;
    font-weight: 600;
    /* "Tosia (z lewej)" wraps instead of widening the table. */
    white-space: normal;
  }
  td {
    color: #c8d6c2;
  }
  .star {
    color: #f1dc8e;
  }
  .delta {
    font-weight: 650;
  }
  .positive {
    color: #cfe8b0;
  }
  .negative {
    color: #f0b0b8;
  }
  .delta.locked {
    color: #f1dc8e;
  }
  .delta.locked :global(.lock-icon) {
    margin-left: 2px;
  }
  .total {
    color: #f0f3e6;
    font-weight: 700;
  }
  .lock-note,
  .ending-text {
    margin: -2px 0 0;
    color: #c8d6c2;
    font-size: 12px;
    line-height: 17px;
    text-align: center;
  }
  .lock-note :global(.lock-icon) {
    color: #f1dc8e;
  }
  .total.winner {
    color: #f1dc8e;
  }
  .winner-text {
    margin: 0;
    color: #f1dc8e;
    font-size: 16px;
    font-weight: 700;
    text-align: center;
  }
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  @keyframes rise {
    from {
      opacity: 0;
      translate: 0 10px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .summary {
      animation: none;
    }
  }
</style>
