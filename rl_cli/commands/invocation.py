"""Invocation command group implementation."""
from ..utils import runloop_api_client

async def get(args) -> None:
    """Get a specific invocation."""
    assert args.id is not None
    invocation = await runloop_api_client().functions.invocations.retrieve(args.id)
    print(f"invocation={invocation.model_dump_json(indent=4)}")

async def list_functions(args) -> None:
    """List all functions."""
    projects = await runloop_api_client().projects.list()
    [
        print(f"project={project.model_dump_json(indent=4)}")
        for project in projects["devboxes"]
    ]
    functions = await runloop_api_client().functions.list()
    [
        print(f"project={function.model_dump_json(indent=4)}")
        for function in functions["devboxes"]
    ]
