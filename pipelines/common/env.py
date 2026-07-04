"""Load myproj/.env on import. Resolved from the repo root, not from CWD."""

import os

from dotenv import load_dotenv

PACKAGE_DIR = os.path.dirname(os.path.abspath(__file__))
MYPROJ_ROOT = os.path.abspath(os.path.join(PACKAGE_DIR, ".."))

load_dotenv(dotenv_path=os.path.join(MYPROJ_ROOT, ".env"))


def get_credentials_path():
    name = os.getenv("CREDENTIALS_FILE", "credentials.json")
    return name if os.path.isabs(name) else os.path.join(MYPROJ_ROOT, name)
