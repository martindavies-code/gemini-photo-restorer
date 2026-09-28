#!/usr/bin/env python3
"""
Atelier 8K - Forensic Photo Restoration & Upscaling CLI
======================================================
Batch-restores and upscales photos using Gemini 3 Pro Image (Nano Banana Pro)
with forensic retouching and high-resolution output.
Remembers the last chosen directory and saves outputs to a FULLSIZE subfolder.
"""

import os
import sys
import json
import time
import math
import struct
import base64
import mimetypes
import argparse
from pathlib import Path
from typing import Optional, List, Tuple

# Load environment variables
try:
    from dotenv import load_dotenv
    script_env = Path(__file__).parent / ".env"
    if script_env.exists():
        load_dotenv(script_env)
    else:
        load_dotenv(Path.home() / ".env")
except ImportError:
    pass

RESTORATION_PROMPT = """You are a Senior High-End Photo Retoucher and AI Restoration Specialist with 20 years of experience working for top-tier publications like National Geographic and Vogue. You possess expert knowledge of photogrammetry, texture reconstruction, and professional studio lighting setups.

I have a low-quality source image that suffers from severe JPEG compression, digital noise, and lack of definition. It needs to be transformed into a gallery-quality asset suitable for large-format printing.

Perform a forensic restoration and massive upscale of this image to 8K resolution. Specifically:

1. Aggressively strip away all compression artefacts, colour banding, and sensor noise.

2. Reconstruct missing high-frequency details (such as skin pores, fabric weave, or surface textures) to eliminate any "soft" or blurry areas.

3. Re-light the scene to mimic a professional softbox setup, introducing gentle, volumetric shadows that add depth.

The final output must be a hyper-realistic, 8K resolution image. The aesthetic should match a RAW file taken with a high-end medium format camera (like a Phase One) and a prime lens at f/2.8.

Do not alter the fundamental composition or the identity of the subject. Strictly avoid the "waxy," "plastic," or overly smooth look common in AI upscaling. Do not over-saturate colours. Do not introduce over-sharpening halos. Ensure facial features remain anatomically correct and true to the original. Strictly preserve the original aspect ratio, framing, and physical geometry. Do NOT stretch, squash, crop, letterbox, pillarbox, pad, or alter the geometric perspective of the source image in any way."""

SUPPORTED_ASPECT_RATIOS = [
    ("1:1", 1.0),
    ("4:3", 4.0 / 3.0),
    ("3:4", 3.0 / 4.0),
    ("3:2", 1.5),
    ("2:3", 2.0 / 3.0),
    ("16:9", 16.0 / 9.0),
    ("9:16", 9.0 / 16.0),
    ("5:4", 1.25),
    ("4:5", 0.8),
    ("21:9", 21.0 / 9.0),
    ("4:1", 4.0),
    ("1:4", 0.25),
    ("8:1", 8.0),
    ("1:8", 0.125),
]

def find_closest_aspect_ratio(width: int, height: int) -> str:
    """Find the closest Gemini-supported aspect ratio using scale-invariant logarithmic difference."""
    if width <= 0 or height <= 0:
        return "1:1"
    target = width / height
    closest_label, _ = min(
        SUPPORTED_ASPECT_RATIOS,
        key=lambda item: abs(math.log(target) - math.log(item[1]))
    )
    return closest_label

def get_image_dimensions(image_path: Path) -> Tuple[int, int]:
    """Extract width and height from image headers using PIL, falling back to binary header parsing."""
    try:
        from PIL import Image
        with Image.open(image_path) as img:
            return img.size
    except Exception:
        pass

    try:
        with open(image_path, "rb") as f:
            data = f.read(65536)
        if data.startswith(b"\x89PNG\r\n\x1a\n") and len(data) >= 24:
            w, h = struct.unpack(">II", data[16:24])
            return (w, h)
        if data.startswith(b"\xff\xd8"):
            idx = 2
            while idx < len(data) - 9:
                if data[idx] != 0xff:
                    idx += 1
                    continue
                marker = data[idx + 1]
                if marker in [0xc0, 0xc1, 0xc2, 0xc3]:
                    h, w = struct.unpack(">HH", data[idx + 5:idx + 9])
                    return (w, h)
                length = struct.unpack(">H", data[idx + 2:idx + 4])[0]
                idx += 2 + length
    except Exception:
        pass

    return (0, 0)

