"""Utility functions for rl-cli."""
import datetime
import functools
import json
import os
import urllib.request
import urllib.error
from pathlib import Path

from runloop_api_client import AsyncRunloop, NOT_GIVEN, NotGiven
from runloop_api_client._types import Query
from runloop_api_client.types.shared_params import CodeMountParameters

def base_url() -> str:
    """Get the base URL for the Runloop API."""
    env: str | None = os.getenv("RUNLOOP_ENV")
    if env and env.lower() == "dev":
        return "https://api.runloop.pro"
    else:
        return "https://api.runloop.ai"

def ssh_url() -> str:
    """Get the SSH URL for Runloop."""
    if os.getenv("RUNLOOP_ENV") == "dev":
        return "ssh.runloop.pro:443"
    else:
        return "ssh.runloop.ai:443"

def get_cache_dir() -> Path:
    """Get the cache directory for rl-cli."""
    return Path.home() / '.cache' / 'rl-cli'

def should_check_for_updates() -> bool:
    """Check if we should check for updates."""
    cache_file = get_cache_dir() / 'last_update_check'
    if not cache_file.exists():
        return True
    
    try:
        last_check = datetime.datetime.fromtimestamp(cache_file.stat().st_mtime)
        return (datetime.datetime.now() - last_check).days >= 1
    except OSError:
        return True

def get_latest_version() -> str | None:
    """Get the latest version from PyPI."""
    try:
        with urllib.request.urlopen('https://pypi.org/pypi/rl-cli/json', timeout=2) as response:
            data = json.loads(response.read())
            return data['info']['version']
    except (urllib.error.URLError, json.JSONDecodeError, KeyError, TimeoutError):
        return None

def update_check_cache():
    """Update the last check timestamp."""
    cache_dir = get_cache_dir()
    cache_dir.mkdir(parents=True, exist_ok=True)
    cache_file = cache_dir / 'last_update_check'
    cache_file.touch()

@functools.cache
def runloop_api_client() -> AsyncRunloop:
    """Get a cached instance of the Runloop API client."""
    return AsyncRunloop(bearer_token=os.getenv("RUNLOOP_API_KEY"), base_url=base_url())

def _parse_env_arg(arg):
    """Parse environment variable argument."""
    key, value = arg.split("=")
    return key, value

def _args_to_dict(input_list) -> dict | NotGiven:
    """Convert argument list to dictionary."""
    if input_list is None:
        return NOT_GIVEN
    return dict(input_list)

def _parse_code_mounts(arg) -> CodeMountParameters | None:
    """Parse code mounts argument."""
    if arg is None:
        return None
    return CodeMountParameters(**json.loads(arg))
