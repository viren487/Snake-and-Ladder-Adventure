import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import type { GameState, ShootableSnakeSquare } from '@workspace/game-core';
import { BOOM_SQUARE, BULLET_PICKUP_SQUARES, GUN_SQUARES, KEY_SQUARES, LADDERS, MYSTERY_BOX_SQUARES, SNAKES, SHOOTABLE_SNAKE_SQUARES, squareAt } from '@workspace/game-core';
import { useColors } from '@/hooks/useColors';

type Props = {
  game: GameState;
  selectedTargets?: readonly ShootableSnakeSquare[];
  onSelectTarget?: (square: ShootableSnakeSquare) => void;
};

function centerForSquare(square: number) {
  for (let row = 0; row < 10; row += 1) {
    for (let column = 0; column < 10; column += 1) {
      if (squareAt(row, column) === square) {
        return { x: column * 100 + 50, y: row * 100 + 50, row, column };
      }
    }
  }
  return { x: 50, y: 950, row: 9, column: 0 };
}

function tileMarker(square: number) {
  if ((KEY_SQUARES as readonly number[]).includes(square)) return 'KEY';
  if ((BULLET_PICKUP_SQUARES as readonly number[]).includes(square)) return '+1';
  if ((MYSTERY_BOX_SQUARES as readonly number[]).includes(square)) return '?';
  if ((GUN_SQUARES as readonly number[]).includes(square)) return 'GUN';
  if (square === BOOM_SQUARE) return '!';
  if (square === 100) return 'CROWN';
  if (SNAKES.some((item) => item.from === square)) return 'S';
  if (LADDERS.some((item) => item.from === square)) return 'L';
  return '';
}

function tokenColor(color: string, colors: ReturnType<typeof useColors>) {
  switch (color) {
    case 'coral': return colors.tokenCoral;
    case 'green': return colors.tokenGreen;
    case 'purple': return colors.tokenPurple;
    default: return colors.tokenBlue;
  }
}

function PandaToken({ color }: { color: string }) {
  const colors = useColors();
  return (
    <View style={[styles.token, { backgroundColor: tokenColor(color, colors), borderColor: colors.foreground }]}>
      <View style={[styles.earLeft, { backgroundColor: colors.boardDark }]} />
      <View style={[styles.earRight, { backgroundColor: colors.boardDark }]} />
      <View style={[styles.face, { backgroundColor: colors.foreground }]}>
        <View style={[styles.eyeLeft, { backgroundColor: colors.boardDark }]} />
        <View style={[styles.eyeRight, { backgroundColor: colors.boardDark }]} />
      </View>
    </View>
  );
}