CONFIG_FILE = Path(__file__).parent / "config.json"
SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff", ".tif"}


def load_config() -> dict:
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def save_config(config: dict):
    try:
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(config, f, indent=2)
    except Exception as e:
        print(f"[!] Warning: Could not save configuration: {e}")


def get_gemini_api_key() -> str:
    api_key = os.environ.get("GEMINI_API_KEY")
    if api_key and api_key.strip():
        return api_key.strip().strip("'\"")

    print("=" * 65)
    print(" [!] GEMINI_API_KEY not found in environment or .env file.")
    print(" You can obtain a free API key at: https://aistudio.google.com/app/apikey")
    print("=" * 65)
    try:
        user_key = input("Please enter your Gemini API Key: ").strip().strip("'\"")
    except (EOFError, KeyboardInterrupt):
        sys.exit(1)

    if not user_key:
        print("[x] Error: API Key is required to run the restoration.")
        sys.exit(1)

    # Save to local .env file
    env_file = Path(__file__).parent / ".env"
    try:
        with open(env_file, "a", encoding="utf-8") as f:
            f.write(f"\nGEMINI_API_KEY={user_key}\n")
        print(f"[+] Saved API key to {env_file}")
    except Exception as e:
        print(f"[!] Warning: Could not write to {env_file}: {e}")

    os.environ["GEMINI_API_KEY"] = user_key
    return user_key


def choose_folder_gui(initial_dir: Optional[str]) -> Optional[str]:
    """Launch native Windows directory picker."""
    try:
        import tkinter as tk
        from tkinter import filedialog

        root = tk.Tk()
        root.withdraw()
        root.attributes("-topmost", True)

        folder = filedialog.askdirectory(
            initialdir=initial_dir or str(Path.home() / "Pictures"),
            title="Select Folder Containing Images to Restore"
        )
        root.destroy()
        if folder and folder.strip():
            return folder.strip()
    except Exception:
        pass
    return None


def select_folder(cli_folder: Optional[str]) -> Path:
    config = load_config()
    last_folder = config.get("last_folder")

    if cli_folder:
        chosen = Path(cli_folder).resolve()
        if not chosen.is_dir():
            print(f"[x] Error: Specified path '{cli_folder}' is not a directory.")
            sys.exit(1)
        if chosen.name.upper() == "FULLSIZE":
            chosen = chosen.parent
        config["last_folder"] = str(chosen)
        save_config(config)
        return chosen

    # Try GUI picker first
    print("\n[+] Opening folder selection dialog...")
    gui_selected = choose_folder_gui(last_folder)

    if gui_selected:
        chosen = Path(gui_selected).resolve()
    else:
        # Fallback to terminal input
        prompt_text = f"\nEnter image folder path"
        if last_folder and os.path.isdir(last_folder):
            prompt_text += f" [Default: {last_folder}]: "
        else:
            prompt_text += ": "

        try:
            user_input = input(prompt_text).strip()
        except (EOFError, KeyboardInterrupt):
            sys.exit(1)

        if not user_input and last_folder and os.path.isdir(last_folder):
            chosen = Path(last_folder).resolve()
        elif user_input:
            cleaned = user_input.strip('"\'')
            chosen = Path(cleaned).resolve()
        else:
            print("[x] Error: No folder selected.")
            sys.exit(1)

    if not chosen.is_dir():
        print(f"[x] Error: '{chosen}' is not a valid directory.")
        sys.exit(1)

    # Prevent accidental selection of existing FULLSIZE subfolder
    if chosen.name.upper() == "FULLSIZE":
        print(f"[!] Note: You selected a 'FULLSIZE' folder directly.")
        parent = chosen.parent
        print(f"    Switching target to parent folder: {parent}")
        chosen = parent

    config["last_folder"] = str(chosen)
    save_config(config)
    return chosen


def get_image_files(folder: Path) -> List[Path]:
    """Return all supported images in folder, excluding any files inside FULLSIZE."""
    images = []
    try:
        for item in sorted(folder.iterdir()):
            if item.is_file() and item.suffix.lower() in SUPPORTED_EXTENSIONS:
                images.append(item)
    except PermissionError as e:
        print(f"[x] Permission error accessing folder: {e}")
    return images


