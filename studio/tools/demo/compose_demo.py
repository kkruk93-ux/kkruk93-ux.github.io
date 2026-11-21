#!/usr/bin/env python3
"""Trim the recorded tour, pad scenes to the Polish VO, burn captions, mux audio."""
from __future__ import annotations

import json
import subprocess
from pathlib import Path

RAW = Path("/tmp/rss-demo/raw.webm")
MARK = Path("/tmp/rss-demo/markers.json")
VO = Path("/tmp/rss-demo/vo")
WORK = Path("/tmp/rss-demo/compose")
OUT = Path("/workspace/rovi-shadow-studio-demo.mp4")
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


def run(cmd, **kw):
    print("+", " ".join(str(c) for c in cmd[:8]), "..." if len(cmd) > 8 else "", flush=True)
    subprocess.check_call(cmd, **kw)


def dur(path: Path) -> float:
    out = subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        text=True,
    ).strip()
    return float(out)


def main():
    WORK.mkdir(parents=True, exist_ok=True)
    m = json.loads(MARK.read_text())
    vo = {name: dur(VO / f"{name}.mp3") for name in ("title", "bibl", "office", "art", "vid", "end")}
    print("vo", vo)

    trim_start = m["title_in"] - 0.12
    segs_src = {
        "title_hold": (trim_start, m["title_out_start"] - trim_start),
        "title_fade": (m["title_out_start"], m["map_visible"] - m["title_out_start"]),
        "bibl": (m["map_visible"], m["bibl_end"] - m["map_visible"]),
        "office": (m["bibl_end"], m["office_end"] - m["bibl_end"]),
        "art": (m["office_end"], m["art_end"] - m["office_end"]),
        "vid": (m["art_end"], m["end_in"] - m["art_end"]),
        "end": (m["end_in"], m["end_out"] - m["end_in"]),
    }

    # How long each scene must last to comfortably fit the voice
    lead = {"title_hold": 0.25, "bibl": 0.45, "office": 0.25, "art": 0.25, "vid": 0.25, "end": 0.30}
    tail = {"title_hold": 0.40, "bibl": 0.80, "office": 0.45, "art": 0.45, "vid": 0.45, "end": 0.80}
    vo_for = {"title_hold": "title", "bibl": "bibl", "office": "office", "art": "art", "vid": "vid", "end": "end"}

    target = {}
    for name, (start, length) in segs_src.items():
        need = length
        if name in vo_for:
            need = max(length, lead[name] + vo[vo_for[name]] + tail[name])
        if name == "title_fade":
            need = length  # never pad the fade itself
        target[name] = need
        print(f"  {name}: src {length:.3f}s -> {need:.3f}s")

    # Cut + optionally freeze-pad
    parts = []
    for name, (start, length) in segs_src.items():
        cut = WORK / f"{name}_cut.mp4"
        run([
            "ffmpeg", "-y", "-i", str(RAW),
            "-ss", f"{start:.3f}", "-t", f"{length:.3f}",
            "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "16",
            "-pix_fmt", "yuv420p", "-r", "25", "-video_track_timescale", "25",
            str(cut),
        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        out = WORK / f"{name}.mp4"
        pad = target[name] - length
        if pad > 0.04:
            run([
                "ffmpeg", "-y", "-i", str(cut),
                "-vf", f"tpad=stop_mode=clone:stop_duration={pad:.3f}",
                "-c:v", "libx264", "-preset", "veryfast", "-crf", "16",
                "-pix_fmt", "yuv420p", "-r", "25", "-video_track_timescale", "25",
                str(out),
            ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        else:
            out = cut
        actual = dur(out)
        target[name] = actual  # use real encoded duration
        parts.append(out)
        print(f"    encoded {name} {actual:.3f}s")

    # Concat video
    lst = WORK / "list.txt"
    lst.write_text("".join(f"file '{p}'\n" for p in parts))
    silent = WORK / "silent.mp4"
    run([
        "ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(lst),
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "16",
        "-pix_fmt", "yuv420p", "-r", "25",
        str(silent),
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    total = dur(silent)
    print("silent video", total)

    # Timeline for VO and captions
    t = 0.0
    when = {}
    for name in ("title_hold", "title_fade", "bibl", "office", "art", "vid", "end"):
        when[name] = (t, t + target[name])
        t += target[name]

    vo_at = {
        "title": when["title_hold"][0] + lead["title_hold"],
        "bibl": when["bibl"][0] + lead["bibl"],
        "office": when["office"][0] + lead["office"],
        "art": when["art"][0] + lead["art"],
        "vid": when["vid"][0] + lead["vid"],
        "end": when["end"][0] + lead["end"],
    }
    print("vo_at", {k: round(v, 3) for k, v in vo_at.items()})
    print("scenes", {k: (round(a, 3), round(b, 3)) for k, (a, b) in when.items()})

    # Mix narration
    # Convert to wav, adelay in ms
    inputs = []
    filters = []
    for i, name in enumerate(("title", "bibl", "office", "art", "vid", "end")):
        wav = WORK / f"{name}.wav"
        run([
            "ffmpeg", "-y", "-i", str(VO / f"{name}.mp3"),
            "-ac", "2", "-ar", "48000", "-c:a", "pcm_s16le", str(wav),
        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        inputs += ["-i", str(wav)]
        ms = int(round(vo_at[name] * 1000))
        filters.append(f"[{i}]adelay={ms}|{ms},aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[a{i}]")
    mix = "".join(f"[a{i}]" for i in range(6)) + "amix=inputs=6:duration=longest:dropout_transition=0:normalize=0[m]"
    voice = WORK / "voice.wav"
    fc = ";".join(filters) + ";" + mix + ";[m]loudnorm=I=-16:LRA=11:TP=-1.5,apad=pad_dur=" + f"{total:.3f}" + "[out]"
    run([
        "ffmpeg", "-y", *inputs,
        "-filter_complex", fc, "-map", "[out]", "-t", f"{total:.3f}",
        "-ar", "48000", "-ac", "2", str(voice),
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    # Captions (keep them, aligned with scenes / VO)
    # Times in ASS: H:MM:SS.cc
    def ass_t(s):
        if s < 0:
            s = 0
        h = int(s // 3600)
        mnt = int((s % 3600) // 60)
        sec = s % 60
        return f"{h}:{mnt:02d}:{sec:05.2f}"

    caps = [
        # title has on-screen typography already
        (when["bibl"][0] + 0.35, when["bibl"][1] - 0.15,
         r"Pamięć firmy: wszystko, co stworzyliśmy,\Npołączone w jedną mapę"),
        (when["office"][0] + 0.20, when["office"][1] - 0.12,
         r"Biuro: gabinet honorowy, sala i zespoły"),
        (when["art"][0] + 0.20, when["art"][1] - 0.12,
         r"Artykuły — dłuższe teksty z X, z etykietami i źródłami"),
        (when["vid"][0] + 0.20, when["vid"][1] - 0.12,
         r"Filmy do pobrania — oficjalne materiały Blue Mold"),
    ]
    dialogue = []
    for a, b, text in caps:
        dialogue.append(f"Dialogue: 0,{ass_t(a)},{ass_t(b)},Cap,,0,0,0,,{text}")
    ass = WORK / "caps.ass"
    ass.write_text(
        "\ufeff"  # BOM helps some libass builds with UTF-8
        + """[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,DejaVu Sans,40,&H00FAF6BF,&H000000FF,&HAA05080F,&H8005080F,0,0,0,0,100,100,0.6,0,1,5,0,2,90,90,68,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
        + "\n".join(dialogue)
        + "\n",
        encoding="utf-8",
    )

    # Final mux + burn captions
    # fontsdir so DejaVu is found
    vf = f"subtitles={ass}:fontsdir=/usr/share/fonts/truetype/dejavu:charenc=UTF-8"
    run([
        "ffmpeg", "-y", "-i", str(silent), "-i", str(voice),
        "-vf", vf,
        "-c:v", "libx264", "-preset", "medium", "-crf", "17",
        "-pix_fmt", "yuv420p", "-r", "25",
        "-c:a", "aac", "-b:a", "192k", "-ac", "2", "-ar", "48000",
        "-movflags", "+faststart", "-shortest",
        str(OUT),
    ])
    print("WROTE", OUT, "size", OUT.stat().st_size, "dur", dur(OUT))
    (WORK / "timeline.json").write_text(json.dumps({
        "vo": vo, "vo_at": vo_at,
        "scenes": {k: list(v) for k, v in when.items()},
        "total": total, "out": str(OUT),
    }, indent=2))


if __name__ == "__main__":
    main()
