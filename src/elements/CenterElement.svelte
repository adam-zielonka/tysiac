<script lang="ts">
  import { tr } from '../i18n'
  import { store } from '../engine/Store'
  import { strategies } from '../engine/strategies'
  import { PlayerType } from '../engine/PlayerType'
  import { cardPoints } from '../engine/rules'
  import CardElement from './CardElement.svelte'
  import DealSummary from './DealSummary.svelte'
  import { seatSide, suitText } from './ui'

  const { game } = store

  $: deal = $game.deal
  $: status = $game.status
  $: phase = deal?.phase
  $: nameOf = (seat: number) => $tr(strategies[$game.playersSelect[seat]].name)
  $: lastTrick = $game.showLastTrick ? deal?.s.lastTrick : null
  $: plays = lastTrick ? lastTrick.plays : (deal?.trick ?? [])
  $: winner = lastTrick ? lastTrick.winner : -1
  $: trickPoints = lastTrick ? cardPoints(lastTrick.plays.map(play => play.card)) : 0
  $: meld = deal
    ? deal.s.melds.find(
        m =>
          m.trick === (lastTrick ? deal.trickNumber - 1 : deal.trickNumber) &&
          plays[0]?.player === m.player &&
          plays[0]?.card.color === m.color,
      )
    : undefined
  $: youDeclare = deal?.declarer === 0 && $game.playersSelect[0] === PlayerType.Human
  $: musikCaption =
    !deal || deal.declarer < 0
      ? ''
      : phase === 'musik'
        ? youDeclare
          ? $tr('Wygrywasz licytację · {value}', { value: deal.s.highestBid })
          : $tr('{name} wygrywa licytację · {value}', {
              name: nameOf(deal.declarer),
              value: deal.s.highestBid,
            })
        : phase === 'giving'
          ? youDeclare
            ? $tr('Oddajesz po karcie rywalom')
            : $tr('{name} oddaje po karcie rywalom', { name: nameOf(deal.declarer) })
          : youDeclare
            ? $tr('Ustalasz kontrakt')
            : $tr('{name} ustala kontrakt', { name: nameOf(deal.declarer) })
  $: trickLabel = plays
    .map(play => `${nameOf(play.player)}: ${play.card.text}`)
    .join(', ')
</script>