def restore_image(client, image_path: Path, output_path: Path, model_name: str = "gemini-3-pro-image", resolution: str = "4K", aspect_ratio: str = "auto") -> bool:
    """Send image to Gemini for forensic restoration and upscale, preserving exact native aspect ratio."""
    from google.genai import types

    mime_type, _ = mimetypes.guess_type(str(image_path))
    if not mime_type:
        mime_type = "image/jpeg" if image_path.suffix.lower() in [".jpg", ".jpeg"] else "image/png"

    try:
        with open(image_path, "rb") as f:
            image_bytes = f.read()
    except Exception as e:
        print(f"    [!] Error reading file: {e}")
        return False

    if not image_bytes or len(image_bytes) == 0:
        print(f"    [!] Skipping empty or unreadable image (0 bytes): {image_path.name}")
        return False

    # Automatically detect native dimensions to prevent stretching/squashing
    if aspect_ratio == "auto":
        w, h = get_image_dimensions(image_path)
        if w > 0 and h > 0:
            target_aspect_ratio = find_closest_aspect_ratio(w, h)
            print(f"    [*] Source dimensions: {w}x{h} -> Matched aspect ratio: {target_aspect_ratio} (distortion-free)")
        else:
            target_aspect_ratio = "1:1"
    else:
        target_aspect_ratio = aspect_ratio

    temp_output_path = output_path.with_suffix(".tmp")

    try:
        # Primary method: client.models.generate_content with typed ImageConfig
        try:
            image_part = types.Part.from_bytes(data=image_bytes, mime_type=mime_type)
            response = client.models.generate_content(
                model=model_name,
                contents=[RESTORATION_PROMPT, image_part],
                config=types.GenerateContentConfig(
                    response_modalities=["IMAGE"],
                    image_config=types.ImageConfig(
                        image_size=resolution,
                        aspect_ratio=target_aspect_ratio
                    ),
                )
            )

            if response.candidates and response.candidates[0].content and response.candidates[0].content.parts:
                for part in response.candidates[0].content.parts:
                    if hasattr(part, "inline_data") and part.inline_data:
                        data = part.inline_data.data
                        out_bytes = base64.b64decode(data) if isinstance(data, str) else data
                        with open(temp_output_path, "wb") as out_f:
                            out_f.write(out_bytes)
                        if temp_output_path.exists():
                            temp_output_path.replace(output_path)
                            return True

                # If candidates exist but no image was returned, check finish reason
                finish_reason = getattr(response.candidates[0], "finish_reason", "UNKNOWN")
                print(f"    [!] Model completed without image part. Finish reason: {finish_reason}")
                if "SAFETY" in str(finish_reason):
                    return False

        except Exception as e_gen:
            err_str = str(e_gen)
            if "API_KEY_INVALID" in err_str or "403" in err_str:
                print(f"    [x] Authentication Error: {err_str}")
                return False
            # Otherwise attempt fallback

        # Fallback method: client.interactions.create
        try:
            interaction = client.interactions.create(
                model=model_name,
                input=[
                    {"type": "text", "text": RESTORATION_PROMPT},
                    {
                        "type": "image",
                        "data": base64.b64encode(image_bytes).decode("utf-8"),
                        "mime_type": mime_type
                    }
                ],
                response_format={"type": "image", "image_size": resolution}
            )

            if hasattr(interaction, "output_image") and interaction.output_image and interaction.output_image.data:
                out_bytes = base64.b64decode(interaction.output_image.data)
                with open(temp_output_path, "wb") as out_f:
                    out_f.write(out_bytes)
                if temp_output_path.exists():
                    temp_output_path.replace(output_path)
                    return True

            if hasattr(interaction, "steps"):
                for step in interaction.steps:
                    if step.get("type") == "model_output":
                        for c in step.get("content", []):
                            if c.get("type") == "image" and c.get("data"):
                                out_bytes = base64.b64decode(c["data"])
                                with open(temp_output_path, "wb") as out_f:
                                    out_f.write(out_bytes)
                                if temp_output_path.exists():
                                    temp_output_path.replace(output_path)
                                    return True
        except Exception as e_interact:
            print(f"    [!] API call failed: {e_interact}")

        return False

    finally:
        # Guarantee removal of any dangling incomplete .tmp file
        if temp_output_path.exists():
            try:
                temp_output_path.unlink()
            except Exception:
                pass


