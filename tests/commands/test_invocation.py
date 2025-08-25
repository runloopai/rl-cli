"""Tests for invocation commands."""

import json
from unittest.mock import AsyncMock, patch
import pytest

from rl_cli.commands import invocation
from rl_cli.utils import runloop_api_client

class MockInvocation:
    def __init__(self, **kwargs):
        self.data = {
            "id": "test-invocation",
            "status": "completed",
            "created_at": "2024-01-01T00:00:00Z",
            **kwargs
        }

    def model_dump_json(self, indent=None):
        return json.dumps(self.data, indent=indent)

@pytest.mark.asyncio
async def test_get_invocation():
    """Test getting an invocation."""
    mock_invocation = MockInvocation()
    mock_api_client = AsyncMock()
    mock_api_client.functions = AsyncMock()
    mock_api_client.functions.invocations = AsyncMock()
    mock_api_client.functions.invocations.retrieve = AsyncMock(return_value=mock_invocation)

    # Clear the cache to ensure we get a fresh client
    runloop_api_client.cache_clear()

    with patch('rl_cli.utils.AsyncRunloop', return_value=mock_api_client), \
         patch('rl_cli.commands.invocation.print') as mock_print:
        args = AsyncMock()
        args.id = "test-invocation"

        await invocation.get(args)

        mock_api_client.functions.invocations.retrieve.assert_called_once_with("test-invocation")
        mock_print.assert_called_once_with(f"invocation={mock_invocation.model_dump_json(indent=4)}")

@pytest.mark.asyncio
async def test_list_functions():
    """Test listing functions."""
    class MockProject:
        def model_dump_json(self, indent=None):
            return json.dumps({
                "id": "test-project",
                "name": "test",
                "status": "active"
            }, indent=indent)

    class MockFunction:
        def model_dump_json(self, indent=None):
            return json.dumps({
                "id": "test-function",
                "name": "test",
                "status": "active"
            }, indent=indent)

    mock_project = MockProject()
    mock_function = MockFunction()

    mock_api_client = AsyncMock()
    mock_api_client.projects = AsyncMock()
    mock_api_client.functions = AsyncMock()

    mock_api_client.projects.list = AsyncMock(return_value={"devboxes": [mock_project]})
    mock_api_client.functions.list = AsyncMock(return_value={"devboxes": [mock_function]})

    # Clear the cache to ensure we get a fresh client
    runloop_api_client.cache_clear()

    with patch('rl_cli.utils.AsyncRunloop', return_value=mock_api_client), \
         patch('rl_cli.commands.invocation.print') as mock_print:
        args = AsyncMock()

        await invocation.list_functions(args)

        mock_api_client.projects.list.assert_called_once()
        mock_api_client.functions.list.assert_called_once()
        assert mock_print.call_count == 2
        mock_print.assert_any_call(f"project={mock_project.model_dump_json(indent=4)}")
        mock_print.assert_any_call(f"project={mock_function.model_dump_json(indent=4)}")

@pytest.mark.asyncio
async def test_list_functions_empty():
    """Test listing functions when none exist."""
    mock_api_client = AsyncMock()
    mock_api_client.projects = AsyncMock()
    mock_api_client.functions = AsyncMock()

    mock_api_client.projects.list = AsyncMock(return_value={"devboxes": []})
    mock_api_client.functions.list = AsyncMock(return_value={"devboxes": []})

    # Clear the cache to ensure we get a fresh client
    runloop_api_client.cache_clear()

    with patch('rl_cli.utils.AsyncRunloop', return_value=mock_api_client), \
         patch('rl_cli.commands.invocation.print') as mock_print:
        args = AsyncMock()

        await invocation.list_functions(args)

        mock_api_client.projects.list.assert_called_once()
        mock_api_client.functions.list.assert_called_once()
        mock_print.assert_not_called()
