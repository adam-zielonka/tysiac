<script lang="ts">
  import { onDestroy, tick } from 'svelte'
  import { tr, locale, setLanguage, PAGE_TITLE } from '../i18n'
  import { store } from '../engine/Store'
  import BoardElement from './BoardElement.svelte'
  import PlayerPickerDialog from './PlayerPickerDialog.svelte'
  import ScoreTable from './ScoreTable.svelte'
  import ActivityPanel from './ActivityPanel.svelte'
  import type { PlayerType } from '../engine/PlayerType'
  import { PACES } from './ui'

  const { game } = store
  let settingsDialog: HTMLDialogElement
  let rulesDialog: HTMLDialogElement
  let confirmDialog: HTMLDialogElement
  let playerPicker: PlayerPickerDialog
  let selectedSeat = 0
  let allCardsVisible = false

  $: isSetup = $game.status === 'setup'
  $: inProgress = $game.status === 'playing' || $game.status === 'dealEnd'

  async function openPlayerPicker(seat: number): Promise<void> {
    if (game.status !== 'setup') return
    selectedSeat = seat
    await tick()
    if (game.status === 'setup') playerPicker.show()
  }

  function choosePlayer(type: PlayerType): void {
    game.setPlayer(selectedSeat, type)
  }

  function startMatch(): void {
    if (game.status !== 'setup') return
    playerPicker.close()
    game.startMatch()
  }

  function newMatch(): void {
    if (inProgress) confirmDialog.showModal()
    else backToSetup()
  }

  function backToSetup(): void {
    confirmDialog.close()
    settingsDialog.close()
    rulesDialog.close()
    game.prepare()
  }

  onDestroy(() => game.stopTimer())
</script>

<svelte:head><title>{$tr(PAGE_TITLE)}</title></svelte:head>

<div class="app-shell">
  <header class="app-header">
    <h1 class="brand">
      <svg class="brand-icon" viewBox="0 0 40 40" aria-hidden="true">
        <rect x="5" y="7" width="19" height="27" rx="3" transform="rotate(-12 14 20)" />
        <rect x="15" y="5" width="19" height="27" rx="3" transform="rotate(9 25 19)" />
        <text x="25" y="23" transform="rotate(9 25 19)">♥</text>
      </svg>
      <span>{$tr('TYSIĄC')}</span>
    </h1>
    <button
      class="button primary new-deal"
      on:click={isSetup ? startMatch : newMatch}
      aria-haspopup={inProgress ? 'dialog' : undefined}
    >
      <svg class="button-icon" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="8" y="3" width="12" height="18" rx="2" />
        <path d="M5 18H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h1m7 6h4m-4 4h4" />
      </svg>
      {isSetup ? $tr('Rozdaj karty') : $tr('Nowa partia')}
    </button>
    <nav aria-label={$tr('Ustawienia i pomoc')}>
      <button
        class="button subtle"
        on:click={() => settingsDialog.showModal()}
        aria-haspopup="dialog"
      >
        <svg class="button-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 6h4m4 0h10M3 12h10m4 0h4M3 18h4m4 0h10" />
          <circle cx="9" cy="6" r="2" />
          <circle cx="15" cy="12" r="2" />
          <circle cx="9" cy="18" r="2" />
        </svg>
        {$tr('Ustawienia')}
      </button>
      <button
        class="button subtle"
        on:click={() => rulesDialog.showModal()}
        aria-haspopup="dialog"
      >
        <svg class="button-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 5c-3-2-6-2-10-1v15c4-1 7-1 10 1 3-2 6-2 10-1V4c-4-1-7-1-10 1Zm0 0v15"
          />
        </svg>
        {$tr('Zasady gry')}
      </button>
    </nav>
  </header>

  <main>
    <BoardElement chooseSeat={openPlayerPicker} {allCardsVisible} />
    <div class="panels">
      <ScoreTable />
      <ActivityPanel />
    </div>
  </main>
</div>

