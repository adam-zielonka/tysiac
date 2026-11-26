<script lang="ts">
  import { tick } from 'svelte'
  import { tr } from '../i18n'
  import type { Card } from '../engine/Card'
  import { store } from '../engine/Store'
  import { PlayerType } from '../engine/PlayerType'
  import { strategies } from '../engine/strategies'
  import { BASE_MAX_BID, cardPoints } from '../engine/rules'
  import PlayerElement from './PlayerElement.svelte'
  import SeatBadge from './SeatBadge.svelte'
  import CenterElement from './CenterElement.svelte'
  import ActionBar from './ActionBar.svelte'
  import {
    joinNames,
    meldValue,
    playHint,
    pluralForm,
    suitText,
    type CardTag,
  } from './ui'

  const { game } = store
  export let chooseSeat: (seat: number) => void = () => {}
  export let allCardsVisible = false

  let giftTarget = -1
  let yourArea: HTMLElement

  /** Keeps keyboard focus in your area when the pressed control disappears. */
  async function keepFocus(): Promise<void> {
    await tick()
    const active = document.activeElement
    if (!active || active === document.body) yourArea?.focus({ preventScroll: true })
  }

  $: deal = $game.deal
  $: phase = deal?.phase
  $: isSetup = $game.status === 'setup'
  $: playing = $game.status === 'playing'
  $: me = $game.players[0]
  $: watching = me.type !== PlayerType.Human
  $: humanTurn = playing && $game.turn === 0 && !watching && !!deal
  $: nameOf = (seat: number) => $tr(strategies[$game.playersSelect[seat]].name)
  $: myHand = deal ? deal.hand(0) : []
  $: playable = humanTurn && phase === 'play' ? deal!.playableCards() : []
  $: received =
    deal && deal.declarer !== 0 && (phase === 'giving' || phase === 'contract')
      ? deal.s.gifts.find(gift => gift.to === 0)?.card
      : undefined
  $: fromMusik =
    deal && deal.declarer === 0 && (phase === 'giving' || phase === 'contract')
      ? deal.s.musikCards
      : []
  $: lastTrick = $game.showLastTrick ? deal?.s.lastTrick : null

  // Every value the texts read is passed in, so Svelte reruns them on each change.
  $: status = statusText(
    $game,
    $tr,
    deal,
    phase,
    humanTurn,
    lastTrick,
    giftTarget,
    watching,
  )
  $: hint = hintText($game, $tr, deal, phase, humanTurn)

  function statusText(..._deps: unknown[]): string {
    if (isSetup || !deal) return $tr('Wybierz graczy i rozdaj karty.')
    if ($game.status === 'gameOver') {
      const winners = $game.winners
      if (winners.length === 1 && winners[0] === 0 && !watching)
        return $tr('Koniec partii · wygrywasz!')
      return $tr('Koniec partii · wygrywa {name}', {
        name: joinNames(winners.map(nameOf), $tr),
      })
    }
    if ($game.status === 'dealEnd') {
      const result = deal.result()!
      if (result.declarer === 0 && !watching)
        return result.made
          ? $tr('Twój kontrakt {value} ugrany!', { value: result.contract })
          : $tr('Twój kontrakt {value} nieugrany', { value: result.contract })
      return result.made
        ? $tr('{name}: kontrakt {value} ugrany', {
            name: nameOf(result.declarer),
            value: result.contract,
          })
        : $tr('{name}: kontrakt {value} nieugrany', {
            name: nameOf(result.declarer),
            value: result.contract,
          })
    }
    if (lastTrick && !humanTurn) {
      const points = cardPoints(lastTrick.plays.map(play => play.card))
      return lastTrick.winner === 0 && !watching
        ? $tr('Bierzesz lewę · +{points}', { points })
        : $tr('{name} bierze lewę · +{points}', {
            name: nameOf(lastTrick.winner),
            points,
          })
    }
    const name = nameOf(deal.turn)
    switch (phase) {
      case 'bidding':
        return humanTurn ? $tr('Twoja licytacja') : $tr('{name} licytuje…', { name })
      case 'musik':
        return humanTurn
          ? $tr('Wygrywasz licytację · {value}', { value: deal.s.highestBid })
          : $tr('{name} wygrywa licytację · {value}', { name, value: deal.s.highestBid })
      case 'giving':
        return humanTurn
          ? $tr('Oddaj kartę: {name}', { name: nameOf(giftTarget < 0 ? 1 : giftTarget) })
          : $tr('{name} oddaje po karcie rywalom…', { name })
      case 'contract':
        return humanTurn
          ? $tr('Ustal kontrakt')
          : $tr('{name} ustala kontrakt…', { name })
      case 'play':
        return humanTurn ? $tr('Twój ruch') : $tr('{name} wybiera kartę…', { name })
      default:
        return ''
    }
  }

  function hintText(..._deps: unknown[]): string {
    if (isSetup || !deal) return $tr('Kliknij fotel, aby zmienić gracza.')
    if ($game.status === 'gameOver')
      return $tr('Kliknij „Nowa partia”, aby zagrać ponownie.')
    if ($game.status === 'dealEnd')
      return $tr('Kliknij „Następne rozdanie”, aby grać dalej.')
    if (!humanTurn) return ''
    switch (phase) {
      case 'bidding': {
        const best = $tr('Najwyższa: {value} · {name}', {
          value: deal.s.highestBid,
          name: nameOf(deal.s.highestBidder),
        })
        const limit = deal.maxBid(0)
        return limit > BASE_MAX_BID
          ? `${best} · ${$tr('Twój limit z meldunkiem: {value}', { value: limit })}`
          : `${best} · ${$tr('Powyżej 120 tylko z meldunkiem')}`
      }
      case 'musik':
        return $tr('Trzy karty z musiku trafią do Twojej ręki.')
      case 'giving':
        return $tr('Kliknij kartę, aby ją oddać.')
      case 'contract': {
        const options = deal.contractOptions()
        return options.length > 1
          ? $tr('Możesz podnieść kontrakt do {value}.', { value: options.at(-1)! })
          : $tr('Bez meldunku kontrakt zostaje przy {value}.', { value: options[0] })
      }
      case 'play':
        return playHint(deal, $tr)
      default:
        return ''
    }
  }

  $: phaseLabel = isSetup
    ? ''
    : $game.status !== 'playing'
      ? $tr('Wynik')
      : phase === 'bidding'
        ? $tr('Licytacja')
        : phase === 'play'
          ? $tr('Lewa {number}/8', { number: Math.min(deal!.trickNumber + 1, 8) })
          : $tr('Musik')

  function canClick(card: Card): boolean {
    if (!humanTurn || !deal) return false
    if (phase === 'giving') return true
    return phase === 'play' && playable.includes(card)
  }

  function clickCard(card: Card): void {
    const current = game.deal
    if (!current || !humanTurn) return
    if (current.phase === 'giving') {
      const pending = current.pendingRecipients()
      const to = pending.includes(giftTarget) ? giftTarget : pending[0]
      if (to !== undefined) game.act(0, { type: 'give', card, to })
    } else if (current.phase === 'play') {
      game.act(0, { type: 'play', card })
    }
    keepFocus()
  }

  function cardTag(card: Card): CardTag {
    if (!deal) return null
    if (humanTurn && phase === 'play') {
      const value = meldValue(deal, card)
      return value ? { text: `+${value}`, kind: 'meld' } : null
    }
    if (received === card) return { text: $tr('nowa'), kind: 'note' }
    if (fromMusik.includes(card)) return { text: $tr('musik'), kind: 'note' }
    return null
  }

  function cardLabel(card: Card): string {
    const parts = [card.text]
    if (received === card) parts.push($tr('otrzymana'))
    if (fromMusik.includes(card)) parts.push($tr('z musiku'))
    if (!deal || !humanTurn) return parts.join(' — ')
    if (phase === 'giving') {
      const pending = deal.pendingRecipients()
      const to = pending.includes(giftTarget) ? giftTarget : pending[0]
      if (to !== undefined) parts.push($tr('oddaj: {name}', { name: nameOf(to) }))
    } else if (phase === 'play' && playable.includes(card)) {
      parts.push($tr('zagraj'))
      const value = meldValue(deal, card)
      if (value)
        parts.push($tr('meldunek {suit} +{value}', { suit: card.colorText, value }))
    }
    return parts.join(' — ')
  }

  function handCards(seat: number, visible: boolean): (Card | null)[] {
    if (!deal) return []
    if (visible) return [...deal.hand(seat)]
    return Array.from({ length: deal.handCount(seat) }, () => null)
  }

  function cardsLabel(seat: number, count: number): string {
    return `${nameOf(seat)}: ${$tr(pluralForm(count, '{count} karta', '{count} karty', '{count} kart'), { count })}`
  }
