"""An original, short happy bamboo-slide effect, not background music."""
import math
import struct
import wave
from pathlib import Path

RATE = 22050
DURATION = 2.35
ROOT = Path(__file__).resolve().parents[3]
NOTES = [783.99, 1046.50, 1318.51, 1567.98, 1318.51, 1046.50, 783.99, 1046.50]
data = bytearray()
for i in range(int(RATE * DURATION)):
    t = i / RATE
    value = 0.0
    for j, frequency in enumerate(NOTES):
        dt = t - j * 0.23
        if 0 <= dt < 0.52:
            envelope = math.exp(-dt * 7.5) * min(1, dt / 0.008)
            value += envelope * (
                0.28 * math.sin(2 * math.pi * frequency * dt)
                + 0.07 * math.sin(2 * math.pi * frequency * 2 * dt)
            )
    # A soft playful descending whistle under the bright major-key chimes.
    if 0.12 < t < 1.9:
        u = t - 0.12
        value += 0.085 * math.sin(math.pi * u / 1.78) * math.sin(
            2 * math.pi * (1250 * u - 230 * u * u)
        )
    fade = min(1, t / 0.008, (DURATION - t) / 0.06)
    data.extend(struct.pack("<h", int(max(-0.85, min(0.85, value * fade)) * 32767)))

for directory in [
    ROOT / "artifacts/snack-ladder-mobile/assets/sounds",
    ROOT / "artifacts/snack-ladder-game/src/sounds",
]:
    with wave.open(str(directory / "happy.wav"), "wb") as sound:
        sound.setnchannels(1)
        sound.setsampwidth(2)
        sound.setframerate(RATE)
        sound.writeframes(data)
print("Generated matching 2.35-second happy slide effects for web and mobile.")