{#if status === 'setup' || !deal}
  <p class="setup-prompt">{$tr('Kliknij miejsce przy stole, aby wybrać gracza.')}</p>
{:else if status === 'dealEnd' || status === 'gameOver'}
  <DealSummary />
{:else if phase === 'bidding'}
  <div class="musik" role="img" aria-label={$tr('Musik: 3 zakryte karty')}>
    {#each [0, 1, 2] as i}
      <span class="musik-card" style={`--i: ${i}`}><CardElement card={null} /></span>
    {/each}
  </div>
  <div class="center-caption">
    <span class="caption-label">{$tr('Najwyższa oferta')}</span>
    <strong class="bid-value">{deal.s.highestBid}</strong>
    <span>{nameOf(deal.s.highestBidder)}</span>
  </div>
{:else if phase === 'musik' || phase === 'giving' || phase === 'contract'}
  <div
    class="musik"
    class:taken={phase !== 'musik'}
    role="img"
    aria-label={$tr('Musik: {cards}', {
      cards: deal.s.musikCards.map(card => card.text).join(', '),
    })}
  >
    {#each deal.s.musikCards as card, i (card.id)}
      <span class="musik-card revealed" style={`--i: ${i}`}><CardElement {card} /></span>
    {/each}
  </div>
  <div class="center-caption">
    <span class="caption-label">{$tr('Musik')}</span>
    <span>{musikCaption}</span>
  </div>
{:else if phase === 'play'}
  <div
    class="trick"
    role="group"
    aria-label={plays.length
      ? $tr('Lewa: {cards}', { cards: trickLabel })
      : $tr('Lewa jest pusta')}
  >
    {#each plays as play, i (play.card.id)}
      <span
        class={`trick-card side-${seatSide(play.player)}`}
        class:won={play.player === winner}
        style={`--order: ${i}`}
      >
        <CardElement card={play.card} highlight={play.player === winner} />
      </span>
    {/each}
    {#if !plays.length}
      <span class="trick-empty"
        >{$tr('Wychodzi: {name}', { name: nameOf(deal.turn) })}</span
      >
    {/if}
  </div>
  <div class="center-caption trick-caption">
    {#if lastTrick}
      <strong
        >{winner === 0 && $game.playersSelect[0] === PlayerType.Human
          ? $tr('Bierzesz lewę · +{points}', { points: trickPoints })
          : $tr('{name} bierze lewę · +{points}', {
              name: nameOf(winner),
              points: trickPoints,
            })}</strong
      >
    {:else}
      <span class="caption-label"
        >{$tr('Lewa {number} z 8', { number: deal.trickNumber + 1 })}</span
      >
    {/if}
    {#if meld}
      <span class="meld-note"
        >{$tr('Meldunek {suit} +{value} · nowy atut', {
          suit: suitText(meld.color),
          value: meld.points,
        })}</span
      >
    {/if}
  </div>
{/if}

<style>
  .setup-prompt {
    width: 220px;
    max-width: 100%;
    margin: 0 auto;
    color: #c1d4c4;
    text-align: center;
    font-size: 14px;
    line-height: 1.6;
  }
  .musik {
    --card-w: 60px;
    --card-h: 86px;
    position: relative;
    width: 150px;
    height: 104px;
    margin: 0 auto;
  }
  .musik-card {
    position: absolute;
    left: calc(45px + (var(--i) - 1) * 34px);
    top: calc(8px + var(--i) * 1px);
    transform: rotate(calc((var(--i) - 1) * 7deg));
  }
  .musik-card.revealed {
    left: calc(45px + (var(--i) - 1) * 46px);
    animation: flip 260ms ease-out both;
    animation-delay: calc(var(--i) * 70ms);
  }
  .musik.taken {
    opacity: 0.55;
  }
  .center-caption {
    display: grid;
    justify-items: center;
    gap: 1px;
    color: #d3e1cf;
    font-size: 13px;
    line-height: 18px;
    text-align: center;
  }
  .caption-label {
    color: #b8cbb8;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .bid-value {
    color: #f6f1d8;
    font:
      600 30px/34px Georgia,
      serif;
  }
  .trick {
    --card-w: 68px;
    --card-h: 97px;
    position: relative;
    width: 228px;
    height: 176px;
    margin: 0 auto;
  }
  .trick-card {
    position: absolute;
    z-index: var(--order);
    animation: slide-in 220ms ease-out both;
  }
  .side-left {
    --from: -34px -6px;
    left: 16px;
    top: 10px;
    rotate: -7deg;
  }
  .side-right {
    --from: 34px -6px;
    right: 16px;
    top: 10px;
    rotate: 7deg;
  }
  .side-bottom {
    --from: 0 34px;
    left: calc(50% - var(--card-w) / 2);
    top: 66px;
  }
  .won {
    z-index: 5;
  }
  .trick-empty {
    position: absolute;
    inset: 50% 0 auto;
    transform: translateY(-50%);
    color: #c1d4c4;
    font-size: 14px;
    text-align: center;
  }
  .trick-caption {
    min-height: 38px;
  }
  .trick-caption strong {
    color: #f2e6a7;
    font-weight: 650;
  }
  .meld-note {
    padding: 1px 8px;
    border-radius: 6px;
    background: #f1dc8e;
    color: #3d3214;
    font-weight: 700;
  }
  @keyframes slide-in {
    from {
      opacity: 0;
      translate: var(--from);
    }
  }
  @keyframes flip {
    from {
      opacity: 0;
      transform: rotate(calc((var(--i) - 1) * 7deg)) scale(0.8);
    }
  }
  @media (max-width: 760px) {
    .musik {
      --card-w: 50px;
      --card-h: 72px;
      width: 140px;
      height: 86px;
    }
    .musik-card {
      left: calc(45px + (var(--i) - 1) * 28px);
    }
    .musik-card.revealed {
      left: calc(45px + (var(--i) - 1) * 40px);
    }
    .trick {
      --card-w: 56px;
      --card-h: 80px;
      width: 196px;
      height: 142px;
    }
    .side-left {
      left: 12px;
      top: 6px;
    }
    .side-right {
      right: 12px;
      top: 6px;
    }
    .side-bottom {
      top: 56px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .trick-card,
    .musik-card.revealed {
      animation: none;
    }
  }
</style>
