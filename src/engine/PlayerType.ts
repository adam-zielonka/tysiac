export enum PlayerType {
  Human = 'Human',
  Random = 'Random',
  Simple = 'Simple',
  Tactical = 'Tactical',
  Rollout = 'Rollout',
  MCTS = 'MCTS',
  AZ = 'AZ',
}

export const BOT_TYPES: readonly PlayerType[] = [
  PlayerType.Random,
  PlayerType.Simple,
  PlayerType.Tactical,
  PlayerType.Rollout,
  PlayerType.MCTS,
  PlayerType.AZ,
]
