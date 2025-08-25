import json
import os

import requests

# Define the API endpoint
base_url = "https://api.runloop.pro"

def get_api_key() -> str:
    """Get the API key from environment variables."""
    return os.getenv("RUNLOOP_API_KEY")


def api_get(path: str) -> dict:
    # Set up the headers with the Bearer token
    headers = {"Authorization": f"Bearer {get_api_key()}"}

    resolved_url = base_url + path

    print(f"invoking GET request to {resolved_url}")

    # Perform the GET request
    response = requests.get(resolved_url, headers=headers)

    # Check if the request was successful
    if response.status_code == 200:
        # Load the JSON data from the response
        data = response.json()

        print(f"response=\n{json.dumps(data, indent=4)}")

        return data
    else:
        print(f"GET failed status={response.status_code} message={response.content}")
        raise ValueError(f"Failed to retrieve data: {response.status_code}")


def api_post(path: str, body: dict) -> dict:
    # Set up the headers with the Bearer token
    headers = {"Authorization": f"Bearer {get_api_key()}"}

    resolved_url = base_url + path

    print(f"invoking POST request to {resolved_url}")

    # Perform the POST request
    response = requests.post(resolved_url, headers=headers, json=body)

    if response.status_code == 200:
        # Load the JSON data from the response
        body = response.json()

        print(f"response=\n{json.dumps(body, indent=4)}")

        return body
    else:
        print(f"POST failed status={response.status_code} message={response.content}")
        raise ValueError(f"Failed to retrieve data: {response.status_code}")
