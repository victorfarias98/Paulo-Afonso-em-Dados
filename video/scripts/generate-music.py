"""Render an original, deterministic 60-second civic film score using stdlib.

No samples, downloads, voices, or third-party music are used. Run from any cwd:
    python3 video/scripts/generate-music.py
"""

from array import array
import math
from pathlib import Path
import random
import struct
import wave


RATE = 44_100
SECONDS = 60
BPM = 96
BEAT = 60 / BPM
TAU = math.tau
ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "music.wav"
SAMPLES = RATE * SECONDS
left = array("f", [0.0]) * SAMPLES
right = array("f", [0.0]) * SAMPLES
rng = random.Random(20261005)


def frequency(midi):
    return 440 * 2 ** ((midi - 69) / 12)


def note(start, midi, length, gain, pan=0, bass=False):
    """A warm struck harmonic tone with a soft onset and quiet stereo echoes."""
    pitch = frequency(midi)
    count = min(int(length * RATE), SAMPLES - int(start * RATE))
    offset = int(start * RATE)
    if count <= 0:
        return
    lg, rg = math.sqrt((1 - pan) / 2), math.sqrt((1 + pan) / 2)
    for index in range(count):
        time = index / RATE
        envelope = (1 - math.exp(-time * (65 if bass else 95)))
        envelope *= math.exp(-time * (2.1 if bass else 2.7))
        envelope *= min(1, (length - time) / 0.14)
        fundamental = math.sin(TAU * pitch * time)
        harmonic = 0.18 * math.sin(TAU * pitch * 2 * time)
        harmonic += 0.075 * math.sin(TAU * pitch * 3.001 * time)
        sample = gain * envelope * (fundamental + harmonic)
        position = offset + index
        left[position] += sample * lg
        right[position] += sample * rg
        if not bass:
            echo = position + int(0.1875 * RATE)
            if echo < SAMPLES:
                left[echo] += sample * rg * 0.12
                right[echo] += sample * lg * 0.12


def percussion(start, kind, gain):
    length = 0.20 if kind == "kick" else 0.055
    offset = int(start * RATE)
    phase = 0.0
    previous = 0.0
    for index in range(min(int(length * RATE), SAMPLES - offset)):
        time = index / RATE
        if kind == "kick":
            phase += TAU * (48 + 38 * math.exp(-time * 30)) / RATE
            sample = math.sin(phase) * math.exp(-time * 25)
        else:
            noise = rng.uniform(-1, 1)
            sample = (noise - previous) * math.exp(-time * 100)
            previous = noise
        sample *= gain * min(1, time * 1600)
        left[offset + index] += sample * 0.7
        right[offset + index] += sample * 0.7


# A six-cycle original Cmaj9 / Am9 / Fmaj9 / Gsus(add9) progression.
chords = ((60, 64, 67, 71, 74), (57, 60, 64, 67, 71),
          (53, 57, 60, 64, 67), (55, 60, 62, 67, 69))
motif = (0, 2, 1, 3, 2, 4, 3, 1)
for bar in range(24):
    chord = chords[bar % 4]
    start = bar * 4 * BEAT
    # Opening breath and a softer, resolving final four bars.
    intensity = 0.75 if bar < 2 else 1.0
    if bar >= 20:
        intensity *= 0.8
    for step, degree in enumerate(motif):
        timing = start + step * BEAT / 2
        note(timing, chord[degree] + 12, 1.55, 0.115 * intensity,
             pan=(-0.27 if step % 2 == 0 else 0.27))
    for degree in (0, 1, 2):
        note(start + degree * 0.032, chord[degree], 2.8,
             0.034 * intensity, pan=(degree - 1) * 0.4)
    for beat in (0, 2):
        note(start + beat * BEAT, chord[0] - 24, 1.1,
             0.13 * intensity, bass=True)
        if 2 <= bar < 22:
            percussion(start + beat * BEAT, "kick", 0.038)
    if 4 <= bar < 22:
        for step in range(8):
            percussion(start + step * BEAT / 2, "shaker", 0.006)

peak_before = max(max(abs(value) for value in left),
                  max(abs(value) for value in right))
normalization = 0.56 / peak_before
sum_squares = 0.0
peak = 0.0
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
with wave.open(str(OUTPUT), "wb") as output:
    output.setnchannels(2)
    output.setsampwidth(2)
    output.setframerate(RATE)
    block = bytearray()
    for index in range(SAMPLES):
        time = index / RATE
        fade_in = min(1, time / 1.4)
        fade_out = min(1, max(0, (SECONDS - time) / 3.0))
        fade = math.sin(fade_in * math.pi / 2) ** 2
        fade *= math.sin(fade_out * math.pi / 2) ** 2
        for channel in (left, right):
            value = channel[index] * normalization * fade
            peak = max(peak, abs(value))
            sum_squares += value * value
            block.extend(struct.pack("<h", round(value * 32767)))
        if len(block) >= 65536:
            output.writeframesraw(block)
            block.clear()
    output.writeframesraw(block)

rms = math.sqrt(sum_squares / (SAMPLES * 2))
print(f"Output: {OUTPUT}")
print(f"Duration: {SECONDS}s | stereo PCM16 | {RATE}Hz | {BPM} BPM")
print(f"Peak: {peak:.4f} ({20 * math.log10(peak):.2f} dBFS)")
print(f"RMS: {rms:.4f} ({20 * math.log10(rms):.2f} dBFS)")
