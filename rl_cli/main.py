import argparse
import asyncio
import datetime
import functools
import json
import os
import subprocess
import shlex
import sys
import signal

from runloop_api_client import NOT_GIVEN, AsyncRunloop, NotGiven
from runloop_api_client.types import blueprint_create_params, CodeMountParametersParam


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
def runloop_api_client() -> AsyncRunloop:
    if not os.getenv("RUNLOOP_API_KEY"):
        raise ValueError("RUNLOOP_API_KEY must be set in the environment.")

    return AsyncRunloop(bearer_token=os.getenv("RUNLOOP_API_KEY"), base_url=base_url())


def _parse_env_arg(arg):
    key, value = arg.split("=")
    return key, value


def _parse_code_mounts(arg) -> CodeMountParametersParam | None:
    if arg is None:
        return None
    return CodeMountParametersParam(**json.loads(arg))


def _args_to_dict(input_list) -> dict | NotGiven:
    if input_list is None:
        return NOT_GIVEN
    return dict(input_list)


async def create_blueprint(args) -> None:
    dockerfile_contents = args.dockerfile
    if args.dockerfile_path:
        with open(args.dockerfile_path) as f:
            dockerfile_contents = f.read()

    launch_parameters = blueprint_create_params.LaunchParameters(
        resource_size_request=args.resources,
        available_ports=args.available_ports
    )

    blueprint = await runloop_api_client().blueprints.create(
        name=args.name,
        dockerfile=dockerfile_contents,
        system_setup_commands=args.system_setup_commands,
        launch_parameters=launch_parameters,
    )
    print(f"created blueprint={blueprint.model_dump_json(indent=4)}")


async def preview(args) -> None:
    blueprint = await runloop_api_client().blueprints.preview(
        name=args.name,
        system_setup_commands=args.system_setup_commands,
        dockerfile=args.dockerfile,
    )
    print(f"preview blueprint={blueprint.model_dump_json(indent=4)}")


async def create_devbox(args) -> None:
    devbox = await runloop_api_client().devboxes.create(
        entrypoint=args.entrypoint,
        environment_variables=_args_to_dict(args.env_vars),
        setup_commands=args.setup_commands,
        blueprint_id=args.blueprint_id,
        code_mounts=args.code_mounts,
        snapshot_id=args.snapshot_id,
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
    blueprints = await runloop_api_client().blueprints.list(name=args.name)
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


async def execute_async(args) -> None:
    assert args.id is not None
    assert args.command is not None
    devbox = await runloop_api_client().devboxes.execute_async(
        id=args.id, command=args.command
    )
    print(f"execution={devbox.model_dump_json(indent=4)}")


async def get_async_exec(args) -> None:
    assert args.id is not None
    assert args.execution_id is not None
    devbox = await runloop_api_client().devboxes.executions.retrieve(
        execution_id=args.execution_id, id=args.id
    )
    print(f"execution={devbox.model_dump_json(indent=4)}")


async def snapshot_devbox(args) -> None:
    assert args.devbox_id is not None
    snapshot = await runloop_api_client().devboxes.snapshot_disk(args.devbox_id)
    print(f"snapshot={snapshot.model_dump_json(indent=4)}")


async def list_snapshots(args) -> None:
    snapshots_list = await runloop_api_client().devboxes.disk_snapshots()
    print(f"snapshots={snapshots_list.model_dump_json(indent=4)}")


async def suspend_devbox(args) -> None:
    assert args.id is not None
    devbox = await runloop_api_client().devboxes.suspend(args.id)
    print(f"devbox={devbox.model_dump_json(indent=4)}")


async def resume_devbox(args) -> None:
    assert args.id is not None
    devbox = await runloop_api_client().devboxes.resume(args.id)
    print(f"devbox={devbox.model_dump_json(indent=4)}")


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
        id=args.id, command=args.command
    )
    print("exec_result=", result)


async def devbox_exec_async(args) -> None:
    assert args.id is not None
    result = await runloop_api_client().devboxes.execute_sync(
        id=args.id, command=args.exec_command
    )
    print("exec_result=", result)


