<script lang="ts">
  import { tr } from '../i18n'
  import { store } from '../engine/Store'
  import { PlayerType } from '../engine/PlayerType'
  import { strategies } from '../engine/strategies'
  import PlayerAvatar from './PlayerAvatar.svelte'
  import LockIcon from './LockIcon.svelte'
  import { bidText, formatNumber, seatNames, seatSide } from './ui'

  const { game } = store
  export let seat: number
  export let chooseSeat: (seat: number) => void = () => {}

  $: own = seat === 0
  $: side = seatSide(seat)
  $: type = $game.playersSelect[seat]
  $: strategy = strategies[type]
  $: name = $tr(strategy.name)
  /** With the side added when another seat has the same bot. */
  $: fullName = seatNames($game.playersSelect, $tr)[seat]
  $: isSetup = $game.status === 'setup'
  $: deal = $game.deal
  $: active = $game.turn === seat
  $: thinking = active && type !== PlayerType.Human
  $: isDealer = !isSetup && !!deal && deal.dealer === seat
  $: isDeclarer = !isSetup && !!deal && deal.phase !== 'bidding' && deal.declarer === seat
  $: showTricks =
    !isSetup && !!deal && (deal.phase === 'play' || deal.phase === 'finished')
  $: tricks = deal ? deal.s.tricksWon[seat] : 0
  $: points = deal ? deal.pointsOf(seat) : 0
  $: bid = !isSetup && deal?.phase === 'bidding' ? bidText(deal.s.bids[seat], $tr) : null
  $: passed = !isSetup && deal?.phase === 'bidding' && deal.s.bids[seat] === 'pass'
  $: knowledge = isSetup && type === PlayerType.AZ
  $: bubble = knowledge ? $tr('Znam wszystkie ręce') : bid
  $: score = $game.scores[seat]
  /** At 800+ a player scores only as the declarer (moot once the match is over). */
  $: locked = !isSetup && $game.status !== 'gameOver' && $game.lockedSeats[seat]
  $: lockLabel = $tr('{score}+: punkty tylko jako rozgrywający', {
    score: $game.lockScore,
  })
  $: hasMeta = isDealer || isDeclarer || showTricks
  $: description = [
    fullName,
    $tr('{score} pkt', { score: formatNumber(score) }),
    locked ? lockLabel : '',
    isDealer ? $tr('rozdaje') : '',
    isDeclarer ? $tr('rozgrywa za {value}', { value: deal!.contract }) : '',
    showTricks ? $tr('lewy: {count}, punkty: {points}', { count: tricks, points }) : '',
    bid !== null
      ? passed
        ? $tr('pasuje')
        : $tr('licytuje {value}', { value: bid })
      : '',
    thinking ? $tr('myśli…') : '',
  ]
    .filter(Boolean)
    .join(', ')
</script>

