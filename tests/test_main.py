"""Unit tests for the main RL CLI functionality."""

import datetime
import json
import os
from pathlib import Path
import pytest
from unittest.mock import patch, mock_open

from rl_cli.utils import (
    base_url,
    ssh_url,
    get_cache_dir,
    should_check_for_updates,
    get_latest_version,
    update_check_cache,
)
from rl_cli.main import check_for_updates

def test_base_url_dev(mock_env):
    """Test base_url returns dev URL when RUNLOOP_ENV is 'dev'."""
    assert base_url() == "https://api.runloop.pro"

def test_base_url_prod():
    """Test base_url returns prod URL when RUNLOOP_ENV is not set."""
    with patch.dict(os.environ, {'RUNLOOP_ENV': ''}, clear=True):
        assert base_url() == "https://api.runloop.ai"

def test_ssh_url_dev(mock_env):
    """Test ssh_url returns dev URL when RUNLOOP_ENV is 'dev'."""
    assert ssh_url() == "ssh.runloop.pro:443"

def test_ssh_url_prod():
    """Test ssh_url returns prod URL when RUNLOOP_ENV is not set."""
    with patch.dict(os.environ, {'RUNLOOP_ENV': ''}, clear=True):
        assert ssh_url() == "ssh.runloop.ai:443"

def test_get_cache_dir():
    """Test get_cache_dir returns correct path."""
    expected = Path.home() / '.cache' / 'rl-cli'
    assert get_cache_dir() == expected

def test_should_check_for_updates_no_cache(temp_cache_dir):
    """Test should_check_for_updates returns True when no cache exists."""
    assert should_check_for_updates() is True

def test_should_check_for_updates_recent_cache(temp_cache_dir):
    """Test should_check_for_updates returns False for recent cache."""
    cache_file = temp_cache_dir / 'last_update_check'
    cache_file.touch()
    assert should_check_for_updates() is False

def test_should_check_for_updates_old_cache(temp_cache_dir):
    """Test should_check_for_updates returns True for old cache."""
    cache_file = temp_cache_dir / 'last_update_check'
    old_time = datetime.datetime.now() - datetime.timedelta(days=2)
    cache_file.touch()
    os.utime(cache_file, (old_time.timestamp(), old_time.timestamp()))
    assert should_check_for_updates() is True

def test_get_latest_version_success():
    """Test get_latest_version successfully retrieves version."""
    mock_response = {
        'info': {
            'version': '1.0.0'
        }
    }
    with patch('urllib.request.urlopen', mock_open(read_data=json.dumps(mock_response).encode())):
        assert get_latest_version() == '1.0.0'

def test_get_latest_version_failure():
    """Test get_latest_version handles failure gracefully."""
    with patch('urllib.request.urlopen', side_effect=TimeoutError()):
        assert get_latest_version() is None

def test_update_check_cache(temp_cache_dir):
    """Test update_check_cache creates cache file."""
    update_check_cache()
    cache_file = temp_cache_dir / 'last_update_check'
    assert cache_file.exists()

@pytest.mark.parametrize('current_version,latest_version,should_notify', [
    ('1.0.0', '1.0.0', False),
    ('1.0.0', '1.1.0', True),
    ('2.0.0', '1.0.0', True),
])
def test_check_for_updates(current_version, latest_version, should_notify, temp_cache_dir, capsys):
    """Test check_for_updates behavior with different versions."""
    with patch('rl_cli.main.__version__', current_version), \
         patch('rl_cli.main.get_latest_version', return_value=latest_version):
        check_for_updates()
        captured = capsys.readouterr()
        if should_notify:
            assert f"Update available: rl-cli {latest_version}" in captured.err
        else:
            assert captured.err == ""
