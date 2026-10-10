"""
download_wheels.py — Resume-capable wheel downloader.
Downloads large wheels with HTTP Range headers so WiFi drops don't restart from zero.
Then installs from local .whl files.

Run: python download_wheels.py
"""
import sys, io
# Force UTF-8 output on Windows PowerShell
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

import os
import time
import subprocess
import urllib.request
import urllib.error
import json

WHEELS_DIR = "wheels"
os.makedirs(WHEELS_DIR, exist_ok=True)

# PyPI JSON API to get latest wheel URL
PACKAGES = [
    ("diffusers",            "cp312", "win_amd64"),
    ("chromadb",             "cp39",  "win_amd64"),   # abi3 wheel
    ("sentence-transformers","py3",   "none"),         # pure python
    ("accelerate",           "py3",   "none"),
    ("google-genai",         "py3",   "none"),
    ("pypdf",                "py3",   "none"),
    ("python-docx",          "py3",   "none"),
]

def get_wheel_url(package: str, cp: str, plat: str) -> tuple[str, str]:
    """Fetch best matching wheel URL from PyPI JSON API."""
    url = f"https://pypi.org/pypi/{package}/json"
    with urllib.request.urlopen(url, timeout=15) as r:
        data = json.loads(r.read())
    
    latest = data["info"]["version"]
    files = data["releases"][latest]
    
    # Priority: exact cp match, then abi3, then py3 none-any
    candidates = []
    for f in files:
        fn = f["filename"]
        if not fn.endswith(".whl"):
            continue
        parts = fn.rstrip(".whl").split("-")
        # parts: name-version-pythontag-abitag-platformtag
        if len(parts) < 5:
            continue
        pytag, abitag, pltag = parts[2], parts[3], parts[4]
        score = 0
        if cp in pytag: score += 2
        if "win_amd64" in pltag or "any" in pltag: score += 1
        candidates.append((score, fn, f["url"]))
    
    if not candidates:
        raise RuntimeError(f"No wheel found for {package}")
    
    candidates.sort(reverse=True)
    best_fn, best_url = candidates[0][1], candidates[0][2]
    return best_fn, best_url


def download_with_resume(url: str, dest: str, max_retries: int = 20) -> bool:
    """Download with HTTP Range resume. Retries on connection drop."""
    attempt = 0
    while attempt < max_retries:
        existing = os.path.getsize(dest) if os.path.exists(dest) else 0
        
        try:
            req = urllib.request.Request(url)
            if existing > 0:
                req.add_header("Range", f"bytes={existing}-")
            
            with urllib.request.urlopen(req, timeout=60) as r:
                total = int(r.headers.get("Content-Length", 0)) + existing
                content_range = r.headers.get("Content-Range", "")
                
                mode = "ab" if existing > 0 and content_range else "wb"
                if mode == "wb":
                    existing = 0
                
                with open(dest, mode) as f:
                    downloaded = existing
                    while True:
                        chunk = r.read(65536)  # 64KB chunks
                        if not chunk:
                            break
                        f.write(chunk)
                        downloaded += len(chunk)
                        if total > 0:
                            pct = downloaded / total * 100
                            mb = downloaded / 1e6
                            total_mb = total / 1e6
                            print(f"\r  {pct:.1f}% ({mb:.1f}/{total_mb:.1f} MB)", end="", flush=True)
            
            print(f"\r  ✅ Complete: {os.path.getsize(dest)/1e6:.1f} MB        ")
            return True
        
        except (urllib.error.URLError, TimeoutError, ConnectionError, OSError) as e:
            attempt += 1
            existing_now = os.path.getsize(dest) if os.path.exists(dest) else 0
            wait = min(attempt * 5, 60)
            print(f"\n  ⚠ Connection dropped at {existing_now/1e6:.1f} MB (attempt {attempt}/{max_retries})")
            print(f"  Waiting {wait}s then resuming...")
            time.sleep(wait)
    
    return False


def pip_install_wheel(path: str) -> bool:
    """Install a local wheel file."""
    r = subprocess.run(
        [sys.executable, "-m", "pip", "install", "--no-deps", path],
        capture_output=False
    )
    return r.returncode == 0


def check_installed(pkg: str) -> bool:
    r = subprocess.run(
        [sys.executable, "-m", "pip", "show", pkg],
        capture_output=True, text=True
    )
    return r.returncode == 0


# ── Main ─────────────────────────────────────────────────────────────────────

print("=" * 60)
print("PurposeCanvas — Resume-capable Wheel Downloader")
print("=" * 60)
print(f"Wheels saved to: {os.path.abspath(WHEELS_DIR)}")
print("Connection drops are handled automatically — just leave it running.\n")

failed = []

for pkg, cp, plat in PACKAGES:
    print(f"\n{'-'*50}")
    print(f"Package: {pkg}")
    
    # Check if already installed
    if check_installed(pkg):
        print(f"  ✅ Already installed — skipping")
        continue
    
    # Get wheel URL
    try:
        fn, url = get_wheel_url(pkg, cp, plat)
        print(f"  Wheel: {fn}")
        print(f"  URL: {url[:80]}...")
    except Exception as e:
        print(f"  ❌ Could not get wheel URL: {e}")
        # Fall back to direct pip install
        print(f"  Trying direct pip install...")
        r = subprocess.run(
            [sys.executable, "-m", "pip", "install", "--timeout", "300", "--retries", "10", pkg],
            capture_output=False
        )
        if r.returncode != 0:
            failed.append(pkg)
        continue
    
    dest = os.path.join(WHEELS_DIR, fn)
    
    # Download with resume
    print(f"  Downloading...")
    ok = download_with_resume(url, dest)
    
    if not ok:
        print(f"  ❌ Download failed after max retries: {pkg}")
        failed.append(pkg)
        continue
    
    # Install wheel (no-deps first, then deps separately)
    print(f"  Installing {fn}...")
    # First install with deps to get them
    r = subprocess.run(
        [sys.executable, "-m", "pip", "install", "--timeout", "120", dest],
        capture_output=False
    )
    if r.returncode != 0:
        print(f"  ❌ Install failed: {pkg}")
        failed.append(pkg)
    else:
        print(f"  ✅ Installed: {pkg}")


print("\n" + "=" * 60)
if failed:
    print(f"❌ Failed packages: {failed}")
    print("Run this script again — it will resume incomplete downloads.")
else:
    print("✅ ALL packages installed!")
    print("\nNext steps:")
    print("  1. python test_gpu_only.py   ← test GPU generation")
    print("  2. python -m uvicorn backend.main:app --reload --port 8000")
    print("  3. cd frontend && npm install && npm run dev")
