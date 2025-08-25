"""Blueprint command group implementation."""
from runloop_api_client.types.shared_params import LaunchParameters
from runloop_api_client.types.shared_params.launch_parameters import UserParameters

from ..utils import runloop_api_client

async def create(args) -> None:
    """Create a new blueprint."""
    dockerfile_contents = args.dockerfile
    if args.dockerfile_path:
        with open(args.dockerfile_path) as f:
            dockerfile_contents = f.read()

    launch_parameters = LaunchParameters(
        resource_size_request=args.resources,
        available_ports=args.available_ports,
        architecture=args.architecture,
        user_parameters=UserParameters(username="root", uid=0) if args.root else None,
    )

    blueprint = await runloop_api_client().blueprints.create(
        name=args.name,
        dockerfile=dockerfile_contents,
        system_setup_commands=args.system_setup_commands,
        launch_parameters=launch_parameters,
    )
    print(f"created blueprint={blueprint.model_dump_json(indent=4)}")

async def preview(args) -> None:
    """Preview a blueprint before creation."""
    blueprint = await runloop_api_client().blueprints.preview(
        name=args.name,
        system_setup_commands=args.system_setup_commands,
        dockerfile=args.dockerfile,
    )
    print(f"preview blueprint={blueprint.model_dump_json(indent=4)}")

async def list_blueprints(args) -> None:
    """List all blueprints."""
    blueprints = await runloop_api_client().blueprints.list(name=args.name)
    [
        print(f"blueprints={blueprint.model_dump_json(indent=4)}")
        for blueprint in blueprints.blueprints or []
    ]

async def get(args) -> None:
    """Get a specific blueprint."""
    assert args.id is not None
    blueprint = await runloop_api_client().blueprints.retrieve(args.id)
    print(f"blueprint={blueprint.model_dump_json(indent=4)}")

async def logs(args) -> None:
    """Get blueprint build logs."""
    assert args.id is not None
    logs = await runloop_api_client().blueprints.logs(args.id)
    [print(f"{log.timestamp_ms} {log.level} {log.message}") for log in logs.logs or []]
