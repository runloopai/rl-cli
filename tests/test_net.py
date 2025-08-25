"""Unit tests for the net module."""

import json
from unittest.mock import patch, Mock
import pytest
import requests

from rl_cli.net import api_get, api_post

@pytest.fixture
def mock_response():
    """Fixture to create a mock response object."""
    response = Mock()
    response.status_code = 200
    response.json.return_value = {"data": "test"}
    return response

def test_api_get_success(mock_response):
    """Test successful GET request."""
    with patch('os.getenv', return_value='dummy-key-for-testing'), \
         patch('requests.get', return_value=mock_response) as mock_get:
        result = api_get('/test')
        
        mock_get.assert_called_once_with(
            'https://api.runloop.pro/test',
            headers={'Authorization': 'Bearer dummy-key-for-testing'}
        )
        assert result == {"data": "test"}

def test_api_get_failure():
    """Test failed GET request."""
    mock_failed_response = Mock()
    mock_failed_response.status_code = 404
    mock_failed_response.content = b'Not Found'

    with patch('os.getenv', return_value='dummy-key-for-testing'), \
         patch('requests.get', return_value=mock_failed_response):
        with pytest.raises(ValueError) as exc_info:
            api_get('/test')
        assert "Failed to retrieve data: 404" in str(exc_info.value)

def test_api_post_success(mock_response):
    """Test successful POST request."""
    test_body = {"key": "value"}
    
    with patch('os.getenv', return_value='dummy-key-for-testing'), \
         patch('requests.post', return_value=mock_response) as mock_post:
        result = api_post('/test', test_body)
        
        mock_post.assert_called_once_with(
            'https://api.runloop.pro/test',
            headers={'Authorization': 'Bearer dummy-key-for-testing'},
            json=test_body
        )
        assert result == {"data": "test"}

def test_api_post_failure():
    """Test failed POST request."""
    mock_failed_response = Mock()
    mock_failed_response.status_code = 400
    mock_failed_response.content = b'Bad Request'

    with patch('os.getenv', return_value='dummy-key-for-testing'), \
         patch('requests.post', return_value=mock_failed_response):
        with pytest.raises(ValueError) as exc_info:
            api_post('/test', {"key": "value"})
        assert "Failed to retrieve data: 400" in str(exc_info.value)
