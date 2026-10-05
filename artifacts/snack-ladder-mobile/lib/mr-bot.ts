import {
  SHOOTABLE_SNAKE_SQUARES,
  type GameState,
  type MysteryPowerType,
  type ShootableSnakeSquare,
} from '@workspace/game-core';

export type MrBotAction =
  | { type: 'roll' }
  | { type: 'choose'; power: MysteryPowerType }
  | { type: 'defend'; use: boolean }
  | { type: 'shoot'; targets: ShootableSnakeSquare[] }
  | { type: 'pass-shot' }
  | { type: 'extra-dice' }
  | { type: 'web'; targetPlayerId: string }
  | { type: 'knife'; targetPlayerId: string }
  | { type: 'plant'; square: number }
  | { type: 'detonate'; bombId: string; targetPlayerId: string };

function chooseMysteryPower(game: GameState, bot: GameState['players'][number], rival: GameState['players'][number]): MysteryPowerType {
  const rivalBombOnLanding = game.bombs.some((bomb) => bomb.ownerId === rival.id && bomb.square === bot.position);
  if (rivalBombOnLanding) return 'defuser';
  if (rival.position === bot.position && bot.position > 0 && rival.powers.knife < 1) return 'knife';
  if (rival.position > bot.position && rival.position - bot.position <= 3) return 'webShooter';
  if (bot.position > 0 && !game.bombs.some((bomb) => bomb.square === bot.position)) return 'bomb';
  if (game.bombs.some((bomb) => bomb.ownerId === rival.id)) return 'defuser';
  return 'antiVenom';
}

export function getMrBotAction(game: GameState, botPlayerId: string): MrBotAction | null {
  const bot = game.players.find((player) => player.id === botPlayerId);
  const rival = game.players.find((player) => player.id !== botPlayerId && !(game.winnerIds ?? []).includes(player.id));
  if (!bot || !rival || game.winnerId || (game.winnerIds ?? []).includes(botPlayerId)) return null;

  if (game.pendingChoice) {
    if (game.pendingChoice.playerId !== bot.id) return null;
    if (game.pendingChoice.kind === 'mystery') {
      return { type: 'choose', power: chooseMysteryPower(game, bot, rival) };
    }
    const use = game.pendingChoice.kind === 'snake'
      ? bot.powers.antiVenom > 0
      : bot.powers.defuser > 0;
    return { type: 'defend', use };
  }

  if (game.pendingFireForPlayerId) {
    if (game.pendingFireForPlayerId !== bot.id) return null;
    const available = SHOOTABLE_SNAKE_SQUARES.filter((square) => bot.snakeStuns[square] === 0);
    if (bot.bullets < 1 || available.length === 0) return { type: 'pass-shot' };
    if (bot.bullets >= 2 && available.length >= 2) return { type: 'shoot', targets: [...available] };
    const target = available.slice().sort((a, b) =>
      Math.abs(a - rival.position) - Math.abs(b - rival.position) || b - a,
    )[0];
    return { type: 'shoot', targets: [target] };
  }

  const rivalAtBotBomb = game.bombs.find((bomb) =>
    bomb.ownerId === bot.id && bomb.armed && rival.position === bomb.square,
  );
  if (rivalAtBotBomb) return { type: 'detonate', bombId: rivalAtBotBomb.id, targetPlayerId: rival.id };
  if (game.players[game.currentPlayerIndex]?.id !== bot.id) return null;

  if (bot.powers.extraDice > 0 && bot.extraRollCredits === 0) return { type: 'extra-dice' };
  if (bot.powers.webShooter > 0 && rival.position > bot.position && rival.position - bot.position <= 3) {
    return { type: 'web', targetPlayerId: rival.id };
  }
  if (bot.powers.knife > 0 && bot.position > 0 && rival.position === bot.position && rival.powers.knife < 1) {
    return { type: 'knife', targetPlayerId: rival.id };
  }
  if (bot.powers.bomb > 0 && bot.position > 0 && !game.bombs.some((bomb) => bomb.square === bot.position)) {
    return { type: 'plant', square: bot.position };
  }
  return { type: 'roll' };
}