def main():
    parser = argparse.ArgumentParser(description="Atelier 8K — Forensic photo restoration & upscale via Gemini 3 Pro Image.")
    parser.add_argument("-f", "--folder", type=str, help="Path to image folder (bypasses dialog/prompt)")
    parser.add_argument("--force", action="store_true", help="Re-process images even if already in FULLSIZE")
    parser.add_argument("--model", type=str, default="gemini-3-pro-image", help="Gemini image model (default: gemini-3-pro-image)")
    parser.add_argument("-r", "--resolution", type=str, choices=["4K", "2K", "1K"], default="4K", help="Native output resolution (default: 4K)")
    parser.add_argument(
        "-a", "--aspect-ratio",
        type=str,
        default="auto",
        choices=["auto", "1:1", "4:3", "3:4", "3:2", "2:3", "16:9", "9:16", "5:4", "4:5", "21:9", "4:1", "1:4", "8:1", "1:8"],
        help="Target aspect ratio (default: 'auto' to preserve exact source dimensions without distortion)"
    )
    args = parser.parse_args()

    print("\n" + "=" * 65)
    print("    ATELIER 8K — FORENSIC PHOTO RESTORATION STUDIO")
    print(f"    Model: {args.model} ({args.resolution} Studio Output)")
    print(f"    Aspect Ratio Mode: {args.aspect_ratio}")
    print("=" * 65)

    api_key = get_gemini_api_key()

    from google import genai
    client = genai.Client(api_key=api_key)

    chosen_folder = select_folder(args.folder)
    print(f"\n[*] Source folder: {chosen_folder}")

    # Output directory
    fullsize_dir = chosen_folder / "FULLSIZE"
    try:
        fullsize_dir.mkdir(parents=True, exist_ok=True)
    except Exception as e:
        print(f"[x] Error creating output directory '{fullsize_dir}': {e}")
        sys.exit(1)

    print(f"[*] Output folder: {fullsize_dir}")

    images = get_image_files(chosen_folder)
    if not images:
        print(f"\n[!] No supported images found in '{chosen_folder}'.")
        print(f"    Supported formats: {', '.join(sorted(SUPPORTED_EXTENSIONS))}")
        return

    print(f"\n[+] Found {len(images)} image(s) to process.")

    success_count = 0
    skip_count = 0
    fail_count = 0
    start_total_time = time.time()

    try:
        for idx, img_path in enumerate(images, 1):
            out_filename = f"{img_path.stem}.png"
            out_path = fullsize_dir / out_filename

            print(f"\n-------------------------------------------------------------")
            print(f"[{idx}/{len(images)}] {img_path.name}")

            if out_path.exists() and not args.force:
                print(f"    [*] Already processed in FULLSIZE/{out_filename}. Skipping (use --force to overwrite).")
                skip_count += 1
                continue

            file_size_kb = img_path.stat().st_size / 1024
            print(f"    [*] Source: {file_size_kb:.1f} KB")
            print(f"    [*] Uploading to Gemini and performing forensic upscale...")

            t0 = time.time()
            ok = restore_image(client, img_path, out_path, model_name=args.model, resolution=args.resolution, aspect_ratio=args.aspect_ratio)
            elapsed = time.time() - t0

            if ok and out_path.exists():
                out_size_kb = out_path.stat().st_size / 1024
                print(f"    [OK] Restored in {elapsed:.1f}s -> Saved: FULLSIZE/{out_filename} ({out_size_kb:.1f} KB)")
                success_count += 1
            else:
                print(f"    [FAIL] Failed to restore {img_path.name}.")
                fail_count += 1

            # Standard rate limit buffer
            time.sleep(1)

    except KeyboardInterrupt:
        print("\n\n[!] Batch processing interrupted by user.")

    total_elapsed = time.time() - start_total_time
    print("\n" + "=" * 65)
    print("                      PROCESSING SUMMARY")
    print(f"  Total Processed: {success_count} | Skipped: {skip_count} | Failed: {fail_count}")
    print(f"  Total Duration:  {total_elapsed:.1f}s")
    print(f"  FULLSIZE Folder: {fullsize_dir}")
    print("=" * 65 + "\n")


if __name__ == "__main__":
    main()
