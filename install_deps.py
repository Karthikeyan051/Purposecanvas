"""
install_deps.py — Run this once to install all backend dependencies.
Retries each package up to 5 times on network failure.
Usage: python install_deps.py
"""
import subprocess
import sys
import time

PACKAGES = [
    "diffusers",
    "accelerate",
    "google-genai",
    "chromadb",
    "sentence-transformers",
    "pypdf",
    "python-docx",
]

def install(pkg, attempt=1, max_attempts=5):
    print(f"\n{'='*50}")
    print(f"Installing: {pkg} (attempt {attempt}/{max_attempts})")
    print(f"{'='*50}")
    result = subprocess.run(
        [sys.executable, "-m", "pip", "install", "--timeout", "300", "--retries", "10", pkg],
        capture_output=False
    )
    if result.returncode == 0:
        print(f"✅ {pkg} installed successfully")
        return True
    else:
        if attempt < max_attempts:
            wait = attempt * 10
            print(f"❌ Failed. Waiting {wait}s before retry...")
            time.sleep(wait)
            return install(pkg, attempt + 1, max_attempts)
        else:
            print(f"❌ FAILED after {max_attempts} attempts: {pkg}")
            return False

failed = []
for pkg in PACKAGES:
    ok = install(pkg)
    if not ok:
        failed.append(pkg)

print("\n" + "="*50)
if failed:
    print(f"❌ FAILED packages: {failed}")
    print("Run this script again — it will skip already-installed ones.")
else:
    print("✅ ALL packages installed! Run: python -m backend.test_m1")
