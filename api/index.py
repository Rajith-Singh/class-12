"""
Vercel serverless function entry point for the FastAPI application.
This file is required by Vercel to properly deploy the FastAPI app.
"""
import sys
from pathlib import Path

# Add the project root to the Python path so imports work correctly
root_dir = Path(__file__).parent.parent
sys.path.insert(0, str(root_dir))

from src.app.api import app

# Vercel expects a variable named 'app' or 'handler'
# FastAPI's app instance can be used directly
handler = app
