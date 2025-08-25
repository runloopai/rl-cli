"""Tests for devbox commands."""

import json
from unittest.mock import AsyncMock, patch
import pytest
from runloop_api_client import NOT_GIVEN

from rl_cli.commands import devbox
from rl_cli.utils import runloop_api_client

class MockDevbox:
    def __init__(self, **kwargs):
        self.data = {
            "id": "test-id",
            "status": "running",
            "created_at": "2024-01-01T00:00:00Z",
            **kwargs
        }
        self.launch_parameters = AsyncMock()
        self.launch_parameters.user_parameters = AsyncMock()
        self.launch_parameters.user_parameters.username = "test-user"

    def model_dump_json(self, indent=None):
        return json.dumps(self.data, indent=indent)

@pytest.mark.asyncio
async def test_create_devbox():
    """Test creating a devbox."""
    mock_devbox = MockDevbox(status="initializing")
    mock_api_client = AsyncMock()
    mock_api_client.devboxes = AsyncMock()
    mock_api_client.devboxes.create = AsyncMock(return_value=mock_devbox)

    # Clear the cache to ensure we get a fresh client
    runloop_api_client.cache_clear()

    with patch('rl_cli.utils.AsyncRunloop', return_value=mock_api_client), \
         patch('rl_cli.commands.devbox.print') as mock_print:
        args = AsyncMock()
        args.idle_time = None
        args.idle_action = None
        args.architecture = "arm64"
        args.blueprint_id = None
        args.blueprint_name = None
        args.root = True
        args.entrypoint = "echo hello"
        args.env_vars = None
        args.code_mounts = None
        args.snapshot_id = None
        args.resources = "SMALL"
        args.launch_commands = None

        await devbox.create(args)

        mock_api_client.devboxes.create.assert_called_once()
        mock_print.assert_called_once_with(f"create devbox={mock_devbox.model_dump_json(indent=4)}")

@pytest.mark.asyncio
async def test_list_devboxes():
    """Test listing devboxes."""
    mock_devbox = MockDevbox()
    mock_api_client = AsyncMock()
    mock_api_client.devboxes = AsyncMock()

    # Create mock paginator
    async def mock_aiter(self):
        yield mock_devbox

    mock_paginator = AsyncMock()
    mock_paginator.__aiter__ = mock_aiter
    mock_api_client.devboxes.list = AsyncMock(return_value=mock_paginator)

    # Clear the cache to ensure we get a fresh client
    runloop_api_client.cache_clear()

    with patch('rl_cli.utils.AsyncRunloop', return_value=mock_api_client), \
         patch('rl_cli.commands.devbox.print') as mock_print:
        args = AsyncMock()
        args.status = None
        args.limit = None

        await devbox.list_devboxes(args)

        mock_api_client.devboxes.list.assert_called_once_with(
            extra_query=None,
            limit=None
        )
        mock_print.assert_called_once_with(f"devbox={mock_devbox.model_dump_json(indent=4)}")

@pytest.mark.asyncio
async def test_get_devbox():
    """Test getting a devbox."""
    mock_devbox = MockDevbox()
    mock_api_client = AsyncMock()
    mock_api_client.devboxes = AsyncMock()
    mock_api_client.devboxes.retrieve = AsyncMock(return_value=mock_devbox)

    # Clear the cache to ensure we get a fresh client
    runloop_api_client.cache_clear()

    with patch('rl_cli.utils.AsyncRunloop', return_value=mock_api_client), \
         patch('rl_cli.commands.devbox.print') as mock_print:
        args = AsyncMock()
        args.id = "test-id"

        await devbox.get(args)

        mock_api_client.devboxes.retrieve.assert_called_once_with("test-id")
        mock_print.assert_called_once_with(f"devbox={mock_devbox.model_dump_json(indent=4)}")

@pytest.mark.asyncio
async def test_execute_command():
    """Test executing a command on a devbox."""
    mock_result = {"output": "test output"}
    mock_api_client = AsyncMock()
    mock_api_client.devboxes = AsyncMock()
    mock_api_client.devboxes.execute_sync = AsyncMock(return_value=mock_result)

    # Clear the cache to ensure we get a fresh client
    runloop_api_client.cache_clear()

    with patch('rl_cli.utils.AsyncRunloop', return_value=mock_api_client), \
         patch('rl_cli.commands.devbox.print') as mock_print:
        args = AsyncMock()
        args.id = "test-id"
        args.command = "echo hello"
        args.shell_name = None

        await devbox.execute(args)

        mock_api_client.devboxes.execute_sync.assert_called_once_with(
            id="test-id",
            command="echo hello",
            shell_name=NOT_GIVEN
        )
        mock_print.assert_called_once_with("exec_result=", mock_result)

@pytest.mark.asyncio
async def test_suspend_devbox():
    """Test suspending a devbox."""
    mock_devbox = MockDevbox(status="suspended")
    mock_api_client = AsyncMock()
    mock_api_client.devboxes = AsyncMock()
    mock_api_client.devboxes.suspend = AsyncMock(return_value=mock_devbox)

    # Clear the cache to ensure we get a fresh client
    runloop_api_client.cache_clear()

    with patch('rl_cli.utils.AsyncRunloop', return_value=mock_api_client), \
         patch('rl_cli.commands.devbox.print') as mock_print:
        args = AsyncMock()
        args.id = "test-id"

        await devbox.suspend(args)

        mock_api_client.devboxes.suspend.assert_called_once_with("test-id")
        mock_print.assert_called_once_with(f"devbox={mock_devbox.model_dump_json(indent=4)}")

@pytest.mark.asyncio
async def test_resume_devbox():
    """Test resuming a devbox."""
    mock_devbox = MockDevbox(status="running")
    mock_api_client = AsyncMock()
    mock_api_client.devboxes = AsyncMock()
    mock_api_client.devboxes.resume = AsyncMock(return_value=mock_devbox)

    # Clear the cache to ensure we get a fresh client
    runloop_api_client.cache_clear()

    with patch('rl_cli.utils.AsyncRunloop', return_value=mock_api_client), \
         patch('rl_cli.commands.devbox.print') as mock_print:
        args = AsyncMock()
        args.id = "test-id"

        await devbox.resume(args)

        mock_api_client.devboxes.resume.assert_called_once_with("test-id")
        mock_print.assert_called_once_with(f"devbox={mock_devbox.model_dump_json(indent=4)}")

@pytest.mark.asyncio
async def test_shutdown_devbox():
    """Test shutting down a devbox."""
    mock_devbox = MockDevbox(status="shutdown")
    mock_api_client = AsyncMock()
    mock_api_client.devboxes = AsyncMock()
    mock_api_client.devboxes.shutdown = AsyncMock(return_value=mock_devbox)

    # Clear the cache to ensure we get a fresh client
    runloop_api_client.cache_clear()

    with patch('rl_cli.utils.AsyncRunloop', return_value=mock_api_client), \
         patch('rl_cli.commands.devbox.print') as mock_print:
        args = AsyncMock()
        args.id = "test-id"

        await devbox.shutdown(args)

        mock_api_client.devboxes.shutdown.assert_called_once_with("test-id")
        mock_print.assert_called_once_with(f"devbox={mock_devbox.model_dump_json(indent=4)}")