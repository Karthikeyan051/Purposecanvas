"""
PurposeCanvas — Postprocessing Pipeline
Cleans BW images (outline/worksheet) for crisp, print-ready output.
Colour images are passed through unchanged.
"""
import numpy as np
import cv2
from PIL import Image


def postprocess(image: Image.Image, intent_type: str) -> Image.Image:
    """
    Apply postprocessing based on intent type.
    BW types (outline, worksheet): grayscale → adaptive threshold → Lanczos 2× upscale.
    Colour types: pass-through unchanged.
    """
    if intent_type in ("outline", "worksheet"):
        return _clean_bw(image)
    return image


def _clean_bw(image: Image.Image) -> Image.Image:
    """
    Convert to clean black lines on pure white background.
    Steps:
      1. PIL → numpy RGB → BGR (OpenCV)
      2. Grayscale
      3. Adaptive Gaussian threshold → binary BW
      4. Lanczos upscale 2× (512→1024 or 768→1536) for print quality
      5. BGR → RGB → PIL
    """
    # PIL → numpy BGR
    img_np = np.array(image.convert("RGB"))
    img_bgr = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR)

    # Grayscale
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)

    # Adaptive threshold: local neighbourhood binarisation
    # Eliminates grey halos that SD-Turbo often produces
    binary = cv2.adaptiveThreshold(
        gray,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        blockSize=11,
        C=2,
    )

    # Convert back to 3-channel for consistency
    binary_bgr = cv2.cvtColor(binary, cv2.COLOR_GRAY2BGR)

    # Back to PIL
    pil_bw = Image.fromarray(cv2.cvtColor(binary_bgr, cv2.COLOR_BGR2RGB))

    # Lanczos 2× upscale for print quality
    new_w = pil_bw.width * 2
    new_h = pil_bw.height * 2
    pil_upscaled = pil_bw.resize((new_w, new_h), Image.LANCZOS)

    return pil_upscaled


def get_pixel_stats(image: Image.Image) -> dict:
    """
    Compute pixel statistics used by the quality gate.
    Works on the postprocessed image.
    """
    gray_np = np.array(image.convert("L"))  # grayscale numpy
    total = gray_np.size

    black_pixels = int((gray_np < 30).sum())
    white_pixels = int((gray_np > 225).sum())
    gray_pixels = total - black_pixels - white_pixels

    gray_region = gray_np[(gray_np >= 30) & (gray_np <= 225)]
    gray_stddev = float(gray_region.std()) if gray_region.size > 0 else 0.0

    return {
        "total_pixels": total,
        "black_ratio": black_pixels / total,
        "white_ratio": white_pixels / total,
        "gray_ratio": gray_pixels / total,
        "gray_stddev": gray_stddev,
    }