</script>

<section class="game-board" aria-label={$tr('Stół do gry')}>
  <div class="table-toolbar">
    <div class="round">
      <span class="live-dot"></span>
      {#if isSetup}{$tr('PRZYGOTOWANIE')}{:else}{$tr('ROZDANIE')}
        {String($game.dealNumber).padStart(2, '0')}{/if}
    </div>
    <div class="target">{$tr('GRA DO {target}', { target: $game.target })}</div>
  </div>
  <div
    class="felt"
    class:finished={$game.status === 'dealEnd' || $game.status === 'gameOver'}
  >
    <div class="table-outline"></div>
    <div class="felt-mark" aria-hidden="true">
      1000<small>{$tr('TYSIĄC · GRA KARCIANA')}</small>
    </div>
    {#each [1, 2] as seat (seat)}
      {@const count = deal ? deal.handCount(seat) : 0}
      <div class={`opponent opponent-${seat}`}>
        <SeatBadge {seat} {chooseSeat} />
        <div class="opponent-hand" class:concealed={!allCardsVisible}>
          {#if !isSetup && count}
            <PlayerElement
              cards={handCards(seat, allCardsVisible)}
              size="compact"
              label={cardsLabel(seat, count)}
            />
          {/if}
        </div>
      </div>
    {/each}
    <div class="center">
      <CenterElement />
    </div>
    <div class="table-info" class:placeholder={isSetup} aria-hidden={isSetup}>
      {#if deal && !isSetup}
        {#if phase === 'bidding'}
          <span class="info-chip"
            >{$tr('Rozdaje: {name}', { name: nameOf(deal.dealer) })}</span
          >
          <span class="info-chip"
            >{$tr('Otwiera: {name} · 100', { name: nameOf(deal.opener) })}</span
          >
        {:else}
          <span class="info-chip trump" class:no-trump={deal.trump === null}
            >{deal.trump === null
              ? $tr('Bez atutu')
              : $tr('Atut {suit}', { suit: suitText(deal.trump) })}</span
          >
          <span class="info-chip"
            >{$tr('Kontrakt: {name} · {value}', {
              name: nameOf(deal.declarer),
              value: deal.contract,
            })}</span
          >
          {#if phase === 'play' || phase === 'finished'}
            <span class="info-chip"
              >{$tr('Ugrane: {points} pkt', {
                points: deal.pointsOf(deal.declarer),
              })}</span
            >
          {/if}
        {/if}
      {:else}
        <span class="info-chip">{$tr('Bez atutu')}</span>
      {/if}
    </div>
  </div>
  <div
    class="your-area"
    role="region"
    aria-label={$tr('Twoje miejsce')}
    tabindex="-1"
    bind:this={yourArea}
  >
    <div class="turn-line">
      <div class="turn-status" role="status" aria-live="polite">
        <span class:your-turn={humanTurn} class="status-dot"></span>
        <div class="status-copy">
          <strong>{status}</strong>
          <span class="turn-hint" class:placeholder={!hint}>{hint || '·'}</span>
        </div>
      </div>
      <div class="own-seat">
        <SeatBadge seat={0} {chooseSeat} />
      </div>
      <span class="phase-label" class:placeholder={!phaseLabel}>{phaseLabel || '·'}</span>
    </div>
    <div class="your-hand">
      {#if myHand.length}
        <PlayerElement
          cards={myHand}
          interactive
          label={watching ? $tr('Karty: {name}', { name: nameOf(0) }) : $tr('Twoja ręka')}
          possible={canClick}
          dimmed={card => humanTurn && phase === 'play' && !playable.includes(card)}
          tag={cardTag}
          {cardLabel}
          click={clickCard}
        />
      {:else}
        <div class="empty-hand">
          {isSetup ? $tr('Tu pojawią się Twoje karty.') : $tr('Rozdanie zakończone.')}
        </div>
      {/if}
    </div>
    {#if watching}
      <span class="seat-context" class:placeholder={isSetup} aria-hidden={isSetup}
        >{$tr('Obserwujesz grę')}</span
      >
    {/if}
    <ActionBar bind:giftTarget afterAct={keepFocus} />
  </div>
</section>

<style>
  .game-board {
    min-width: 0;
    max-width: 100%;
    border: 1px solid #3e5b4a;
    border-radius: 16px;
    background: #182722;
    box-shadow: 0 20px 60px #0002;
  }
  .table-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 38px;
    padding: 8px 20px;
    border-bottom: 1px solid #b9d4ba0d;
    border-radius: 15px 15px 0 0;
  }
  .round,
  .target {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.08em;
    color: #bdc9ba;
  }
  .target {
    color: #9fb29e;
    font-size: 12px;
  }
  .live-dot {
    height: 6px;
    width: 6px;
    border-radius: 50%;
    background: #aac598;
    box-shadow: 0 0 8px #aac59855;
  }
  .felt {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr) minmax(0, 1fr);
    grid-template-rows: minmax(236px, auto) auto;
    gap: 10px 16px;
    padding: 16px 20px 10px;
    position: relative;
    background: radial-gradient(
      ellipse at 50% 20%,
      #285a43 0%,
      #204b38 48%,
      #1b3f31 100%
    );
    isolation: isolate;
  }
  .felt::before {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    opacity: 0.15;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 160 160' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Cpath fill='%23fff' filter='url(%23n)' opacity='.3' d='M0 0h160v160H0z'/%3E%3C/svg%3E");
  }
  .table-outline {
    position: absolute;
    inset: 22px 28px;
    border: 1px solid #91b79020;
    border-radius: 140px;
    z-index: -1;
  }
  .felt-mark {
    position: absolute;
    top: 44%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: #c4d3aa08;
    font:
      96px Georgia,
      serif;
    letter-spacing: 10px;
    text-align: center;
    white-space: nowrap;
    z-index: -1;
  }
  .felt-mark small {
    display: block;
    margin-top: 6px;
    font:
      9px system-ui,
      sans-serif;
    letter-spacing: 4px;
  }
  .opponent {
    position: relative;
    grid-row: 1;
    align-self: start;
    width: min(240px, 100%);
    min-width: 0;
  }
  .opponent-1 {
    grid-column: 1;
    justify-self: start;
  }
  .opponent-2 {
    grid-column: 3;
    justify-self: end;
  }
  .opponent-hand {
    /* Reserve room for up to ten cards so seats never move. */
    height: 80px;
    min-width: 0;
  }
  /* After the last trick the hands are empty; give the space to the summary. */
  .finished .opponent-hand {
    display: none;
  }
  .center {
    grid-row: 1;
    grid-column: 2;
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 6px;
  }
  .table-info {
    grid-row: 2;
    grid-column: 1 / -1;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 6px 8px;
    min-height: 26px;
  }
  .info-chip {
    padding: 2px 10px;
    border: 1px solid #a8c8a733;
    border-radius: 999px;
    background: #0f2a2080;
    color: #d3e1cf;
    font-size: 13px;
    line-height: 20px;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  .trump {
    border-color: #f1dc8e66;
    color: #f6e7ad;
    font-weight: 650;
  }
  .trump.no-trump {
    border-color: #a8c8a733;
    color: #c1d4c4;
    font-weight: 500;
  }
  .placeholder {
    visibility: hidden;
  }
  .your-area {
    outline: none;
    min-width: 0;
    padding: 0 20px 14px;
    background: linear-gradient(#1b3027, #192b24);
    border-top: 1px solid #a0c6a52b;
    border-radius: 0 0 15px 15px;
  }
  .turn-line {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 220px minmax(0, 1fr);
    align-items: center;
    gap: 9px 16px;
    padding: 11px 0;
    border-bottom: 1px solid #bdd3b326;
  }
  .turn-status {
    display: flex;
    align-items: flex-start;
    gap: 9px;
    min-width: 0;
  }
  .status-dot {
    width: 6px;
    height: 6px;
    flex-shrink: 0;
    margin-top: 7px;
    border-radius: 50%;
    background: #8c9d93;
  }
  .your-turn {
    background: #c9e4a1;
    box-shadow: 0 0 0 4px #c9e4a112;
  }
  .status-copy {
    display: grid;
    gap: 1px;
    min-width: 0;
    line-height: 20px;
  }
  .status-copy strong {
    color: #e1edd9;
    font-size: 14px;
    font-weight: 600;
    overflow-wrap: anywhere;
  }
  .turn-hint {
    color: #bbcebc;
    font-size: 13px;
    line-height: 18px;
    overflow-wrap: anywhere;
  }
  .own-seat {
    min-width: 0;
  }
  .phase-label {
    justify-self: end;
    color: #b8cbb8;
    font-size: 13px;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  .your-hand {
    min-width: 0;
    max-width: 100%;
    min-height: 140px;
  }
  .empty-hand {
    display: grid;
    align-content: center;
    min-height: 138px;
    color: #a9bca9;
    font-size: 14px;
    line-height: 20px;
    text-align: center;
  }
  .seat-context {
    display: block;
    padding: 0 0 4px;
    text-align: center;
    color: #d3e3c4;
    font-size: 12px;
    line-height: 17px;
  }
  @media (max-width: 760px) {
    .table-toolbar {
      min-height: 36px;
      padding: 7px 12px;
    }
    .felt {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      grid-template-rows: auto auto auto;
      gap: 8px;
      padding: 10px 10px 8px;
    }
    .table-outline {
      inset: 18px 8px;
      border-radius: 70px;
    }
    .opponent {
      width: 100%;
    }
    .opponent-2 {
      grid-column: 2;
    }
    .opponent-hand {
      height: 64px;
    }
    .opponent-hand.concealed {
      height: 42px;
    }
    .opponent-2 .opponent-hand.concealed :global(.hand) {
      justify-content: flex-end;
    }
    .opponent-hand.concealed :global(.hand) {
      --card-w: 22px;
      --card-h: 32px;
      --max-slot: 8px;
      --min-slot: 3px;
      justify-content: flex-start;
    }
    .center {
      grid-column: 1 / -1;
      grid-row: 2;
      min-height: 178px;
    }
    .table-info {
      grid-row: 3;
    }
    .info-chip {
      font-size: 12px;
      padding-inline: 8px;
    }
    .felt-mark {
      top: 55%;
      font-size: 64px;
    }
    .your-area {
      padding: 0 12px 12px;
    }
    .turn-line {
      grid-template-columns: minmax(0, 1fr) minmax(0, 150px);
      align-items: start;
      padding: 8px 0;
      gap: 4px 8px;
    }
    .turn-status {
      grid-row: 1 / span 2;
      gap: 8px;
    }
    .status-copy strong {
      min-height: 20px;
    }
    .own-seat {
      grid-column: 2;
      grid-row: 1;
    }
    .phase-label {
      grid-column: 2;
      grid-row: 2;
      justify-self: center;
      font-size: 12px;
    }
  }
  @media (max-width: 600px) {
    .your-hand {
      min-height: 122px;
    }
    .empty-hand {
      min-height: 120px;
    }
  }
  @media (max-width: 380px) {
    .your-area {
      padding: 0 8px 10px;
    }
    .turn-line {
      grid-template-columns: minmax(0, 1fr) minmax(0, 132px);
    }
  }
</style>
