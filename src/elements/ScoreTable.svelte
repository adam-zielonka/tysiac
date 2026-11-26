<script lang="ts">
  import { tr as tx } from '../i18n'
  import { store } from '../engine/Store'
  import { strategies } from '../engine/strategies'
  import { formatNumber, signed } from './ui'

  const { game } = store

  $: nameOf = (seat: number) => $tx(strategies[$game.playersSelect[seat]].name)
  $: best = Math.max(...$game.scores)
  $: started = $game.status !== 'setup'
</script>

<details class="panel score-panel">
  <summary>
    <span>{$tx('Tabela wyników')}</span>
    {#if started}
      <span class="summary-totals"
        >{[0, 1, 2]
          .map(seat => `${nameOf(seat)} ${formatNumber($game.scores[seat])}`)
          .join(' · ')}</span
      >
    {/if}
  </summary>
  <div class="table-scroll">
    <table>
      <caption>{$tx('Gra do {target} punktów', { target: $game.target })}</caption>
      <thead>
        <tr>
          <th scope="col" class="number">{$tx('Nr')}</th>
          <th scope="col" class="contract">{$tx('Rozgrywka')}</th>
          {#each [0, 1, 2] as seat}
            <th scope="col">{nameOf(seat)}</th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each $game.records as record (record.number)}
          <tr>
            <td class="number">{record.number}</td>
            <td class="contract" class:failed={!record.made}>
              {nameOf(record.declarer)} · {record.contract}
              <span class="mark" aria-hidden="true">{record.made ? '✓' : '✗'}</span>
              <span class="visually-hidden"
                >{record.made ? $tx('ugrany') : $tx('nieugrany')}</span
              >
            </td>
            {#each [0, 1, 2] as seat}
              <td>
                <span
                  class="delta"
                  class:negative={record.deltas[seat] < 0}
                  class:declarer={seat === record.declarer}
                  >{signed(record.deltas[seat])}</span
                >
                <span class="running">{formatNumber(record.totals[seat])}</span>
              </td>
            {/each}
          </tr>
        {:else}
          <tr>
            <td colspan="5" class="empty">{$tx('Jeszcze nie ma zapisanych rozdań.')}</td>
          </tr>
        {/each}
      </tbody>
      <tfoot>
        <tr>
          <th scope="row" colspan="2">{$tx('Razem')}</th>
          {#each [0, 1, 2] as seat}
            <td class="total" class:leader={started && $game.scores[seat] === best}
              >{formatNumber($game.scores[seat])}</td
            >
          {/each}
        </tr>
      </tfoot>
    </table>
  </div>
</details>

<style>
  .panel {
    min-width: 0;
    padding: 0 16px;
    border: 1px solid var(--line);
    border-radius: 10px;
  }
  summary {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 44px;
    padding: 12px 0;
    cursor: pointer;
    font-size: 14px;
    color: #cadac2;
  }
  summary > span:first-child {
    flex-shrink: 0;
    white-space: nowrap;
  }
  summary::before {
    content: '▸';
    color: #9fb29e;
  }
  details[open] summary::before {
    content: '▾';
  }
  summary::-webkit-details-marker {
    display: none;
  }
  summary {
    list-style: none;
  }
  summary:focus-visible {
    outline: 2px solid #c5dda9;
    outline-offset: 3px;
    border-radius: 4px;
  }
  .summary-totals {
    margin-left: auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #b2c0a8;
    font-variant-numeric: tabular-nums;
  }
  .table-scroll {
    max-height: 320px;
    overflow: auto;
    padding-bottom: 12px;
    overscroll-behavior: contain;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
    font-variant-numeric: tabular-nums;
  }
  caption {
    padding-bottom: 6px;
    color: #9fb29e;
    font-size: 12px;
    text-align: left;
  }
  th,
  td {
    padding: 6px 6px;
    border-bottom: 1px solid #c5d3b51c;
    text-align: right;
    vertical-align: top;
    white-space: nowrap;
  }
  th:first-child,
  td:first-child,
  .contract {
    text-align: left;
  }
  thead th {
    position: sticky;
    top: 0;
    background: #121e1a;
    color: #a9bca9;
    font-size: 12px;
    font-weight: 600;
  }
  td {
    color: #c8d6c2;
  }
  .number {
    width: 1%;
    padding-right: 10px;
  }
  .contract {
    white-space: normal;
    min-width: 90px;
  }
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  .mark {
    color: #cfe8b0;
    font-weight: 700;
  }
  .failed .mark {
    color: #f0b0b8;
  }
  .delta,
  .running {
    display: block;
  }
  .delta {
    color: #a9bca9;
    font-size: 12px;
  }
  .delta.negative {
    color: #f0b0b8;
  }
  .delta.declarer {
    font-weight: 700;
  }
  .running {
    color: #e2eadb;
    font-weight: 600;
  }
  .empty {
    padding: 12px 0;
    color: #a9bca9;
    text-align: left;
  }
  tfoot th {
    color: #e2eadb;
    text-align: left;
  }
  .total {
    color: #f0f3e6;
    font-size: 15px;
    font-weight: 700;
  }
  .total.leader {
    color: #f1dc8e;
  }
</style>
