import argparse
import asyncio
import datetime
import functools
import os
import subprocess

from runloop_api_client import NOT_GIVEN, AsyncRunloop, NotGiven
from runloop_api_client.types import blueprint_create_params

from rl_cli.runloop_client import RunloopClient


def base_url() -> str:
    env: str | None = os.getenv("RUNLOOP_ENV")
    if env and env.lower() == "dev":
        print("Using dev environment")
        return "https://api.runloop.pro"
    else:
        print("Using prod environment")
        return "https://api.runloop.ai"


def ssh_url() -> str:
    if os.getenv("RUNLOOP_ENV") == "dev":
        return "ssh.runloop.pro:443"
    else:
        return "ssh.runloop.ai:443"


@functools.cache
def runloop_client():
    api_key: str | None = os.getenv("RUNLOOP_API_KEY")
    if not api_key:
        raise ValueError("RUNLOOP_API_KEY must be set in the environment.")

    return RunloopClient(api_key=api_key, base_url=base_url())


@functools.cache
def runloop_api_client() -> AsyncRunloop:
    if not os.getenv("RUNLOOP_API_KEY"):
        raise ValueError("RUNLOOP_API_KEY must be set in the environment.")

    return AsyncRunloop(bearer_token=os.getenv("RUNLOOP_API_KEY"), base_url=base_url())


def _parse_env_arg(arg):
    key, value = arg.split("=")
    return key, value


def _args_to_dict(input_list) -> dict | NotGiven:
    if input_list is None:
        return NOT_GIVEN
    return dict(input_list)


async def create_blueprint(args) -> None:
    launch_parameters = blueprint_create_params.LaunchParameters(
        resource_size_request=args.resources
    )

    blueprint = await runloop_api_client().blueprints.create(
        name=args.name,
        system_setup_commands=args.system_setup_commands,
        launch_parameters=launch_parameters,
    )
    print(f"created blueprint={blueprint.model_dump_json(indent=4)}")


async def create_devbox(args) -> None:
    devbox = await runloop_api_client().devboxes.create(
        entrypoint=args.entrypoint,
        environment_variables=_args_to_dict(args.env_vars),
        setup_commands=args.setup_commands,
        blueprint_id=args.blueprint_id,
    )
    print(f"create devbox={devbox.model_dump_json(indent=4)}")


async def list_devboxes(args) -> None:
    devboxes = await runloop_api_client().devboxes.list()
    [
        print(f"devbox={devbox.model_dump_json(indent=4)}")
        for devbox in devboxes.devboxes or []
        if args.status is None or devbox.status == args.status
    ]


async def list_functions(args) -> None:
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


async def list_blueprints(args) -> None:
    blueprints = await runloop_api_client().blueprints.list()
    [
        print(f"blueprints={blueprint.model_dump_json(indent=4)}")
        for blueprint in blueprints.blueprints or []
    ]


async def get_devbox(args) -> None:
    assert args.id is not None
    devbox = await runloop_api_client().devboxes.retrieve(args.id)
    print(f"devbox={devbox.model_dump_json(indent=4)}")


async def get_invocation(args) -> None:
    assert args.id is not None
    invocation = await runloop_api_client().functions.invocations.retrieve(args.id)
    print(f"invocation={invocation.model_dump_json(indent=4)}")


async def get_blueprint(args) -> None:
    assert args.id is not None
    blueprint = await runloop_api_client().blueprints.retrieve(args.id)
    print(f"blueprint={blueprint.model_dump_json(indent=4)}")


async def shutdown_devbox(args) -> None:
    assert args.id is not None
    devbox = await runloop_api_client().devboxes.shutdown(args.id)
    print(f"devbox={devbox.model_dump_json(indent=4)}")


async def devbox_logs(args) -> None:
    assert args.id is not None
    logs = await runloop_api_client().devboxes.logs.list(args.id)
    for log in logs.logs or []:
        time_str = (
            datetime.datetime.fromtimestamp(log.timestamp_ms / 1000.0).strftime(
                "%Y-%m-%d %H:%M:%S.%f"
            )[:-3]
            if log.timestamp_ms
            else ""
        )
        source: str = f" [{log.source}]" if log.source else ""
        if log.cmd is not None:
            print(f"{time_str}{source} -> {log.cmd}")
        elif log.message is not None:
            print(f"{time_str}{source}  {log.message}")
        elif log.exit_code is not None:
            print(f"{time_str}{source} -> exit_code={log.exit_code}")
        else:
            print(f"{time_str}{source}  {log}")


