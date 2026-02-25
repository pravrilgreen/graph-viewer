"""
Simple setup guide helper for Transition Map Builder.
"""

import platform
import sys


def main() -> bool:
    print("=" * 60)
    print("Transition Map Builder - Setup Guide")
    print("=" * 60)

    python_version = sys.version_info
    print(f"Python: {python_version.major}.{python_version.minor}.{python_version.micro}")
    if python_version.major < 3 or (python_version.major == 3 and python_version.minor < 11):
        print("Python 3.11+ is required.")
        return False

    print("\nBackend:")
    print("  cd backend")
    print("  python -m venv venv")
    if platform.system() == "Windows":
        print(r"  venv\Scripts\activate")
    else:
        print("  source venv/bin/activate")
    print("  pip install -r requirements.txt")
    print("  uvicorn main:app --reload --port 8000")

    print("\nFrontend:")
    print("  cd frontend")
    print("  npm install")
    print("  npm run dev")

    print("\nAlternative (Windows):")
    print(r"  .\START_ALL.ps1")

    print("\nURLs:")
    print("  Frontend: http://localhost:5173")
    print("  Backend:  http://localhost:8000")
    print("  Docs:     http://localhost:8000/docs")
    print("=" * 60)
    return True


if __name__ == "__main__":
    raise SystemExit(0 if main() else 1)
