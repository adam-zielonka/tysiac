<script lang="ts">
  import { tr } from '../i18n'
  import { store } from '../engine/Store'
  import { strategies } from '../engine/strategies'
  import { activityText } from './ui'

  const { game } = store

  $: nameOf = (seat: number) => $tr(strategies[$game.playersSelect[seat]].name)
  $: entries = $game.history.slice(-8).reverse()
  $: latest = entries[0]
</script>

<details class="panel activity-panel">
  <summary>
    <span>{$tr('Ostatnie ruchy')}</span>
    {#if latest}<span class="latest-move"
        >{nameOf(latest.player)} · {activityText(latest, nameOf, $tr)}</span
      >{/if}
  </summary>
  <ol class="activity-list" aria-label={$tr('Historia ruchów')}>
    {#each entries as entry, i (entry.id)}
      {@const strategy = strategies[$game.playersSelect[entry.player]]}
      <li class="activity-row" class:latest={i === 0}>
        <span class={`activity-dot ${strategy.color}`} aria-hidden="true"></span>
        <span class="who">{$tr(strategy.name)}</span>
        <strong>{activityText(entry, nameOf, $tr)}</strong>
      </li>
    {:else}
      <li class="activity-row">{$tr('Ruchy pojawią się po rozdaniu kart.')}</li>
    {/each}
  </ol>
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
    list-style: none;
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
  summary:focus-visible {
    outline: 2px solid #c5dda9;
    outline-offset: 3px;
    border-radius: 4px;
  }
  .latest-move {
    margin-left: auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #b2c0a8;
  }
  .activity-list {
    margin: 0;
    padding: 0 0 12px;
    list-style: none;
  }
  .activity-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 7px 0;
    font-size: 14px;
    color: #b2c0a8;
  }
  .activity-row strong {
    margin-left: auto;
    font-weight: 500;
    text-align: right;
  }
  .activity-row.latest {
    color: var(--text);
  }
  .activity-dot {
    width: 6px;
    height: 6px;
    flex-shrink: 0;
    border-radius: 50%;
    background: currentColor;
  }
  .who {
    flex-shrink: 0;
  }
</style>
