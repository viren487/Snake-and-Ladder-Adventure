import bombArtwork from './assets/power-art/bomb.jpg';
import defuserArtwork from './assets/power-art/defuser.jpg';
import antiVenomArtwork from './assets/power-art/anti-venom.jpg';
import knifeArtwork from './assets/power-art/knife.jpg';
import webShooterArtwork from './assets/power-art/web-shooter.jpg';

export type IllustratedPower = 'bomb' | 'antiVenom' | 'defuser' | 'webShooter' | 'knife';

const ARTWORK: Record<IllustratedPower, string> = {
  bomb: bombArtwork,
  antiVenom: antiVenomArtwork,
  defuser: defuserArtwork,
  webShooter: webShooterArtwork,
  knife: knifeArtwork,
};

const LABELS: Record<IllustratedPower, string> = {
  bomb: 'Bomb',
  antiVenom: 'Anti-Venom',
  defuser: 'Defuser Kit',
  webShooter: 'Web Shooter',
  knife: 'Knife',
};

export function PowerArtwork({
  power,
  size = 20,
  className = '',
}: {
  power: IllustratedPower;
  size?: number;
  className?: string;
}) {
  return (
    <img
      className={`power-artwork ${className}`.trim()}
      src={ARTWORK[power]}
      alt=""
      aria-hidden="true"
      draggable={false}
      title={LABELS[power]}
      style={{ width: size * 1.3, height: size, objectFit: 'contain', borderRadius: 4 }}
    />
  );
}
