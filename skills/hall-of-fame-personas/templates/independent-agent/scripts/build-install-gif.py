from __future__ import annotations

import json
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "assets" / "install-motion.json"

WIDTH = 1200
HEIGHT = 800
GIF_SIZE = (960, 640)
FPS = 18
BG = (247, 243, 235)
INK = (48, 46, 42)
MUTED = (105, 101, 94)
FAINT = (151, 144, 133)
BRONZE = (181, 133, 83)
BRONZE_LIGHT = (230, 214, 193)
CONTENT_X = 168
CONTENT_W = 864

HOSTS = [
    "Codex",
    "Claude Code",
    "Cursor",
    "Gemini CLI",
    "GitHub Copilot",
    "OpenCode",
    "Windsurf",
    "Cline",
]

STATUSES = [
    (3.15, "INSPECT", "Reading the Agent package"),
    (4.25, "MATCH", "Choosing this Agent's skill location"),
    (5.35, "INSTALL", "Installing at user scope"),
    (6.45, "READY", "Available in a new chat"),
]


def load_config() -> dict[str, object]:
    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    required = {"agent_name", "headline", "promise", "repository", "skill_name", "output"}
    missing = required.difference(config)
    if missing:
        raise ValueError(f"Missing install motion fields: {', '.join(sorted(missing))}")
    headline = config["headline"]
    if not isinstance(headline, list) or len(headline) != 2 or not all(isinstance(line, str) for line in headline):
        raise ValueError("headline must contain exactly two strings")
    repository = str(config["repository"])
    if "/" not in repository or " " in repository:
        raise ValueError("repository must use owner/repository format")
    if not str(config["skill_name"]).strip():
        raise ValueError("skill_name must not be empty")
    return config