async def get_devbox_ssh_key(devbox_id: str) -> tuple[str, str, str] | None:
    result = await runloop_api_client().devboxes.create_ssh_key(devbox_id)
    if not result:
        print("Failed to create ssh key")
        return None

    key: str = result.ssh_private_key or ""
    url: str = result.url or ""

    os.makedirs(os.path.expanduser("~/.runloop/ssh_keys"), exist_ok=True)
    keyfile_path = os.path.expanduser(f"~/.runloop/ssh_keys/{devbox_id}.pem")
    with open(keyfile_path, "w", encoding="utf-8") as f:
        f.write(key)
        f.flush()
        os.fsync(f.fileno())
    os.chmod(keyfile_path, 0o600)

    return keyfile_path, key, url


async def devbox_ssh(args) -> None:
    if args.id is None:
        raise ValueError("The 'id' argument is required and was not provided.")

    ssh_info = await get_devbox_ssh_key(args.id)
    if not ssh_info:
        return

    keyfile_path, _, url = ssh_info

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


async def devbox_scp(args) -> None:
    assert args.id is not None
    assert args.src is not None
    assert args.dst is not None

    ssh_info = await get_devbox_ssh_key(args.id)
    if not ssh_info:
        return

    keyfile_path, _, url = ssh_info

    proxy_command = f"openssl s_client -quiet -verify_quiet -servername %h -connect {ssh_url()} 2> /dev/null"

    scp_command = [
        "scp",
        "-i",
        keyfile_path,
        "-o",
        f"ProxyCommand={proxy_command}",
        "-o",
        "StrictHostKeyChecking=no",
    ]

    if args.scp_options:
        scp_command.extend(shlex.split(args.scp_options))

    if args.src.startswith(":"):
        scp_command.append(f"user@{url}:{args.src[1:]}")  # Remove the leading ':'
        scp_command.append(args.dst)
    else:
        scp_command.append(args.src)
        if args.dst.startswith(":"):
            scp_command.append(f"user@{url}:{args.dst[1:]}")  # Remove the leading ':'
        else:
            scp_command.append(args.dst)

    try:
        subprocess.run(scp_command, check=True)
    except subprocess.CalledProcessError as e:
        print(f"SCP command failed with exit code {e.returncode}")
        sys.exit(e.returncode)


async def devbox_rsync(args) -> None:
    assert args.id is not None
    assert args.src is not None
    assert args.dst is not None

    ssh_info = await get_devbox_ssh_key(args.id)
    if not ssh_info:
        return

    keyfile_path, _, url = ssh_info

    proxy_command = f"openssl s_client -quiet -verify_quiet -servername %h -connect {ssh_url()} 2> /dev/null"

    ssh_options = f"-i {keyfile_path} -o ProxyCommand='{proxy_command}' -o StrictHostKeyChecking=no"

    rsync_command = [
        "rsync",
        "-vrz",  # v: verbose, r: recursive, z: compress
        "-e",
        f"ssh {ssh_options}",
    ]

    if args.rsync_options:
        rsync_command.extend(shlex.split(args.rsync_options))

    if args.src.startswith(":"):
        rsync_command.append(f"user@{url}:{args.src[1:]}")  # Remove the leading ':'
        rsync_command.append(args.dst)
    else:
        rsync_command.append(args.src)
        if args.dst.startswith(":"):
            rsync_command.append(f"user@{url}:{args.dst[1:]}")  # Remove the leading ':'
        else:
            rsync_command.append(args.dst)

    try:
        subprocess.run(rsync_command, check=True)
    except subprocess.CalledProcessError as e:
        print(f"Rsync command failed with exit code {e.returncode}")
        sys.exit(e.returncode)