async def blueprint_logs(args) -> None:
    assert args.id is not None
    logs = await runloop_api_client().blueprints.logs(args.id)
    [print(f"{log.timestamp_ms} {log.level} {log.message}") for log in logs.logs or []]


async def devbox_exec(args) -> None:
    assert args.id is not None
    result = await runloop_api_client().devboxes.execute_sync(
        id=args.id, command=args.exec_command
    )
    print("exec_result=", result)


async def devbox_exec_async(args) -> None:
    assert args.id is not None
    result = await runloop_api_client().devboxes.execute_sync(
        id=args.id, command=args.exec_command
    )
    print("exec_result=", result)


async def devbox_ssh(args) -> None:
    assert args.id is not None
    # Get the private key + url
    # TODO: Move ssh to the client
    result = await runloop_client().devbox_create_ssh_key(args.id)
    await runloop_api_client().devboxes.create()
    key: str = result["ssh_private_key"]
    url: str = result["url"]
    # Write the key to ~/.runloop/ssh_keys/<id>.pem
    os.makedirs(os.path.expanduser("~/.runloop/ssh_keys"), exist_ok=True)
    keyfile_path = os.path.expanduser(f"~/.runloop/ssh_keys/{args.id}.pem")
    with open(keyfile_path, "w") as f:
        f.write(key)
    os.chmod(keyfile_path, 0o600)

    if args.config_only:
        print(
            f"""
Host {args.id}
  Hostname {url}
  User user
  IdentityFile {keyfile_path}
  StrictHostKeyChecking no
  ProxyCommand openssl s_client -quiet -verify_quiet -servername %h -connect {ssh_url()} 2>/dev/null
            """
        )
        return
    proxy_command = f"openssl s_client -quiet -verify_quiet -servername %h -connect {ssh_url()} 2> /dev/null"
    command = [
        "/usr/bin/ssh",
        "-i",
        keyfile_path,
        "-o",
        f"ProxyCommand={proxy_command}",
        "-o",
        "StrictHostKeyChecking=no",
        f"user@{url}",
    ]
    subprocess.run(command)


