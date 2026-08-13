#!/usr/bin/env python3
"""Generate Android launcher and splash assets from Aniraku's approved PWA icon."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public" / "icons" / "icon-512.png"
RES = ROOT / "android" / "app" / "src" / "main" / "res"

ICON_SIZES = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}
FOREGROUND_SIZES = {
    "mipmap-mdpi": 108,
    "mipmap-hdpi": 162,
    "mipmap-xhdpi": 216,
    "mipmap-xxhdpi": 324,
    "mipmap-xxxhdpi": 432,
}
SPLASH_DIMS = {
    "drawable-port-mdpi": (360, 640),
    "drawable-port-hdpi": (540, 960),
    "drawable-port-xhdpi": (720, 1280),
    "drawable-port-xxhdpi": (1080, 1920),
    "drawable-port-xxxhdpi": (1440, 2560),
    "drawable-land-mdpi": (640, 360),
    "drawable-land-hdpi": (960, 540),
    "drawable-land-xhdpi": (1280, 720),
    "drawable-land-xxhdpi": (1920, 1080),
    "drawable-land-xxxhdpi": (2560, 1440),
}


def resize_square(source: Image.Image, size: int) -> Image.Image:
    return source.resize((size, size), Image.Resampling.LANCZOS)


def make_splash(source: Image.Image, dimensions: tuple[int, int]) -> Image.Image:
    width, height = dimensions
    canvas = Image.new("RGB", (width, height), "#000000")
    icon_size = int(min(width, height) * 0.30)
    icon = resize_square(source, icon_size).convert("RGB")
    canvas.paste(icon, ((width - icon_size) // 2, (height - icon_size) // 2))
    return canvas


def main() -> None:
    source = Image.open(SOURCE).convert("RGBA")
    for directory, size in ICON_SIZES.items():
        target = RES / directory
        target.mkdir(parents=True, exist_ok=True)
        icon = resize_square(source, size)
        icon.save(target / "ic_launcher.png", optimize=True)
        icon.save(target / "ic_launcher_round.png", optimize=True)
    for directory, size in FOREGROUND_SIZES.items():
        target = RES / directory
        target.mkdir(parents=True, exist_ok=True)
        resize_square(source, size).save(target / "ic_launcher_foreground.png", optimize=True)
    for directory, dimensions in SPLASH_DIMS.items():
        target = RES / directory
        target.mkdir(parents=True, exist_ok=True)
        make_splash(source, dimensions).save(target / "splash.png", optimize=True)
    drawable = RES / "drawable"
    drawable.mkdir(parents=True, exist_ok=True)
    make_splash(source, (1080, 1920)).save(drawable / "splash.png", optimize=True)
    print("Generated Android launcher and splash assets from", SOURCE)


if __name__ == "__main__":
    main()
