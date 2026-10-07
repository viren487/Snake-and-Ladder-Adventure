import { Image, type ImageSourcePropType } from 'react-native';

export type IllustratedPower = 'bomb' | 'antiVenom' | 'defuser' | 'webShooter' | 'knife';

const ARTWORK: Record<IllustratedPower, ImageSourcePropType> = {
  bomb: require('../assets/power-art/bomb.jpg'),
  antiVenom: require('../assets/power-art/anti-venom.jpg'),
  defuser: require('../assets/power-art/defuser.jpg'),
  webShooter: require('../assets/power-art/web-shooter.jpg'),
  knife: require('../assets/power-art/knife.jpg'),
};

const LABELS: Record<IllustratedPower, string> = {
  bomb: 'Bomb',
  antiVenom: 'Anti-Venom',
  defuser: 'Defuser Kit',
  webShooter: 'Web Shooter',
  knife: 'Knife',
};

export function PowerArtwork({ power, size = 20 }: { power: IllustratedPower; size?: number }) {
  return (
    <Image
      source={ARTWORK[power]}
      resizeMode="contain"
      accessible={false}
      accessibilityLabel={LABELS[power]}
      style={{ width: size * 1.3, height: size, borderRadius: 4 }}
    />
  );
}
