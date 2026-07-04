"""Shared helpers for myproj Python scripts.

Importing anything from this package loads myproj/.env into os.environ.
"""

from . import env  # noqa: F401  side-effect: load .env on import
