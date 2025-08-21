"""
Pytest configuration file to adjust Python path for test imports.

By appending the project root to ``sys.path`` at runtime, tests can
import modules from the top-level directory (such as
``demand_planning_app``) without requiring the package to be
installed.  This setup avoids import errors when running tests
directly with pytest.
"""

import sys
from pathlib import Path

# Append the project root to sys.path so that modules at the
# top level can be imported in test modules.  Without this,
# attempting ``from demand_planning_app import ...`` would raise
# ``ModuleNotFoundError`` because the app file is not part of an
# installed package.
ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))