def choose_font(paths: list[str], size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for candidate in paths:
        try:
            return ImageFont.truetype(candidate, size=size)
        except OSError:
            continue
    return ImageFont.load_default(size=size)


SERIF_PATHS = [
    r"C:\Windows\Fonts\georgia.ttf",
    "/System/Library/Fonts/Supplemental/Georgia.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf",
]
SANS_PATHS = [
    r"C:\Windows\Fonts\segoeui.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
]
SANS_BOLD_PATHS = [
    r"C:\Windows\Fonts\segoeuib.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
]
MONO_PATHS = [
    r"C:\Windows\Fonts\consola.ttf",
    "/System/Library/Fonts/Menlo.ttc",
    "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
]

FONT_EYEBROW = choose_font(MONO_PATHS, 15)
FONT_HOST = choose_font(SANS_PATHS, 17)
FONT_HOST_BOLD = choose_font(SANS_BOLD_PATHS, 17)
FONT_TITLE = choose_font(SERIF_PATHS, 72)
FONT_BODY = choose_font(SANS_PATHS, 23)
FONT_LABEL = choose_font(MONO_PATHS, 14)
FONT_PROMPT = choose_font(MONO_PATHS, 18)
FONT_STATUS = choose_font(SANS_PATHS, 17)
FONT_STATUS_BOLD = choose_font(SANS_BOLD_PATHS, 17)
FONT_LINK = choose_font(SANS_PATHS, 16)


def clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def ease_out_cubic(value: float) -> float:
    value = clamp(value)
    return 1.0 - (1.0 - value) ** 3


def ease_in_out_cubic(value: float) -> float:
    value = clamp(value)
    if value < 0.5:
        return 4.0 * value**3
    return 1.0 - ((-2.0 * value + 2.0) ** 3) / 2.0


def window(t: float, start: float, duration: float) -> float:
    return clamp((t - start) / duration)


def global_alpha(t: float) -> float:
    return min(ease_out_cubic(window(t, 0.0, 0.62)), 1.0 - ease_in_out_cubic(window(t, 8.35, 0.65)))


def rgba(color: tuple[int, int, int], alpha: float) -> tuple[int, int, int, int]:
    return (*color, round(255 * clamp(alpha)))


def make_paper() -> Image.Image:
    random.seed(17)
    image = Image.new("RGB", (WIDTH, HEIGHT), BG)
    pixels = image.load()
    for y in range(HEIGHT):
        for x in range(WIDTH):
            grain = random.choice((-2, -1, 0, 0, 0, 1, 2))
            vignette = int(2.5 * (((x - WIDTH / 2) / (WIDTH / 2)) ** 2 + ((y - HEIGHT / 2) / (HEIGHT / 2)) ** 2))
            pixels[x, y] = tuple(max(0, min(255, channel + grain - vignette)) for channel in BG)
    return image


PAPER = make_paper()


def draw_letterspaced(draw: ImageDraw.ImageDraw, xy: tuple[int, int], value: str, text_font: ImageFont.ImageFont, fill: tuple[int, int, int, int], spacing: int) -> None:
    x, y = xy
    for character in value:
        draw.text((x, y), character, font=text_font, fill=fill)
        bbox = draw.textbbox((x, y), character, font=text_font)
        x += bbox[2] - bbox[0] + spacing


def wrap_text(draw: ImageDraw.ImageDraw, value: str, text_font: ImageFont.ImageFont, max_width: int) -> list[str]:
    lines: list[str] = []
    current = ""
    for word in value.split():
        candidate = word if not current else f"{current} {word}"
        bbox = draw.textbbox((0, 0), candidate, font=text_font)
        if bbox[2] - bbox[0] <= max_width:
            current = candidate
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def draw_intro(frame: Image.Image, t: float, master: float, config: dict[str, object]) -> None:
    layer = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    eyebrow_p = ease_out_cubic(window(t, 0.10, 0.55))
    draw_letterspaced(draw, (CONTENT_X, round(120 + (1.0 - eyebrow_p) * 12)), str(config["agent_name"]).upper(), FONT_EYEBROW, rgba(MUTED, master * eyebrow_p), 2)
    title_p = ease_out_cubic(window(t, 0.28, 0.72))
    title_y = round(168 + (1.0 - title_p) * 22)
    headline = config["headline"]
    draw.text((CONTENT_X, title_y), str(headline[0]), font=FONT_TITLE, fill=rgba(INK, master * title_p))
    draw.text((CONTENT_X, title_y + 83), str(headline[1]), font=FONT_TITLE, fill=rgba(INK, master * title_p))
    body_p = ease_out_cubic(window(t, 0.72, 0.62))
    draw.text((CONTENT_X, round(355 + (1.0 - body_p) * 14)), str(config["promise"]), font=FONT_BODY, fill=rgba(INK, master * body_p))
    frame.alpha_composite(layer)


def draw_host_carousel(frame: Image.Image, t: float, master: float) -> None:
    intro = ease_out_cubic(window(t, 0.92, 0.55))
    alpha = master * intro
    if alpha <= 0:
        return
    label_layer = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    label_draw = ImageDraw.Draw(label_layer)
    label_y = round(424 + (1.0 - intro) * 12)
    label_draw.text((CONTENT_X, label_y), "RUNS IN", font=FONT_LABEL, fill=rgba(FAINT, alpha))
    label_draw.line((CONTENT_X + 74, label_y + 12, CONTENT_X + 102, label_y + 12), fill=rgba(BRONZE, alpha), width=1)
    frame.alpha_composite(label_layer)
    clip = Image.new("RGBA", (250, 34), (0, 0, 0, 0))
    draw = ImageDraw.Draw(clip)
    raw = max(0.0, t - 1.15) / 0.70
    index = int(math.floor(raw))
    transition = ease_in_out_cubic(clamp(((raw - index) - 0.58) / 0.32))
    current = HOSTS[index % len(HOSTS)]
    following = HOSTS[(index + 1) % len(HOSTS)]
    final_transition = ease_in_out_cubic(window(t, 7.65, 0.45))
    if final_transition > 0:
        following = "Your Agent"
        transition = final_transition
    draw.text((0, round(5 - transition * 28)), current, font=FONT_HOST_BOLD, fill=rgba(INK, alpha * (1.0 - 0.35 * transition)))
    if transition > 0:
        draw.text((0, round(33 - transition * 28)), following, font=FONT_HOST_BOLD, fill=rgba(INK, alpha * transition))
    frame.alpha_composite(clip, (CONTENT_X + 119, 417))
    note = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    ImageDraw.Draw(note).text((CONTENT_X + 430, label_y), "Agent Skills compatible", font=FONT_HOST, fill=rgba(MUTED, alpha * 0.9))
    frame.alpha_composite(note)


def draw_prompt(frame: Image.Image, t: float, master: float, prompt: str) -> None:
    block_p = ease_out_cubic(window(t, 1.42, 0.62))
    block_a = master * block_p
    if block_a <= 0:
        return
    layer = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    base_y = round(491 + (1.0 - block_p) * 16)
    draw.text((CONTENT_X, base_y), "PASTE INTO YOUR AGENT", font=FONT_LABEL, fill=rgba(FAINT, block_a))
    line_y = base_y + 35
    line_p = ease_out_cubic(window(t, 1.62, 0.85))
    draw.line((CONTENT_X, line_y, CONTENT_X + round(CONTENT_W * line_p), line_y), fill=rgba(BRONZE, block_a), width=1)
    paste_p = ease_out_cubic(window(t, 2.06, 0.30))
    prompt_y = line_y + 20 + round((1.0 - paste_p) * 13)
    lines = wrap_text(draw, prompt, FONT_PROMPT, CONTENT_W - 42)
    flash = 1.0 - ease_out_cubic(window(t, 2.11, 0.65))
    if flash > 0:
        draw.rounded_rectangle((CONTENT_X - 12, prompt_y - 8, CONTENT_X + CONTENT_W, prompt_y + 58), radius=5, fill=rgba(BRONZE_LIGHT, block_a * flash * 0.52))
    draw.text((CONTENT_X, prompt_y), ">", font=FONT_PROMPT, fill=rgba(BRONZE, block_a * paste_p))
    text_x = CONTENT_X + 31
    for line_index, line in enumerate(lines):
        draw.text((text_x, prompt_y + line_index * 29), line, font=FONT_PROMPT, fill=rgba(INK, block_a * paste_p))
    progress = ease_in_out_cubic(window(t, 3.08, 3.78))
    if progress > 0:
        draw.line((CONTENT_X, line_y, CONTENT_X + round(CONTENT_W * progress), line_y), fill=rgba(BRONZE, block_a), width=2)
    frame.alpha_composite(layer)


def draw_status(frame: Image.Image, t: float, master: float) -> None:
    active = max((index for index, status in enumerate(STATUSES) if t >= status[0]), default=-1)
    if active < 0:
        return
    rail = Image.new("RGBA", (CONTENT_W, 35), (0, 0, 0, 0))
    draw = ImageDraw.Draw(rail)
    start, tag, message = STATUSES[active]
    transition = ease_in_out_cubic(window(t, start, 0.42))
    if active > 0 and transition < 1.0:
        previous = STATUSES[active - 1]
        draw.text((0, round(6 - transition * 29)), previous[1], font=FONT_STATUS_BOLD, fill=rgba(BRONZE, master * (1.0 - transition)))
        draw.text((84, round(6 - transition * 29)), previous[2], font=FONT_STATUS, fill=rgba(MUTED, master * (1.0 - transition)))
    new_y = round(35 - transition * 29)
    draw.text((0, new_y), tag, font=FONT_STATUS_BOLD, fill=rgba(BRONZE, master * transition))
    draw.text((84, new_y), message, font=FONT_STATUS, fill=rgba(INK if tag == "READY" else MUTED, master * transition))
    frame.alpha_composite(rail, (CONTENT_X, 667))
    footer_p = ease_out_cubic(window(t, 6.55, 0.55))
    if footer_p > 0:
        footer = Image.new("RGBA", frame.size, (0, 0, 0, 0))
        footer_draw = ImageDraw.Draw(footer)
        footer_draw.text((CONTENT_X, 725), "See setup for every supported Agent", font=FONT_LINK, fill=rgba(MUTED, master * footer_p))
        frame.alpha_composite(footer)


def render_frame(t: float, config: dict[str, object], prompt: str) -> Image.Image:
    frame = PAPER.convert("RGBA")
    master = global_alpha(t)
    draw_intro(frame, t, master, config)
    draw_host_carousel(frame, t, master)
    draw_prompt(frame, t, master, prompt)
    draw_status(frame, t, master)
    return frame.convert("RGB")


def build() -> None:
    config = load_config()
    prompt = f"Install {config['repository']} as a user-level Agent Skill for this agent. Inspect it first, use the matching host, and verify it is available."
    output = ROOT / str(config["output"])
    output.parent.mkdir(parents=True, exist_ok=True)
    frames = [render_frame(8.30, config, prompt)]
    frames.extend(render_frame(8.35 + index / FPS, config, prompt) for index in range(round(0.65 * FPS)))
    frames.extend(render_frame(index / FPS, config, prompt) for index in range(round(8.30 * FPS) + 1))
    palette_canvas = Image.new("RGB", (720, 480), BG)
    for index, key_time in enumerate([0.55, 1.55, 2.45, 3.55, 4.65, 5.55, 6.55, 7.20, 8.20]):
        sample = render_frame(key_time, config, prompt).resize((240, 160), Image.Resampling.LANCZOS)
        palette_canvas.paste(sample, ((index % 3) * 240, (index // 3) * 160))
    shared_palette = palette_canvas.quantize(colors=96, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    paletted = [frame.resize(GIF_SIZE, Image.Resampling.LANCZOS).quantize(palette=shared_palette, dither=Image.Dither.NONE) for frame in frames]
    paletted[0].save(output, save_all=True, append_images=paletted[1:], duration=[850] + [round(1000 / FPS)] * (len(paletted) - 1), loop=0, optimize=True, disposal=1)
    print(f"gif={output}")
    print(f"frames={len(frames)} size={GIF_SIZE[0]}x{GIF_SIZE[1]} loop=0")


if __name__ == "__main__":
    build()