async def devbox_tunnel(args) -> None:
    if args.id is None:
        raise ValueError("The 'id' argument is required and was not provided.")

    if ":" not in args.ports:
        raise ValueError("Ports must be specified as 'local:remote'")

    local_port, remote_port = args.ports.split(":")

    ssh_info = await get_devbox_ssh_key(args.id)
    if not ssh_info:
        return

    keyfile_path, _, url = ssh_info

    proxy_command = f"openssl s_client -quiet -verify_quiet -servername %h -connect {ssh_url()} 2> /dev/null"
    command = [
        "/usr/bin/ssh",
        "-i",
        keyfile_path,
        "-o",
        f"ProxyCommand={proxy_command}",
        "-o",
        "StrictHostKeyChecking=no",
        "-N",  # Do not execute a remote command
        "-L",
        f"{local_port}:localhost:{remote_port}",
        f"user@{url}",
    ]

    print(f"Starting tunnel: local port {local_port} -> remote port {remote_port}")
    print("Press Ctrl+C to stop the tunnel.")

    def signal_handler(sig, frame):
        print("\nStopping tunnel...")
        sys.exit(0)

    signal.signal(signal.SIGINT, signal_handler)

    try:
        subprocess.run(command)
    except subprocess.CalledProcessError as e:
        print(f"Tunnel creation failed with exit code {e.returncode}")
        sys.exit(e.returncode)


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
        "--snapshot_id", type=str, help="Snapshot to use, if any."
    )
    devbox_create_parser.add_argument(
        "--env_vars",
        help="Environment key-value variables. (--env_vars key1=value1 --env_vars key2=value2)",
        type=_parse_env_arg,
        action="append",
    )
    devbox_create_parser.add_argument(
        "--code_mounts",
        help='Code mount dictionary. (--code_mounts {"repo_name": "my_repo", "repo_owner": "my_owner"})',
        type=_parse_code_mounts,
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
        "--command", required=True, help="Command to execute"
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

    devbox_snapshot_parser = devbox_subparsers.add_parser(
        "snapshot", help="Work with devbox snapshots"
    )
    devbox_snapshot_subparsers = devbox_snapshot_parser.add_subparsers(dest="subcommand")
    
    devbox_snapshot_create_parser = devbox_snapshot_subparsers.add_parser("create", help="Create a snapshot of a running devbox")
    devbox_snapshot_create_parser.add_argument("--devbox_id", required=True, help="ID of the devbox to snapshot")
    devbox_snapshot_create_parser.set_defaults(
        func=lambda args: asyncio.create_task(snapshot_devbox(args))
    )

    devbox_snapshot_list_parser = devbox_snapshot_subparsers.add_parser("list", help="List devbox snapshots")
    devbox_snapshot_list_parser.set_defaults(
        func=lambda args: asyncio.create_task(list_snapshots(args))
    )

    devbox_suspend_parser = devbox_subparsers.add_parser(
        "suspend", help="suspend a running devbox"
    )
    devbox_suspend_parser.add_argument("--id", required=True, help="ID of the devbox")
    devbox_suspend_parser.set_defaults(
        func=lambda args: asyncio.create_task(suspend_devbox(args))
    )

    devbox_resume_parser = devbox_subparsers.add_parser(
        "resume", help="resume a suspended devbox"
    )
    devbox_resume_parser.add_argument("--id", required=True, help="ID of the devbox")
    devbox_resume_parser.set_defaults(
        func=lambda args: asyncio.create_task(resume_devbox(args))
    )

    devbox_shutdown_parser = devbox_subparsers.add_parser(
        "shutdown", help="Shutdown a devbox"
    )
    devbox_shutdown_parser.add_argument("--id", required=True, help="ID of the devbox")
    devbox_shutdown_parser.set_defaults(
        func=lambda args: asyncio.create_task(shutdown_devbox(args))
    )

    devbox_async_execution_parser = devbox_subparsers.add_parser(
        "exec_async", help="Initiate an asynchronous Devbox execution."
    )
    devbox_async_execution_parser.add_argument(
        "--id", required=True, help="ID of the devbox"
    )
    devbox_async_execution_parser.add_argument(
        "--command", required=True, help="Command to execute"
    )
    devbox_async_execution_parser.set_defaults(
        func=lambda args: asyncio.create_task(execute_async(args))
    )

    devbox_async_execution_retrieve_parser = devbox_subparsers.add_parser(
        "get_async", help="Get an asynchronous Devbox execution."
    )
    devbox_async_execution_retrieve_parser.add_argument(
        "--id", required=True, help="ID of the devbox"
    )
    devbox_async_execution_retrieve_parser.add_argument("--execution_id", required=True)
    devbox_async_execution_retrieve_parser.set_defaults(
        func=lambda args: asyncio.create_task(get_async_exec(args))
    )

    devbox_scp_parser = devbox_subparsers.add_parser(
        "scp", help="SCP files to/from a devbox"
    )
    devbox_scp_parser.add_argument("src", help="Source file or directory")
    devbox_scp_parser.add_argument("dst", help="Destination file or directory")
    devbox_scp_parser.add_argument("--id", required=True, help="ID of the devbox")
    devbox_scp_parser.add_argument("--scp-options", help="Additional SCP options")
    devbox_scp_parser.set_defaults(
        func=lambda args: asyncio.create_task(devbox_scp(args))
    )

    devbox_rsync_parser = devbox_subparsers.add_parser(
        "rsync", help="Rsync files to/from a devbox"
    )
    devbox_rsync_parser.add_argument("src", help="Source file or directory")
    devbox_rsync_parser.add_argument("dst", help="Destination file or directory")
    devbox_rsync_parser.add_argument("--id", required=True, help="ID of the devbox")
    devbox_rsync_parser.add_argument("--rsync-options", help="Additional rsync options")
    devbox_rsync_parser.set_defaults(
        func=lambda args: asyncio.create_task(devbox_rsync(args))
    )

    # Add the new tunnel subcommand to the devbox subparser
    devbox_tunnel_parser = devbox_subparsers.add_parser(
        "tunnel", help="Create an SSH tunnel to a devbox"
    )
    devbox_tunnel_parser.add_argument("--id", required=True, help="ID of the devbox")
    devbox_tunnel_parser.add_argument(
        "ports", help="Port specification in the format 'local:remote'"
    )
    devbox_tunnel_parser.set_defaults(
        func=lambda args: asyncio.create_task(devbox_tunnel(args))
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
        "--name", help="Blueprint name. ", required=True
    )
    blueprint_create_parser.add_argument(
        "--system_setup_commands",
        help="Blueprint system initialization commands. "
        '(--system_setup_commands "sudo apt install pipx")',
        action="append",
    )
    blueprint_create_parser.add_argument(
        "--dockerfile", help="Text string of fully enumerated dockerfile.", type=str
    )
    blueprint_create_parser.add_argument(
        "--dockerfile_path", help="Path to a dockerfile to use.", type=str
    )
    blueprint_create_parser.add_argument(
        "--resources",
        type=str,
        help="Devbox resource specification.",
        choices=["SMALL", "MEDIUM", "LARGE"],
    )
    blueprint_create_parser.add_argument(
        "--available-ports",
        type=int,
        nargs="+",
        help="List of available ports for the blueprint (e.g., --available-ports 8000 8080 3000)",
    )

    blueprint_preview_parser = blueprint_subparsers.add_parser(
        "preview", help="Create a blueprint"
    )
    blueprint_preview_parser.set_defaults(
        func=lambda args: asyncio.create_task(preview(args))
    )
    blueprint_preview_parser.add_argument(
        "--name", help="Blueprint name. ", required=True
    )
    blueprint_preview_parser.add_argument(
        "--dockerfile", help="Blueprint fully enumerated dockerfile.", type=str
    )

    blueprint_preview_parser.add_argument(
        "--system_setup_commands",
        help="Blueprint system initialization commands. "
        '(--system_setup_commands "sudo apt install pipx")',
        action="append",
    )

    blueprint_list_parser = blueprint_subparsers.add_parser(
        "list", help="List blueprints"
    )
    blueprint_list_parser.add_argument(
        "--name", help="Blueprint name.", type=str, required=False
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
    blueprint_logs_parser = blueprint_subparsers.add_parser(
        "logs", help="Get blueprint build logs"
    )
    blueprint_logs_parser.add_argument(
        "--id", required=True, help="ID of the blueprint"
    )
    blueprint_logs_parser.set_defaults(
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
