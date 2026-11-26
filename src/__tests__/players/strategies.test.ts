import { describe, expect, it } from 'vitest'
import { PlayerType } from '../../engine/PlayerType'
import { strategies, strategyTranslations } from '../../engine/strategies'
import { MCTSPlayer } from '../../engine/players/MCTSPlayer'
import { RolloutPlayer } from '../../engine/players/RolloutPlayer'
import { AZPlayer } from '../../engine/players/AZPlayer'
import { TACTICAL_MARGIN } from '../../engine/players/TacticalPlayer'

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
      for (const text of [strategy.method, strategy.information, strategy.description]) {
        expect(strategyTranslations[text], text).toBeTruthy()
      }
    }
  })

  it('quotes the numbers the bots really use', () => {
    const rollout = new RolloutPlayer(0)
    const mcts = new MCTSPlayer(0)
    const az = new AZPlayer(0)
    const text = (type: PlayerType) => strategies[type].description
    expect(text(PlayerType.Tactical)).toContain(`${TACTICAL_MARGIN} punktów`)
    expect(text(PlayerType.Rollout)).toContain(`${rollout.samples} losowych układach`)
    expect(text(PlayerType.Rollout)).toContain(`${rollout.auctionSamples} symulacjach`)
    expect(text(PlayerType.Rollout)).toContain(`${rollout.bidThreshold * 100}%`)
    expect(text(PlayerType.Rollout)).toContain(`${rollout.contractSamples} symulacji`)
    expect(text(PlayerType.Rollout)).toContain(`${rollout.giftSamples} układach`)
    expect(text(PlayerType.MCTS)).toContain(`${mcts.iterations} iteracji`)
    expect(text(PlayerType.MCTS)).toContain(`${Math.round(mcts.bidThreshold * 100)}%`)
    expect(text(PlayerType.AZ)).toContain(`${az.nodeBudget / 1000} 000 pozycji`)
  })
})