async def run():
    if os.getenv("RUNLOOP_API_KEY") is None:
        raise ValueError("Runloop API key not found in environment variables.")

    parser = argparse.ArgumentParser(description="Perform various devbox operations.")

    subparsers = parser.add_subparsers(dest="command", required=True)

    # devbox subcommands
    devbox_parser = subparsers.add_parser("devbox", help="Manage devboxes")
    devbox_subparsers = devbox_parser.add_subparsers(dest="subcommand")

    devbox_create_parser = devbox_subparsers.add_parser(
        "create", help="Create a devbox"
    )
    devbox_create_parser.set_defaults(
        func=lambda args: asyncio.create_task(create_devbox(args))
    )
    devbox_create_parser.add_argument(
        "--setup_commands",
        help="Devbox initialization commands. "
        '(--setup_commands "echo hello > tmp.txt" --setup_commands "cat tmp.txt")',
        action="append",
    )
    devbox_create_parser.add_argument(
        "--entrypoint", type=str, help="Devbox entrypoint."
    )
    devbox_create_parser.add_argument(
        "--blueprint_id", type=str, help="Blueprint to use, if any."
    )
    devbox_create_parser.add_argument(
        "--env_vars",
        help="Environment key-value variables. (--env_vars key1=value1 --env_vars key2=value2)",
        type=_parse_env_arg,
        action="append",
    )

    devbox_list_parser = devbox_subparsers.add_parser("list", help="List devboxes")
    devbox_list_parser.set_defaults(
        func=lambda args: asyncio.create_task(list_devboxes(args))
    )
    devbox_list_parser.add_argument(
        "--status",
        type=str,
        help="Devbox status.",
        choices=["running", "stopped", "shutdown"],
    )

    devbox_get_parser = devbox_subparsers.add_parser("get", help="Get devbox")
    devbox_get_parser.set_defaults(
        func=lambda args: asyncio.create_task(get_devbox(args))
    )
    devbox_get_parser.add_argument("--id", required=True, help="ID of the devbox")

    devbox_exec_parser = devbox_subparsers.add_parser(
        "exec", help="Execute a command on a devbox"
    )
    devbox_exec_parser.add_argument("--id", required=True, help="ID of the devbox")
    devbox_exec_parser.add_argument(
        "--exec_command", required=True, help="Command to execute"
    )
    devbox_exec_parser.set_defaults(
        func=lambda args: asyncio.create_task(devbox_exec(args))
    )

    devbox_ssh_parser = devbox_subparsers.add_parser("ssh", help="SSH into a devbox")
    devbox_ssh_parser.add_argument("--id", required=True, help="ID of the devbox")
    devbox_ssh_parser.add_argument(
        "--config-only",
        action="store_true",
        default=False,
        help="Only print ~/.ssh/config lines",
    )
    devbox_ssh_parser.set_defaults(
        func=lambda args: asyncio.create_task(devbox_ssh(args))
    )

    devbox_log_parser = devbox_subparsers.add_parser("logs", help="Get devbox logs")
    devbox_log_parser.add_argument("--id", required=True, help="ID of the devbox")
    devbox_log_parser.set_defaults(
        func=lambda args: asyncio.create_task(devbox_logs(args))
    )

    devbox_shutdown_parser = devbox_subparsers.add_parser(
        "shutdown", help="Shutdown a devbox"
    )
    devbox_shutdown_parser.add_argument("--id", required=True, help="ID of the devbox")
    devbox_shutdown_parser.set_defaults(
        func=lambda args: asyncio.create_task(shutdown_devbox(args))
    )

    # invocation subcommands
    invocation_parser = subparsers.add_parser("invocation", help="Manage invocations")
    invocation_subparsers = invocation_parser.add_subparsers(dest="subcommand")

    invocation_get_parser = invocation_subparsers.add_parser(
        "get", help="Get an invocation"
    )
    invocation_get_parser.add_argument(
        "--id", required=True, help="ID of the invocation"
    )
    invocation_get_parser.set_defaults(
        func=lambda args: asyncio.create_task(get_invocation(args))
    )

    # blueprint subcommands
    blueprint_parser = subparsers.add_parser("blueprint", help="Manage blueprints")
    blueprint_subparsers = blueprint_parser.add_subparsers(dest="subcommand")

    blueprint_create_parser = blueprint_subparsers.add_parser(
        "create", help="Create a blueprint"
    )
    blueprint_create_parser.set_defaults(
        func=lambda args: asyncio.create_task(create_blueprint(args))
    )
    blueprint_create_parser.add_argument(
        "--name",
        help="Blueprint name. ",
        required=True
    )
    blueprint_create_parser.add_argument(
        "--system_setup_commands",
        help="Blueprint system initialization commands. "
        '(--system_setup_commands "sudo apt install pipx")',
        action="append",
    )
    blueprint_create_parser.add_argument(
        "--resources", type=str, help="Devbox resource specification.",
        choices=["SMALL", "MEDIUM", "   LARGE"]
    )

    blueprint_list_parser = blueprint_subparsers.add_parser(
        "list", help="List blueprints"
    )
    blueprint_list_parser.set_defaults(
        func=lambda args: asyncio.create_task(list_blueprints(args))
    )

    blueprint_get_parser = blueprint_subparsers.add_parser(
        "get", help="Get a blueprint"
    )
    blueprint_get_parser.add_argument("--id", required=True, help="ID of the blueprint")
    blueprint_get_parser.set_defaults(
        func=lambda args: asyncio.create_task(get_blueprint(args))
    )

    blueprint_get_parser = blueprint_subparsers.add_parser(
        "logs", help="Get blueprint build logs"
    )
    blueprint_get_parser.add_argument("--id", required=True, help="ID of the blueprint")
    blueprint_get_parser.set_defaults(
        func=lambda args: asyncio.create_task(blueprint_logs(args))
    )

    parser.add_argument("--repo", type=str, help="Repo name.")
    parser.add_argument("--owner", type=str, help="Repo owner.")

    args = parser.parse_args()
    if hasattr(args, "func"):
        await args.func(args)
    else:
        parser.print_help()


def main():
    asyncio.run(run())


if __name__ == "__main__":
    main()
