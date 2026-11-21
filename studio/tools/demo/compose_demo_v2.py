#!/usr/bin/env python3
"""Assemble demo v2: pad scenes to Marek VO, burn captions, mux H.264+AAC."""
from __future__ import annotations

import json
import subprocess
from pathlib import Path

RAW = Path("/tmp/rss-demo-v2/raw.webm")
MARK = Path("/tmp/rss-demo-v2/markers.json")
VO = Path("/tmp/rss-demo-v2/vo")
CAPS = Path("/workspace/rovihere/rovi-shadow-studio/tools/demo/captions_v2.json")
WORK = Path("/tmp/rss-demo-v2/compose")
OUT = Path("/workspace/rovi-shadow-studio-demo-v2.mp4")

# visual order of cut segments
SCENE_ORDER = [
    "title_hold", "title_fade",
    "biuro", "bibl", "art", "vid", "org", "kal", "zar", "kan", "settings", "end",
]
VO_FOR = {
    "title_hold": "title",
    "biuro": "biuro",
    "bibl": "bibl",
    "art": "art",
    "vid": "vid",
    "org": "org",
    "kal": "kal",
    "zar": "zar",
    "kan": "kan",
    "settings": "settings",
    "end": "end",
}
LEAD = {
    "title_hold": 0.30, "biuro": 0.35, "bibl": 0.50, "art": 0.30, "vid": 0.30,
    "org": 0.30, "kal": 0.30, "zar": 0.30, "kan": 0.30, "settings": 0.30, "end": 0.30,
}
TAIL = {
    "title_hold": 0.45, "biuro": 0.45, "bibl": 0.80, "art": 0.40, "vid": 0.40,
    "org": 0.40, "kal": 0.40, "zar": 0.40, "kan": 0.40, "settings": 0.50, "end": 0.80,
}


def run(cmd, **kw):
    print("+", " ".join(str(c) for c in cmd[:7]), "..." if len(cmd) > 7 else "", flush=True)
    subprocess.check_call(cmd, **kw)


def dur(path: Path) -> float:
    out = subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        text=True,
    ).strip()
    return float(out)