<div class={`seat seat-${side}`} class:own class:active={active && !isSetup}>
  {#if bubble}
    <span
      class="bubble"
      class:pass={passed}
      class:knowledge
      id={`seat-${seat}-bubble`}
      aria-hidden={knowledge ? undefined : 'true'}>{bubble}</span
    >
  {/if}
  <button
    type="button"
    class="player-badge"
    class:with-meta={hasMeta}
    data-seat={seat}
    disabled={!isSetup}
    aria-haspopup={isSetup ? 'dialog' : undefined}
    aria-label={isSetup
      ? $tr('Wybierz gracza: {name} · fotel {seat}', { name: fullName, seat: seat + 1 })
      : description}
    aria-describedby={knowledge ? `seat-${seat}-bubble` : undefined}
    on:click={() => chooseSeat(seat)}
  >
    {#if thinking}
      <span class="thinking" aria-hidden="true"><i></i><i></i><i></i></span>
    {/if}
    <PlayerAvatar {type} />
    <strong>{name}</strong>
    {#if hasMeta}
      <span class="meta" aria-hidden="true">
        {#if isDealer}<span class="chip dealer" title={$tr('rozdaje')}>{$tr('R')}</span
          >{/if}
        {#if isDeclarer}<span
            class="chip declarer"
            title={$tr('rozgrywa za {value}', { value: deal?.contract ?? 0 })}
            ><svg viewBox="0 0 12 10"
              ><path d="M1 9 .6 2.6 3.6 5 6 1l2.4 4 3-2.4L11 9Z" /></svg
            >{deal?.contract}</span
          >{/if}
        {#if showTricks}<span
            class="chip"
            title={$tr('lewy: {count}, punkty: {points}', { count: tricks, points })}
            ><svg viewBox="0 0 12 12" class="tricks-icon"
              ><rect x="1" y="3" width="6.5" height="8.5" rx="1" /><path
                d="M4 1.5h5.5a1 1 0 0 1 1 1V9"
              /></svg
            >{tricks}</span
          >{/if}
      </span>
    {/if}
    <span
      class="score"
      class:placeholder={isSetup}
      class:locked
      title={locked ? lockLabel : undefined}
      aria-hidden="true"
      >{#if locked}<LockIcon />{/if}{formatNumber(score)}</span
    >
  </button>
</div>

<style>
  .seat {
    position: relative;
    width: 100%;
    min-width: 0;
  }
  .player-badge {
    position: relative;
    width: 100%;
    cursor: pointer;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    grid-template-areas: 'avatar name score';
    align-items: center;
    align-content: center;
    gap: 1px 9px;
    min-height: 52px;
    padding: 6px 10px;
    border: 1px solid #9bb7a733;
    border-radius: 10px;
    background: #102b22d9;
    text-align: left;
    box-shadow: 0 3px 10px #0001;
  }
  .player-badge.with-meta {
    grid-template-areas:
      'avatar name score'
      'avatar meta score';
  }
  .player-badge:not(:disabled):hover {
    border-color: #c2e3a8;
    background: #193b2d;
  }
  .player-badge:disabled {
    cursor: default;
    opacity: 1;
  }
  .own .player-badge {
    background: #33563d;
    border-color: #94b681;
  }
  .own .player-badge:not(:disabled):hover {
    background: #3c6345;
    border-color: #d5edbd;
  }
  .active .player-badge {
    border-color: #d5edbd;
    box-shadow: 0 0 0 2px #b4d49d40;
  }
  .player-badge :global(.avatar) {
    grid-area: avatar;
    width: 30px;
    height: 30px;
    border-radius: 8px;
  }
  strong {
    grid-area: name;
    min-width: 0;
    color: #e2eadb;
    font-size: 14px;
    line-height: 20px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .meta {
    grid-area: meta;
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
    min-height: 18px;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 0 5px;
    border-radius: 5px;
    background: #c5dda91a;
    color: #cfe0c4;
    font-size: 11px;
    line-height: 18px;
    font-weight: 650;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  .chip svg {
    width: 11px;
    height: 11px;
    fill: currentColor;
  }
  .chip .tricks-icon {
    fill: none;
    stroke: currentColor;
    stroke-width: 1.3;
  }
  .dealer {
    min-width: 18px;
    text-align: center;
    background: #e8e1c2;
    color: #2b3a2d;
  }
  .declarer {
    background: #f1dc8e;
    color: #3d3214;
  }
  .score {
    grid-area: score;
    color: #f0f3e6;
    font-size: 16px;
    font-weight: 650;
    font-variant-numeric: tabular-nums;
    min-width: 34px;
    text-align: right;
    border-left: 1px solid #8fad9844;
    padding-left: 9px;
  }
  .score.locked {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    color: #f1dc8e;
  }
  .score.locked :global(.lock-icon) {
    width: 11px;
    height: 13px;
  }
  .placeholder {
    visibility: hidden;
  }
  .thinking {
    position: absolute;
    top: -5px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    justify-content: center;
    gap: 4px;
    padding: 3px 7px;
    border-radius: 8px;
    background: #173b2b;
  }
  .thinking i {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: #d5edbd;
    animation: pulse 1.2s infinite;
  }
  .thinking i:nth-child(2) {
    animation-delay: 0.2s;
  }
  .thinking i:nth-child(3) {
    animation-delay: 0.4s;
  }
  /* Speech bubble: towards the table centre on wide screens. */
  .bubble {
    position: absolute;
    z-index: 4;
    top: 50%;
    max-width: 150px;
    padding: 5px 11px;
    border: 1px solid #e6dcb0;
    border-radius: 12px;
    background: #fbf6e2;
    color: #2a3326;
    box-shadow: 2px 3px 0 #09150e55;
    font-size: 15px;
    line-height: 20px;
    font-weight: 700;
    text-align: center;
    white-space: nowrap;
    pointer-events: none;
    transform: translateY(-50%);
    animation: pop 180ms ease-out;
  }
  .bubble::before {
    content: '';
    position: absolute;
    top: calc(50% - 4px);
    width: 8px;
    height: 8px;
    background: inherit;
    border: inherit;
    transform: rotate(45deg);
  }
  .bubble.pass {
    background: #e3e6dc;
    color: #4a5649;
    font-weight: 600;
    border-color: #c7cdbd;
  }
  .bubble.knowledge {
    border-color: #c9b0e1;
    background: #efe4fa;
    color: #3b284f;
    font-size: 13px;
    line-height: 17px;
    font-weight: 600;
    white-space: normal;
  }
  .seat-left .bubble,
  .seat-bottom .bubble {
    left: calc(100% + 12px);
  }
  .seat-left .bubble::before,
  .seat-bottom .bubble::before {
    left: -5px;
    border-top-color: transparent;
    border-right-color: transparent;
  }
  .seat-right .bubble {
    right: calc(100% + 12px);
  }
  .seat-right .bubble::before {
    right: -5px;
    border-bottom-color: transparent;
    border-left-color: transparent;
  }
  @keyframes pulse {
    50% {
      opacity: 0.25;
    }
  }
  @keyframes pop {
    from {
      opacity: 0;
      scale: 0.85;
    }
  }
  @media (max-width: 760px) {
    .player-badge.with-meta {
      grid-template-areas:
        'avatar name score'
        'meta meta meta';
    }
    .player-badge {
      padding: 5px 7px;
      gap: 3px 6px;
      border-radius: 8px;
      min-height: 48px;
    }
    .player-badge :global(.avatar) {
      width: 24px;
      height: 24px;
      border-radius: 6px;
    }
    .score {
      min-width: 0;
      padding-left: 6px;
      font-size: 15px;
    }
    /* Opponents' bubbles drop below the badge, over their face-down cards. */
    .seat-left .bubble,
    .seat-right .bubble {
      top: calc(100% + 9px);
      transform: none;
    }
    .seat-left .bubble {
      left: 8px;
    }
    .seat-right .bubble {
      right: 8px;
    }
    .seat-left .bubble::before,
    .seat-right .bubble::before {
      top: -5px;
      border-color: inherit;
      border-right-color: transparent;
      border-bottom-color: transparent;
    }
    .seat-left .bubble::before {
      left: 14px;
    }
    .seat-right .bubble::before {
      left: auto;
      right: 14px;
    }
    /* Your bubble rises above your badge. */
    .seat-bottom .bubble {
      top: auto;
      bottom: calc(100% + 9px);
      left: auto;
      right: 8px;
      transform: none;
    }
    .seat-bottom .bubble::before {
      top: auto;
      bottom: -5px;
      left: auto;
      right: 14px;
      border-color: inherit;
      border-top-color: transparent;
      border-left-color: transparent;
    }
    .bubble.knowledge {
      max-width: 140px;
    }
  }
  /* On the narrowest phones the lock sits on the score's divider, so a
     three-digit locked score leaves room for the name. */
  @media (max-width: 380px) {
    .score.locked {
      position: relative;
    }
    .score.locked :global(.lock-icon) {
      position: absolute;
      top: -9px;
      left: -6px;
      width: 10px;
      height: 12px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .thinking i,
    .bubble {
      animation: none;
    }
  }
</style>
