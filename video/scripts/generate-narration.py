"""Generate pt-BR narration with edge-tts in an isolated Python environment.

Install edge-tts, then run this file. Requires ffmpeg and ffprobe on PATH.
The online synthesizer receives only the public script below; no project data.
"""

import asyncio
import json
from pathlib import Path
import re
import subprocess

import edge_tts


OUTPUT = Path(__file__).resolve().parents[1] / "public"
VOICE = "pt-BR-FranciscaNeural"
SCENES = (
    (5.5, "Sua cidade gera dados todos os dias. Entender o que eles dizem ainda dá trabalho."),
    (6.5, "O Paulo Afonso em Dados organiza tudo em um portal simples, gratuito e feito para a população."),
    (7.5, "Nos dias úteis, o coletor consulta fontes oficiais, registra o que mudou e atualiza o portal automaticamente."),
    (10, "Nos gastos, você acompanha dinheiro reservado, entrega conferida e pagamento. Também vê fornecedor, órgão, objeto e contrato relacionado."),
    (7, "No P.A Stories, as novidades aparecem em sequência, com contexto e acesso direto aos registros."),
    (8.5, "Na Câmara, consulte projetos, requerimentos e matérias por vereador. Cada número leva ao documento publicado no SAPL."),
    (8, "Sinais de variação e concentração seguem regras transparentes, sem julgamento automático e com a fonte visível."),
    (7, "Acesse Paulo Afonso em Dados ponto Baius Tecnologia ponto com ponto br. Pesquise e acompanhe a cidade."),
)


def duration(path):
    return float(subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", str(path),
    ], text=True).strip())


def levels(path):
    result = subprocess.run([
        "ffmpeg", "-hide_banner", "-i", str(path), "-af", "volumedetect",
        "-f", "null", "-",
    ], text=True, capture_output=True, check=True)
    return {
        "peakDbfs": float(re.search(r"max_volume: ([-\d.]+) dB", result.stderr)[1]),
        "meanDbfs": float(re.search(r"mean_volume: ([-\d.]+) dB", result.stderr)[1]),
    }


async def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    timings = []
    scene_start = 0
    for index, (scene_duration, text) in enumerate(SCENES, start=1):
        target = OUTPUT / f"narration-{index}.mp3"
        rate = 5
        for attempt in range(3):
            await asyncio.wait_for(
                edge_tts.Communicate(text, VOICE, rate=f"+{rate}%").save(str(target)),
                timeout=40,
            )
            measured = duration(target)
            if measured <= scene_duration - 0.7:
                break
            # Prefer voice-engine pacing over large time stretching.
            rate += max(5, round((measured / (scene_duration - 0.7) - 1) * 100))
        stretch = max(1, measured / (scene_duration - 0.72))
        if stretch > 1.15:
            raise RuntimeError(f"Scene {index} exceeds safe pacing: {measured:.2f}s")
        if stretch > 1:
            adjusted = OUTPUT / f"narration-{index}-adjusted.mp3"
            subprocess.run([
                "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                "-i", str(target), "-af", f"atempo={stretch:.6f}",
                "-codec:a", "libmp3lame", "-b:a", "128k", str(adjusted),
            ], check=True)
            adjusted.replace(target)
            measured = duration(target)
        timings.append({
            "scene": index, "file": target.name, "text": text,
            "sceneStartSeconds": scene_start, "sceneDurationSeconds": scene_duration,
            "startOffsetSeconds": 10 / 30, "durationSeconds": round(measured, 6),
            "rate": f"+{rate}%", "timeStretch": round(stretch, 6),
            **levels(target),
        })
        print(f"Scene {index}: {measured:.3f}s / {scene_duration}s, rate +{rate}%", flush=True)
        scene_start += scene_duration
    metadata = {"voice": VOICE, "language": "pt-BR", "totalSeconds": scene_start,
                "scenes": timings}
    (OUTPUT / "narration-timing.json").write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    asyncio.run(main())