def ass_t(s: float) -> str:
    s = max(0.0, s)
    h = int(s // 3600)
    m = int((s % 3600) // 60)
    sec = s % 60
    return f"{h}:{m:02d}:{sec:05.2f}"


def main():
    WORK.mkdir(parents=True, exist_ok=True)
    m = json.loads(MARK.read_text())
    vo = json.loads((VO / "durations.json").read_text())["durations"]
    caps = json.loads(CAPS.read_text(encoding="utf-8"))

    trim_start = m["title_in"] - 0.12
    segs_src = {
        "title_hold": (trim_start, m["title_out_start"] - trim_start),
        "title_fade": (m["title_out_start"], m["biuro_in"] - m["title_out_start"]),
        "biuro": (m["biuro_in"], m["biuro_out"] - m["biuro_in"]),
        "bibl": (m["bibl_in"], m["bibl_out"] - m["bibl_in"]),
        "art": (m["art_list_in"], m["art_out"] - m["art_list_in"]),
        "vid": (m["vid_in"], m["vid_out"] - m["vid_in"]),
        "org": (m["org_in"], m["org_out"] - m["org_in"]),
        "kal": (m["kal_in"], m["kal_out"] - m["kal_in"]),
        "zar": (m["zar_in"], m["zar_out"] - m["zar_in"]),
        "kan": (m["kan_in"], m["kan_out"] - m["kan_in"]),
        "settings": (m["settings_in"], m["settings_out"] - m["settings_in"]),
        "end": (m["end_in"], m["end_out"] - m["end_in"]),
    }

    target = {}
    for name, (start, length) in segs_src.items():
        need = length
        if name in VO_FOR:
            need = max(length, LEAD[name] + vo[VO_FOR[name]] + TAIL[name])
        if name == "title_fade":
            need = length
        target[name] = need
        print(f"  {name}: src {length:.3f}s -> {need:.3f}s")

    parts = []
    for name in SCENE_ORDER:
        start, length = segs_src[name]
        cut = WORK / f"{name}_cut.mp4"
        run([
            "ffmpeg", "-y", "-i", str(RAW),
            "-ss", f"{start:.3f}", "-t", f"{length:.3f}",
            "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "17",
            "-pix_fmt", "yuv420p", "-r", "25", "-video_track_timescale", "25",
            str(cut),
        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        out = WORK / f"{name}.mp4"
        pad = target[name] - length
        if pad > 0.04:
            run([
                "ffmpeg", "-y", "-i", str(cut),
                "-vf", f"tpad=stop_mode=clone:stop_duration={pad:.3f}",
                "-c:v", "libx264", "-preset", "veryfast", "-crf", "17",
                "-pix_fmt", "yuv420p", "-r", "25", "-video_track_timescale", "25",
                str(out),
            ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        else:
            out = cut
        actual = dur(out)
        target[name] = actual
        parts.append(out)
        print(f"    encoded {name} {actual:.3f}s")

    lst = WORK / "list.txt"
    lst.write_text("".join(f"file '{p}'\n" for p in parts))
    silent = WORK / "silent.mp4"
    run([
        "ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(lst),
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "17",
        "-pix_fmt", "yuv420p", "-r", "25",
        str(silent),
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    total = dur(silent)
    print("silent video", total)

    t = 0.0
    when = {}
    for name in SCENE_ORDER:
        when[name] = (t, t + target[name])
        t += target[name]

    vo_at = {}
    for seg, vo_name in VO_FOR.items():
        vo_at[vo_name] = when[seg][0] + LEAD[seg]
    print("vo_at", {k: round(v, 3) for k, v in vo_at.items()})
    print("scenes", {k: (round(a, 3), round(b, 3)) for k, (a, b) in when.items()})

    # Mix narration (already wav 48k stereo)
    inputs = []
    filters = []
    names = list(VO_FOR.values())
    for i, name in enumerate(names):
        inputs += ["-i", str(VO / f"{name}.wav")]
        ms = int(round(vo_at[name] * 1000))
        filters.append(
            f"[{i}]adelay={ms}|{ms},aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[a{i}]"
        )
    mix = "".join(f"[a{i}]" for i in range(len(names))) + f"amix=inputs={len(names)}:duration=longest:dropout_transition=0:normalize=0[m]"
    voice = WORK / "voice.wav"
    fc = ";".join(filters) + ";" + mix + f";[m]loudnorm=I=-16:LRA=11:TP=-1.5,apad=pad_dur={total:.3f}[out]"
    run([
        "ffmpeg", "-y", *inputs,
        "-filter_complex", fc, "-map", "[out]", "-t", f"{total:.3f}",
        "-ar", "48000", "-ac", "2", str(voice),
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    # Captions — ASS alpha 00=opaque; dark box
    def cap_text(raw: str) -> str:
        return raw.replace("\n", r"\N")

    dialogue = []
    # map caption keys to scene windows
    cap_scenes = {
        "biuro": "biuro", "bibl": "bibl", "art": "art", "vid": "vid",
        "org": "org", "kal": "kal", "zar": "zar", "kan": "kan", "settings": "settings",
    }
    for key, seg in cap_scenes.items():
        a, b = when[seg]
        text = cap_text(caps[key])
        dialogue.append(f"Dialogue: 0,{ass_t(a+0.25)},{ass_t(b-0.12)},Cap,,0,0,0,,{text}")

    ass = WORK / "caps.ass"
    ass.write_text(
        "\ufeff"
        + """[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,DejaVu Sans,38,&H00FAF6BF,&H000000FF,&H2605080F,&H00000000,0,0,0,0,100,100,0.4,0,3,12,0,2,120,120,58,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
        + "\n".join(dialogue)
        + "\n",
        encoding="utf-8",
    )

    vf = f"subtitles={ass}:fontsdir=/usr/share/fonts/truetype/dejavu:charenc=UTF-8"
    run([
        "ffmpeg", "-y", "-i", str(silent), "-i", str(voice),
        "-vf", vf,
        "-c:v", "libx264", "-preset", "medium", "-crf", "18",
        "-pix_fmt", "yuv420p", "-r", "25",
        "-c:a", "aac", "-b:a", "160k", "-ac", "2", "-ar", "48000",
        "-movflags", "+faststart", "-shortest",
        str(OUT),
    ])
    print("WROTE", OUT, "size", OUT.stat().st_size, "dur", dur(OUT))
    (WORK / "timeline.json").write_text(json.dumps({
        "voice": "pl-PL-MarekNeural",
        "rate": "-8%",
        "pitch": "-2Hz",
        "vo": vo,
        "vo_at": vo_at,
        "scenes": {k: list(v) for k, v in when.items()},
        "total": total,
        "out": str(OUT),
    }, indent=2))


if __name__ == "__main__":
    main()