<dialog bind:this={settingsDialog} aria-labelledby="settings-title">
  <div class="dialog-heading">
    <h2 id="settings-title">{$tr('Ustawienia')}</h2>
    <button
      class="close-button"
      on:click={() => settingsDialog.close()}
      aria-label={$tr('Zamknij ustawienia')}>×</button
    >
  </div>
  <section aria-label={$tr('Ustawienia')}>
    <div class="setting-row pace-row">
      <span id="pace-label">{$tr('Tempo gry')}</span>
      <div class="pace-options" role="group" aria-labelledby="pace-label">
        {#each PACES as pace}
          <button
            type="button"
            aria-pressed={$game.thinkDelay === pace.think}
            on:click={() => game.setPace(pace.think, pace.trick)}
            >{$tr(pace.label)}</button
          >
        {/each}
      </div>
    </div>
    <label class="reveal setting-row"
      ><span>{$tr('Pokaż karty rywali')}</span><input
        type="checkbox"
        bind:checked={allCardsVisible}
      /></label
    >
    <div class="setting-row language-row">
      <span id="language-label">Language / Język</span>
      <div class="language-switch" role="group" aria-labelledby="language-label">
        <button
          type="button"
          lang="pl"
          aria-pressed={$locale === 'pl'}
          on:click={() => setLanguage('pl')}>Polski</button
        >
        <button
          type="button"
          lang="en"
          aria-pressed={$locale === 'en'}
          on:click={() => setLanguage('en')}>English</button
        >
      </div>
    </div>
  </section>
</dialog>

<dialog
  bind:this={confirmDialog}
  class="confirm"
  aria-labelledby="confirm-title"
  aria-describedby="confirm-description"
>
  <div class="dialog-heading">
    <h2 id="confirm-title">{$tr('Zacząć nową partię?')}</h2>
  </div>
  <p id="confirm-description">
    {$tr('Bieżąca partia i jej wyniki zostaną porzucone. Wrócisz do wyboru graczy.')}
  </p>
  <div class="confirm-actions">
    <button type="button" class="button subtle" on:click={() => confirmDialog.close()}
      >{$tr('Graj dalej')}</button
    >
    <button type="button" class="button primary" on:click={backToSetup}
      >{$tr('Nowa partia')}</button
    >
  </div>
</dialog>

<PlayerPickerDialog
  bind:this={playerPicker}
  enabled={isSetup}
  seat={selectedSeat}
  player={$game.playersSelect[selectedSeat]}
  select={choosePlayer}
/>

<dialog bind:this={rulesDialog} aria-labelledby="rules-title">
  <div class="dialog-heading">
    <h2 id="rules-title">{$tr('Jak grać w Tysiąca?')}</h2>
    <button
      class="close-button"
      on:click={() => rulesDialog.close()}
      aria-label={$tr('Zamknij zasady')}>×</button
    >
  </div>
  <div class="rules-grid">
    <p>
      <b>{$tr('01 · Talia i rozdanie')}</b>{$tr(
        'Trzech graczy, 24 karty od 9 do asa. Każdy dostaje 7 kart, a 3 zakryte tworzą musik. Rozdający zmienia się co rozdanie.',
      )}
    </p>
    <p>
      <b>{$tr('02 · Licytacja')}</b>{$tr(
        'Gracz po rozdającym musi otworzyć 100. Dalej każdy podbija o dowolną wielokrotność 10 (wolno skakać, np. ze 100 na 130) albo pasuje — pas jest ostateczny. Powyżej 120 można licytować tylko z meldunkiem w ręce (limit: 120 + wartość meldunków). Wygrywa ostatni, który nie spasował.',
      )}
    </p>
    <p>
      <b>{$tr('03 · Musik i kontrakt')}</b>{$tr(
        'Musik zostaje odkryty dla wszystkich. Rozgrywający bierze go, oddaje każdemu rywalowi po jednej zakrytej karcie i ustala kontrakt: co najmniej wylicytowaną wartość, powyżej 120 tylko z meldunkiem.',
      )}
    </p>
    <p>
      <b>{$tr('04 · Lewy')}</b>{$tr(
        'Osiem lew; do pierwszej wychodzi rozgrywający, do kolejnych zwycięzca poprzedniej. Lewę bierze najwyższy atut, a bez atutu najwyższa karta koloru wyjścia. Starszeństwo: A, 10, K, Q, J, 9.',
      )}
    </p>
    <p>
      <b>{$tr('05 · Dokładanie i przebijanie')}</b>{$tr(
        'Trzeba dołożyć do koloru wyjścia i przebić kartę, która na razie bierze lewę, jeśli masz wyższą. Gdy lewa jest już przebita atutem, wystarczy dowolna karta koloru. Bez koloru trzeba przebić atutem: dowolnym, gdy w lewie nie ma atutu, a wyższym, gdy już jest. Jeśli atutem nie wygrasz lewy, dajesz dowolną kartę — nikt nie musi dokładać niższego atutu.',
      )}
    </p>
    <p>
      <b>{$tr('06 · Meldunki')}</b>{$tr(
        'Gdy wychodzisz do dowolnej lewy — także pierwszej — królem lub damą i masz drugą kartę pary, meldunek zgłasza się sam: ♥ 100, ♦ 80, ♣ 60, ♠ 40. Kolor meldunku staje się atutem i zastępuje poprzedni.',
      )}
    </p>
    <p>
      <b>{$tr('07 · Punkty')}</b>{$tr(
        'Karty: A 11, 10 10, K 4, Q 3, J 2, 9 0 — razem 120. Rozgrywający dostaje +kontrakt, gdy karty i meldunki dadzą co najmniej tyle, inaczej −kontrakt. Obrońcy zapisują swoje punkty zaokrąglone do 10.',
      )}
    </p>
    <p>
      <b>{$tr('08 · Od 800 tylko jako grający')}</b>{$tr(
        'Od 800 pkt punkty zdobywa się tylko jako grający. Obrońca, który przed rozdaniem ma co najmniej 800, nic nie zapisuje (w wynikach „0 · 800+”), a rozgrywający zawsze dostaje ±kontrakt. Kłódka przy wyniku gracza oznacza tę blokadę. Potocznie bywa to nazywane „beczką”.',
      )}
    </p>
    <p>
      <b>{$tr('09 · Koniec partii')}</b>{$tr(
        'Partia kończy się po rozdaniu, w którym ktoś ma co najmniej 1000 pkt. Jeśli 1000 osiągnie rozgrywający, wygrywa on. W przeciwnym razie wygrywa najwyższy wynik, a remis dzieli zwycięstwo.',
      )}
    </p>
    <p class="rules-note">
      {$tr(
        'Uproszczenia tej wersji: nie ma bomby (poddania rozdania), ponownego rozdania za cztery dziewiątki ani gry we czterech. Meldunku nie można zatrzymać — zgłasza się sam — a musik jest zawsze pokazywany wszystkim.',
      )}
    </p>
  </div>
</dialog>

<style>
  @font-face {
    font-family: 'DM Sans';
    src: url('../assets/fonts/DMSans.ttf') format('truetype');
    font-style: normal;
    font-weight: 100 1000;
    font-display: swap;
  }
  :global(:root) {
    font-family: 'DM Sans', 'Segoe UI', system-ui, sans-serif;
    color: #e7e9dd;
    background: #111b18;
    font-synthesis: none;
    --text: #e7e9dd;
    --muted: #8c9b90;
    --line: #c5d3b513;
    color-scheme: dark;
  }
  :global(*) {
    box-sizing: border-box;
  }
  :global(body) {
    margin: 0;
    min-width: 320px;
    background: radial-gradient(ellipse at 15% 0, #24372a3b, transparent 55%), #111b18;
  }
  :global(button),
  :global(select),
  :global(input) {
    font: inherit;
  }
  :global(button),
  :global(a),
  :global(select),
  :global(input) {
    -webkit-tap-highlight-color: transparent;
  }
  :global(button:focus-visible),
  :global(a:focus-visible),
  :global(select:focus-visible),
  :global(input:focus-visible) {
    outline: 2px solid #c5dda9;
    outline-offset: 4px;
  }
  :global(button) {
    color: inherit;
  }
  :global(.mint) {
    background: #b6d5b51c;
    color: #c2dcb5;
  }
  :global(.amber) {
    background: #d9b4791c;
    color: #d9be84;
  }
  :global(.blue) {
    background: #a5c0dd1c;
    color: #b5cbe5;
  }
  :global(.lilac) {
    background: #c9b0e11c;
    color: #d1bee7;
  }
  :global(.rose) {
    background: #d996a01c;
    color: #e2a4ad;
  }
  :global(.orange) {
    background: #e6b2911c;
    color: #e6b291;
  }
  :global(.button) {
    min-height: 44px;
    border-radius: 7px;
    padding: 11px 17px;
    font-size: 14px;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    cursor: pointer;
    transition:
      background 150ms,
      transform 150ms;
  }
  :global(.button:not(:disabled):active) {
    transform: translateY(1px);
  }
  :global(.button.primary) {
    background: #d1dfb4;
    color: #233629;
    border: 1px solid #d1dfb4;
    box-shadow: 0 3px 10px #0002;
  }
  :global(.button.primary:hover:not(:disabled)) {
    background: #e0eacb;
  }
  :global(.button:disabled) {
    opacity: 0.4;
    cursor: default;
  }
  :global(.button.subtle) {
    background: transparent;
    border: 1px solid #8baf8544;
    color: #cadac2;
  }
  :global(.button.subtle:hover:not(:disabled)) {
    background: #304333;
  }

  .app-shell {
    max-width: 1120px;
    margin: 0 auto;
    padding: 0 24px 20px;
  }
  .app-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 0;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0 auto 0 0;
    color: #f0eddb;
    font:
      28px Georgia,
      serif;
    letter-spacing: 5px;
  }
  .brand-icon {
    width: 40px;
    height: 40px;
    flex-shrink: 0;
  }
  .brand-icon rect {
    fill: #182722;
    stroke: #b9c6a7;
    stroke-width: 1.4;
  }
  .brand-icon rect + rect {
    fill: #f3f0df;
    stroke: #d9d9cd;
  }
  .brand-icon text {
    fill: #be494b;
    font:
      15px Georgia,
      serif;
    letter-spacing: 0;
    text-anchor: middle;
  }
  nav {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .button-icon {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .panels {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
    gap: 10px;
    margin-top: 10px;
  }
  dialog {
    width: min(640px, calc(100% - 24px));
    max-height: calc(100dvh - 32px);
    padding: 0 24px 20px;
    color: var(--text);
    background: #1a2921;
    border: 1px solid #60785c;
    border-radius: 16px;
    box-shadow: 0 20px 80px #0006;
    overscroll-behavior: contain;
  }
  dialog::backdrop {
    background: #07110dd9;
  }
  :global(body:has(dialog[open])) {
    overflow: hidden;
  }
  .dialog-heading {
    position: sticky;
    top: 0;
    z-index: 2;
    background: #1a2921;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 72px;
    padding: 14px 0;
    border-bottom: 1px solid var(--line);
  }
  h2 {
    font-size: 19px;
    font-weight: 550;
    margin: 0;
  }
  .close-button {
    display: grid;
    place-items: center;
    min-width: 44px;
    min-height: 44px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: transparent;
    font-size: 26px;
    cursor: pointer;
  }
  .close-button:hover {
    background: #304333;
  }
  .setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    min-height: 60px;
    border-bottom: 1px solid var(--line);
    font-size: 14px;
  }
  .pace-row,
  .language-row {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
    padding: 14px 0;
  }
  .pace-options,
  .language-switch {
    display: flex;
    gap: 6px;
  }
  .pace-options button,
  .language-switch button {
    flex: 1;
    min-width: 0;
    min-height: 44px;
    padding: 8px 6px;
    border: 1px solid #637b5b;
    border-radius: 7px;
    background: transparent;
    color: #c8d4bb;
    font-size: 14px;
    cursor: pointer;
  }
  .pace-options button[aria-pressed='true'],
  .language-switch button[aria-pressed='true'] {
    background: #d1dfb4;
    color: #233629;
    border-color: #d1dfb4;
    font-weight: 650;
  }
  .pace-options button:not([aria-pressed='true']):hover,
  .language-switch button:not([aria-pressed='true']):hover {
    background: #304333;
  }
  .reveal {
    cursor: pointer;
  }
  .reveal input {
    width: 22px;
    height: 22px;
    accent-color: #c5dda9;
    margin: 11px;
  }
  .confirm {
    width: min(440px, calc(100% - 24px));
  }
  .confirm p {
    margin: 16px 0 20px;
    color: #c0ceb6;
    font-size: 15px;
    line-height: 1.6;
  }
  .confirm-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 8px;
  }
  .rules-grid {
    display: grid;
    gap: 4px;
  }
  .rules-grid p {
    font-size: 15px;
    line-height: 1.7;
    color: #c0ceb6;
    margin: 14px 0 0;
  }
  .rules-grid b {
    display: block;
    color: var(--text);
    margin-bottom: 5px;
  }
  .rules-grid .rules-note {
    padding-top: 12px;
    border-top: 1px solid var(--line);
    color: #9fb29e;
    font-size: 13px;
  }
  @media (max-width: 860px) {
    .panels {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  @media (max-width: 600px) {
    .app-shell {
      padding: 0 10px 14px;
    }
    .app-header {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 8px;
      padding: 8px 2px;
    }
    .brand {
      font-size: 22px;
      letter-spacing: 3px;
      gap: 6px;
    }
    .brand-icon {
      width: 34px;
      height: 34px;
    }
    .new-deal {
      grid-column: 2;
      grid-row: 1;
    }
    nav {
      grid-column: 1 / -1;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    dialog {
      padding: 0 16px 16px;
    }
  }
  @media (max-width: 360px) {
    .brand {
      font-size: 20px;
      letter-spacing: 2px;
    }
    .new-deal {
      padding-inline: 12px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    :global(.button) {
      transition: none;
    }
  }
</style>
