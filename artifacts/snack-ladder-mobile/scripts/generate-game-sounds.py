"""Create original, short game effects as bundled PCM WAV assets (no music)."""
import math
import random
import struct
import wave
from pathlib import Path

RATE = 22050
OUTPUT = Path(__file__).resolve().parent.parent / "assets" / "sounds"
OUTPUT.mkdir(parents=True, exist_ok=True)
rng = random.Random(42)


def save(name, duration, sample):
    data = bytearray()
    for index in range(int(RATE * duration)):
        t = index / RATE
        # Fade boundaries to avoid clicks; leave headroom for overlapping effects.
        fade = min(1.0, t / 0.006, (duration - t) / 0.015)
        value = max(-0.9, min(0.9, sample(t) * fade))
        data.extend(struct.pack("<h", int(value * 32767)))
    with wave.open(str(OUTPUT / f"{name}.wav"), "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(RATE)
        output.writeframes(data)


def dice(t):
    value = 0.0
    for offset in [0.0, 0.06, 0.125, 0.21, 0.305, 0.43, 0.55]:
        dt = t - offset
        if 0 <= dt < 0.055:
            value += math.exp(-dt * 80) * (
                0.42 * rng.uniform(-1, 1) + 0.22 * math.sin(2 * math.pi * 950 * dt)
            )
    return value


def step(t):
    return 0.48 * math.exp(-t * 28) * math.sin(
        2 * math.pi * (520 * t - 900 * t * t)
    )


def ladder(t):
    index = min(5, int(t / 0.11))
    dt = t - index * 0.11
    frequency = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568.0][index]
    return math.exp(-dt * 23) * (
        0.38 * math.sin(2 * math.pi * frequency * dt)
        + 0.08 * math.sin(2 * math.pi * frequency * 2 * dt)
    )


def snake(t):
    bite = 0.46 * math.exp(-t * 40) * math.sin(2 * math.pi * 150 * t)
    hiss = 0.23 * rng.uniform(-1, 1) * math.sin(math.pi * min(1, t / 0.62))
    slide = 0.18 * math.exp(-t * 3) * math.sin(2 * math.pi * (700 * t - 450 * t * t))
    return bite + hiss + slide


save("dice", 0.62, dice)
save("step", 0.15, step)
save("ladder", 0.68, ladder)
save("snake", 0.65, snake)
print(f"Generated four one-shot effects in {OUTPUT}")