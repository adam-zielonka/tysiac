import { describe, expect, it } from 'vitest'
import { PlayerType } from '../../engine/PlayerType'
import { strategies, strategyTranslations } from '../../engine/strategies'
import { MCTSPlayer } from '../../engine/players/MCTSPlayer'
import { RolloutPlayer } from '../../engine/players/RolloutPlayer'
import { AZPlayer } from '../../engine/players/AZPlayer'
import {
  TACTICAL_CONTRACT_MARGIN,
  TACTICAL_MARGIN,
} from '../../engine/players/TacticalPlayer'
import { MATCH_WIN_BONUS, MOOD_POINTS, SAFE_LEAD } from '../../engine/players/match'
import { MOOD_CHANCE } from '../../engine/players/montecarlo'
import { LOCK_SCORE } from '../../engine/rules'

describe('strategies', () => {
  it('describes every player type with the PAN personas and colours', () => {
    const expected: Record<PlayerType, [string, string]> = {
      [PlayerType.Human]: ['Ty', 'mint'],
      [PlayerType.Random]: ['Felek', 'rose'],
      [PlayerType.Simple]: ['Bolek', 'amber'],
      [PlayerType.Tactical]: ['Tosia', 'mint'],
      [PlayerType.Rollout]: ['Bruno', 'orange'],
      [PlayerType.MCTS]: ['Monte', 'blue'],
      [PlayerType.AZ]: ['Ada', 'lilac'],
    }
    for (const type of Object.values(PlayerType)) {
      expect([strategies[type].name, strategies[type].color]).toEqual(expected[type])
    }
    expect(strategies[PlayerType.AZ].information).toBe('Zna wszystkie ręce')
  })

  it('translates every text shown to the player', () => {
    for (const strategy of Object.values(strategies)) {
      for (const text of [
        strategy.method,
        strategy.information,
        strategy.summary,
        strategy.description,
      ]) {
        expect(strategyTranslations[text], text).toBeTruthy()
      }
    }
  })

  it('keeps the tile summaries short, in both languages', () => {
    for (const strategy of Object.values(strategies)) {
      expect(strategy.summary.length, strategy.summary).toBeLessThanOrEqual(160)
      expect(strategyTranslations[strategy.summary].length).toBeLessThanOrEqual(160)
    }
    // Ada's summary starts with the warning that she sees every hand.
    expect(strategies[PlayerType.AZ].summary).toMatch(/^Zna wszystkie ręce/)
  })

  it('describes the bots without "it" in English', () => {
    for (const strategy of Object.values(strategies)) {
      const english = strategyTranslations[strategy.description]
      expect(english.replace('Leaves it to chance', '')).not.toMatch(/\bits?\b/i)
    }
  })

  it('quotes the numbers the bots really use', () => {
    const rollout = new RolloutPlayer(0)
    const mcts = new MCTSPlayer(0)
    const az = new AZPlayer(0)
    const text = (type: PlayerType) => strategies[type].description
    const percent = (chance: number) => `${Math.round(chance * 100)}%`
    expect(text(PlayerType.Tactical)).toContain(
      `pomniejszonej o ${TACTICAL_MARGIN} punktów`,
    )
    expect(text(PlayerType.Tactical)).toContain(`O ${MOOD_POINTS} punktów śmielej`)
    expect(text(PlayerType.Tactical)).toContain(`ma już ${LOCK_SCORE} punktów`)
    expect(text(PlayerType.Tactical)).toContain(`ma ${SAFE_LEAD} punktów przewagi`)
    expect(text(PlayerType.Tactical)).toContain(
      `pomniejszonej o ${TACTICAL_CONTRACT_MARGIN} punktów`,
    )
    expect(text(PlayerType.Rollout)).toContain(`z ${LOCK_SCORE} punktami`)
    expect(text(PlayerType.Rollout)).toContain(`warte ${MATCH_WIN_BONUS} punktów więcej`)
    expect(text(PlayerType.Rollout)).toContain(
      `przy ${percent(rollout.bidThreshold - MOOD_CHANCE)} albo dopiero przy ${percent(rollout.bidThreshold + MOOD_CHANCE)}`,
    )
    expect(text(PlayerType.MCTS)).toContain(
      `(${percent(mcts.bidThreshold - MOOD_CHANCE)} albo ${percent(mcts.bidThreshold + MOOD_CHANCE)},`,
    )
    expect(text(PlayerType.AZ)).toContain(`o ${MOOD_POINTS} punktów śmielej`)
    expect(text(PlayerType.AZ)).toContain(`(${LOCK_SCORE} punktów`)
    expect(text(PlayerType.Rollout)).toContain(`${rollout.samples} losowych układach`)
    expect(text(PlayerType.Rollout)).toContain(`${rollout.auctionSamples} symulacjach`)
    expect(text(PlayerType.Rollout)).toContain(`${rollout.bidThreshold * 100}%`)
    expect(text(PlayerType.Rollout)).toContain(`${rollout.contractSamples} symulacji`)
    expect(text(PlayerType.Rollout)).toContain(`${rollout.giftSamples} układach`)
    expect(text(PlayerType.MCTS)).toContain(`do ${mcts.iterations} iteracji`)
    expect(strategies[PlayerType.MCTS].summary).toContain(
      `do ${mcts.iterations} iteracji`,
    )
    expect(strategies[PlayerType.Rollout].summary).toContain(
      `${rollout.samples} losowych układach`,
    )
    expect(strategies[PlayerType.Rollout].summary).toContain(
      `ze ${rollout.auctionSamples} symulacji`,
    )
    expect(strategies[PlayerType.Rollout].summary).toContain(
      `z ${rollout.contractSamples}.`,
    )
    expect(text(PlayerType.AZ)).toContain(
      `(${az.planBudget / 1000} 000 pozycji na każdy wariant oddania kart)`,
    )
    expect(strategies[PlayerType.AZ].summary).toContain(
      `${az.nodeBudget / 1000} 000 pozycji`,
    )
    expect(text(PlayerType.MCTS)).toContain(`${Math.round(mcts.bidThreshold * 100)}%`)
    expect(text(PlayerType.AZ)).toContain(`${az.nodeBudget / 1000} 000 pozycji`)
  })
})
