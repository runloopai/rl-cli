"""Integration tests for CLI commands."""

import json
from unittest.mock import AsyncMock, patch
import pytest
from rl_cli.main import run
from rl_cli.utils import runloop_api_client

@pytest.mark.asyncio
async def test_devbox_list(capsys):
    """Test the devbox list command."""
    class MockDevbox:
        def model_dump_json(self, indent=None):
            return json.dumps({
                "id": "test-id",
                "status": "running",
                "created_at": "2024-01-01T00:00:00Z"
            }, indent=indent)
    
    mock_devbox = MockDevbox()
    
    # Create mock API client
    mock_api_client = AsyncMock()
    mock_api_client._platform = 'test-platform'
    mock_api_client.bearer_token = 'test-api-key'
    
    # Create mock devboxes
    mock_devboxes = AsyncMock()
    
    # Create mock paginator
    async def mock_aiter(self):
        yield mock_devbox
    
    mock_paginator = AsyncMock()
    mock_paginator.__aiter__ = mock_aiter
    mock_devboxes.list = AsyncMock(return_value=mock_paginator)
    mock_api_client.devboxes = mock_devboxes
    
    # Clear the cache to ensure we get a fresh client
    runloop_api_client.cache_clear()
    
    with patch('rl_cli.utils.AsyncRunloop', return_value=mock_api_client), \
         patch('sys.argv', ['rl', 'devbox', 'list']), \
         patch.dict('os.environ', {'RUNLOOP_API_KEY': 'test-api-key', 'RUNLOOP_ENV': 'dev'}):
        await run()
        
    captured = capsys.readouterr()
    assert "devbox=" in captured.out
    expected = {
        "id": "test-id",
        "status": "running",
        "created_at": "2024-01-01T00:00:00Z"
    }
    assert json.loads(captured.out.split("devbox=")[-1].strip()) == expected

@pytest.mark.asyncio
async def test_blueprint_list(capsys):
    """Test the blueprint list command."""
    class MockBlueprint:
        def model_dump_json(self, indent=None):
            return json.dumps({
                "id": "test-blueprint",
                "name": "test",
                "status": "active"
            }, indent=indent)
    
    mock_blueprint = MockBlueprint()
    
    # Create mock API client
    mock_api_client = AsyncMock()
    mock_api_client._platform = 'test-platform'
    mock_api_client.bearer_token = 'test-api-key'
    
    # Create mock blueprints
    mock_blueprints = AsyncMock()
    mock_blueprints.list = AsyncMock()
    
    # Create mock response
    class MockResponse:
        blueprints = [mock_blueprint]
    
    mock_blueprints.list.return_value = MockResponse()
    mock_api_client.blueprints = mock_blueprints

    # Clear the cache to ensure we get a fresh client
    runloop_api_client.cache_clear()
    
    with patch('rl_cli.utils.AsyncRunloop', return_value=mock_api_client), \
         patch('sys.argv', ['rl', 'blueprint', 'list']), \
         patch.dict('os.environ', {'RUNLOOP_API_KEY': 'test-api-key', 'RUNLOOP_ENV': 'dev'}):
        await run()
        
    captured = capsys.readouterr()
    assert "blueprints=" in captured.out
    expected = {
        "id": "test-blueprint",
        "name": "test",
        "status": "active"
    }
    assert json.loads(captured.out.split("blueprints=")[-1].strip()) == expected

@pytest.mark.asyncio
async def test_devbox_get(capsys):
    """Test the devbox get command."""
    class MockDevbox:
        def model_dump_json(self, indent=None):
            return json.dumps({
                "id": "test-id",
                "status": "running",
                "created_at": "2024-01-01T00:00:00Z"
            }, indent=indent)
    
    mock_devbox = MockDevbox()
    
    # Create mock API client
    mock_api_client = AsyncMock()
    mock_api_client._platform = 'test-platform'
    mock_api_client.bearer_token = 'test-api-key'
    
    # Create mock devboxes
    mock_devboxes = AsyncMock()
    mock_devboxes.retrieve = AsyncMock(return_value=mock_devbox)
    mock_api_client.devboxes = mock_devboxes

    # Clear the cache to ensure we get a fresh client
    runloop_api_client.cache_clear()
    
    with patch('rl_cli.utils.AsyncRunloop', return_value=mock_api_client), \
         patch('sys.argv', ['rl', 'devbox', 'get', '--id', 'test-id']), \
         patch.dict('os.environ', {'RUNLOOP_API_KEY': 'test-api-key', 'RUNLOOP_ENV': 'dev'}):
        await run()
        
    captured = capsys.readouterr()
    assert "devbox=" in captured.out
    expected = {
        "id": "test-id",
        "status": "running",
        "created_at": "2024-01-01T00:00:00Z"
    }
    assert json.loads(captured.out.split("devbox=")[-1].strip()) == expected

@pytest.mark.asyncio
async def test_devbox_create(capsys):
    """Test the devbox create command."""
    class MockDevbox:
        def model_dump_json(self, indent=None):
            return json.dumps({
                "id": "test-id",
                "status": "initializing",
                "created_at": "2024-01-01T00:00:00Z"
            }, indent=indent)
    
    mock_devbox = MockDevbox()
    
    # Create mock API client
    mock_api_client = AsyncMock()
    mock_api_client._platform = 'test-platform'
    mock_api_client.bearer_token = 'test-api-key'
    
    # Create mock devboxes
    mock_devboxes = AsyncMock()
    mock_devboxes.create = AsyncMock(return_value=mock_devbox)
    mock_api_client.devboxes = mock_devboxes

    # Clear the cache to ensure we get a fresh client
    runloop_api_client.cache_clear()
    
    with patch('rl_cli.utils.AsyncRunloop', return_value=mock_api_client), \
         patch('sys.argv', [
            'rl', 'devbox', 'create',
            '--resources', 'SMALL',
            '--architecture', 'arm64'
         ]), \
         patch.dict('os.environ', {'RUNLOOP_API_KEY': 'test-api-key', 'RUNLOOP_ENV': 'dev'}):
        await run()
        
    captured = capsys.readouterr()
    assert "devbox=" in captured.out
    expected = {
        "id": "test-id",
        "status": "initializing",
        "created_at": "2024-01-01T00:00:00Z"
    }
    assert json.loads(captured.out.split("devbox=")[-1].strip()) == expected

@pytest.mark.asyncio
async def test_missing_api_key():
    """Test error handling when API key is missing."""
    # Clear the cache to ensure we get a fresh client
    runloop_api_client.cache_clear()
    
    with patch.dict('os.environ', {}, clear=True), \
         patch('sys.argv', ['rl', 'devbox', 'list']), \
         pytest.raises(RuntimeError) as exc_info:
        await run()
    assert "API key not found" in str(exc_info.value)