export function GameBoard({ game, selectedTargets = [], onSelectTarget }: Props) {
  const colors = useColors();
  const cells = Array.from({ length: 100 }, (_, index) => {
    const row = Math.floor(index / 10);
    const column = index % 10;
    return { row, column, square: squareAt(row, column) };
  });

  const snakePaths = SNAKES.map((snake) => {
    const start = centerForSquare(snake.from);
    const end = centerForSquare(snake.to);
    const bend = (start.x + end.x) / 2 + (snake.from % 2 ? 75 : -75);
    return { ...snake, start, end, d: `M ${start.x} ${start.y} Q ${bend} ${(start.y + end.y) / 2} ${end.x} ${end.y}` };
  });

  const ladderPaths = LADDERS.map((ladder) => {
    const start = centerForSquare(ladder.from);
    const end = centerForSquare(ladder.to);
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy) || 1;
    const offsetX = (dy / length) * 10;
    const offsetY = (-dx / length) * 10;
    const rungs = Array.from({ length: 5 }, (_, index) => {
      const fraction = (index + 1) / 6;
      const x = start.x + dx * fraction;
      const y = start.y + dy * fraction;
      return `M ${x - offsetX} ${y - offsetY} L ${x + offsetX} ${y + offsetY}`;
    }).join(' ');
    return {
      ...ladder,
      rails: `M ${start.x - offsetX} ${start.y - offsetY} L ${end.x - offsetX} ${end.y - offsetY} M ${start.x + offsetX} ${start.y + offsetY} L ${end.x + offsetX} ${end.y + offsetY}`,
      rungs,
    };
  });

  return (
    <View
      style={[
        styles.frame,
        {
          backgroundColor: colors.boardFrame,
          borderColor: colors.boardFrameLight,
          shadowColor: colors.boardDark,
        },
      ]}
      accessibilityLabel="Snake and ladder game board"
      testID="game-board"
    >
      <View style={[styles.inner, { borderColor: colors.boardFrameLight, backgroundColor: colors.boardGreen }]}>
        <View style={styles.grid}>
          {cells.map(({ row, column, square }) => {
            const locked = (KEY_SQUARES as readonly number[]).includes(square);
            const marked = !!tileMarker(square);
            const shade = (row + column) % 2 === 0 ? colors.boardCream : colors.boardGreen;
            const backgroundColor = locked
              ? colors.boardDark
              : square === 100
                ? colors.primary
                : marked && (BULLET_PICKUP_SQUARES as readonly number[]).includes(square)
                  ? colors.boardBlue
                  : shade;
            const isSnakeTarget = (SHOOTABLE_SNAKE_SQUARES as readonly number[]).includes(square);
            const targetAvailable = isSnakeTarget && game.players[game.currentPlayerIndex]?.snakeStuns[square as ShootableSnakeSquare] === 0;
            const selected = selectedTargets.includes(square as ShootableSnakeSquare);
            return (
              <Pressable
                key={square}
                accessibilityRole={targetAvailable ? 'button' : undefined}
                accessibilityLabel={targetAvailable ? `Aim at snake ${square}` : `Square ${square}${locked ? ', black key room' : ''}`}
                disabled={!targetAvailable || !onSelectTarget}
                onPress={() => onSelectTarget?.(square as ShootableSnakeSquare)}
                style={[
                  styles.cell,
                  { backgroundColor, borderColor: locked ? colors.boardFrameLight : colors.transparentBorder },
                  targetAvailable && styles.targetCell,
                  selected && { borderColor: colors.primary, borderWidth: 2 },
                ]}
              >
                <Text style={[styles.squareNumber, { color: locked ? colors.foreground : colors.boardInk }]}>
                  {square}
                </Text>
                {tileMarker(square) !== '' && (
                  <Text
                    style={[
                      styles.marker,
                      {
                        color: locked || square === 100 ? colors.primaryForeground : colors.boardDark,
                        backgroundColor: locked ? colors.boardFrame : 'transparent',
                      },
                    ]}
                  >
                    {isSnakeTarget ? `S${square}` : tileMarker(square)}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>

        <Svg style={StyleSheet.absoluteFill} viewBox="0 0 1000 1000" pointerEvents="none">
          {ladderPaths.map((ladder) => (
            <React.Fragment key={`ladder-${ladder.from}`}>
              <Path d={ladder.rails} stroke={colors.ladderInk} strokeWidth={13} strokeLinecap="round" fill="none" opacity={0.92} />
              <Path d={ladder.rungs} stroke={colors.boardFrameLight} strokeWidth={7} strokeLinecap="round" fill="none" />
            </React.Fragment>
          ))}
          {snakePaths.map((snake) => (
            <React.Fragment key={`snake-${snake.from}`}>
              <Path d={snake.d} stroke={colors.snakeInk} strokeWidth={15} strokeLinecap="round" fill="none" opacity={0.86} />
              <Circle cx={snake.start.x} cy={snake.start.y} r={15} fill={colors.snakeInk} />
              <Circle cx={snake.start.x - 5} cy={snake.start.y - 3} r={2.5} fill={colors.foreground} />
              <Circle cx={snake.start.x + 5} cy={snake.start.y - 3} r={2.5} fill={colors.foreground} />
            </React.Fragment>
          ))}
        </Svg>

        {game.players.map((player) => {
          if (player.position <= 0) return null;
          const { row, column } = centerForSquare(player.position);
          const stack = game.players.filter((other) => other.position === player.position);
          const stackIndex = stack.findIndex((other) => other.id === player.id);
          const shift = (stackIndex - (stack.length - 1) / 2) * 11;
          return (
            <View
              key={player.id}
              pointerEvents="none"
              style={[
                styles.pawnSpot,
                {
                  left: `${column * 10}%`,
                  top: `${row * 10}%`,
                  transform: [{ translateX: shift }],
                },
              ]}
            >
              <PandaToken color={player.color} />
            </View>
          );
        })}
      </View>
      <View style={styles.legend}>
        <Text style={[styles.legendText, { color: colors.secondaryForeground }]}>KEY · +1 ammo · ? mystery · GUN · ! boom</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
    padding: 8,
    borderWidth: 2,
    borderRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.26,
    shadowRadius: 16,
    elevation: 7,
  },
  inner: {
    width: '100%',
    aspectRatio: 1,
    borderWidth: 3,
    borderRadius: 11,
    overflow: 'hidden',
    position: 'relative',
  },
  grid: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: '10%',
    height: '10%',
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    paddingTop: 2,
    paddingBottom: 1,
    overflow: 'hidden',
  },
  targetCell: { borderWidth: 1.5 },
  squareNumber: {
    fontFamily: 'Fredoka_600SemiBold',
    fontSize: 10,
    lineHeight: 12,
  },
  marker: {
    alignSelf: 'flex-end',
    fontFamily: 'Nunito_700Bold',
    fontSize: 6,
    lineHeight: 8,
    paddingHorizontal: 1,
    borderRadius: 2,
  },
  pawnSpot: {
    position: 'absolute',
    width: '10%',
    height: '10%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  token: {
    width: 17,
    height: 20,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  face: {
    width: 12,
    height: 12,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    zIndex: 2,
  },
  earLeft: {
    position: 'absolute',
    top: 1,
    left: 1,
    width: 5,
    height: 5,
    borderRadius: 4,
  },
  earRight: {
    position: 'absolute',
    top: 1,
    right: 1,
    width: 5,
    height: 5,
    borderRadius: 4,
  },
  eyeLeft: { width: 3, height: 4, borderRadius: 3, transform: [{ rotate: '25deg' }] },
  eyeRight: { width: 3, height: 4, borderRadius: 3, transform: [{ rotate: '-25deg' }] },
  legend: { paddingTop: 8, alignItems: 'center' },
  legendText: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 10,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
});
