#!/usr/bin/env python3
"""Generate MarekNeural VO for each scene (short sentences + pauses)."""
from __future__ import annotations

import asyncio
import json
import subprocess
from pathlib import Path

import edge_tts

VOICE = "pl-PL-MarekNeural"
RATE = "-8%"
PITCH = "-2Hz"
NARR = Path("/workspace/rovihere/rovi-shadow-studio/tools/demo/narration_v2.json")
OUT = Path("/tmp/rss-demo-v2/vo")
GAP = 0.32  # pause between sentences inside a scene


def dur(path: Path) -> float:
    out = subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        text=True,
    ).strip()
    return float(out)


async def synth(text: str, dest: Path):
    comm = edge_tts.Communicate(text, VOICE, rate=RATE, pitch=PITCH)
    await comm.save(str(dest))


def concat_scene(wavs: list[Path], dest: Path):
    if len(wavs) == 1:
        subprocess.check_call(
            ["ffmpeg", "-y", "-i", str(wavs[0]), "-ac", "2", "-ar", "48000", "-c:a", "pcm_s16le", str(dest)],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        return
    # silences between
    parts = []
    files = []
    for i, w in enumerate(wavs):
        stereo = dest.parent / f"{dest.stem}_s{i}.wav"
        subprocess.check_call(
            ["ffmpeg", "-y", "-i", str(w), "-ac", "2", "-ar", "48000", "-c:a", "pcm_s16le", str(stereo)],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        files.append(stereo)
        parts.append(f"[{len(parts)}:a]")
        if i < len(wavs) - 1:
            sil = dest.parent / f"{dest.stem}_gap{i}.wav"
            subprocess.check_call(
                ["ffmpeg", "-y", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-t", f"{GAP}",
                 "-c:a", "pcm_s16le", str(sil)],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            )
            files.append(sil)
            parts.append(f"[{len(parts)}:a]")
    n = len(files)
    cmd = ["ffmpeg", "-y"]
    for f in files:
        cmd += ["-i", str(f)]
    cmd += [
        "-filter_complex", "".join(parts) + f"concat=n={n}:v=0:a=1[a]",
        "-map", "[a]", "-ac", "2", "-ar", "48000", "-c:a", "pcm_s16le", str(dest),
    ]
    subprocess.check_call(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


async def main():
    OUT.mkdir(parents=True, exist_ok=True)
    narr = json.loads(NARR.read_text(encoding="utf-8"))
    jobs = []
    paths = {}
    for scene, sents in narr.items():
        paths[scene] = []
        for i, sent in enumerate(sents):
            p = OUT / f"{scene}_{i}.mp3"
            paths[scene].append(p)
            jobs.append(synth(sent, p))
    await asyncio.gather(*jobs)
    print("synthesized", sum(len(v) for v in paths.values()), "sentences")
    report = {}
    for scene, mp3s in paths.items():
        wav = OUT / f"{scene}.wav"
        concat_scene(mp3s, wav)
        d = dur(wav)
        report[scene] = round(d, 3)
        print(f"  {scene}: {d:.3f}s")
    (OUT / "durations.json").write_text(json.dumps({"voice": VOICE, "rate": RATE, "pitch": PITCH, "durations": report}, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
