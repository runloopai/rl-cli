"""Devbox command group implementation."""
import asyncio
import datetime
import os
import shlex
import signal
import subprocess
import sys
from pathlib import Path

from runloop_api_client import NOT_GIVEN
from runloop_api_client.types.shared_params import (
    AfterIdle,
    LaunchParameters,
    CodeMountParameters,
)
from runloop_api_client.types.shared_params.launch_parameters import UserParameters

from ..utils import runloop_api_client, ssh_url, _args_to_dict

def _parse_code_mounts(arg) -> CodeMountParameters | None:
    """Parse code mounts argument."""
    if arg is None:
        return None
    return CodeMountParameters(**json.loads(arg))

async def create(args) -> None:
    """Create a new devbox."""
    if (args.idle_time is not None) != (args.idle_action is not None):
        raise ValueError("If either idle_time or idle_action is set, both must be set")
    
    idle_config: AfterIdle | None = None
    if args.idle_time is not None and args.idle_action is not None:
        idle_config = AfterIdle(
            idle_time_seconds=args.idle_time, on_idle=args.idle_action
        )

    if args.architecture is not None and (
        args.blueprint_id is not None or args.blueprint_name is not None
    ):
        raise ValueError(
            "Architecture cannot be specified when using a blueprint (blueprint_id or blueprint_name)"
        )

    user_parameters = UserParameters(username="root", uid=0) if args.root else None

    devbox = await runloop_api_client().devboxes.create(
        entrypoint=args.entrypoint,
        environment_variables=_args_to_dict(args.env_vars),
        blueprint_id=args.blueprint_id,
        blueprint_name=args.blueprint_name,
        code_mounts=args.code_mounts,
        snapshot_id=args.snapshot_id,
        launch_parameters=LaunchParameters(
            after_idle=idle_config,
            launch_commands=args.launch_commands,
            resource_size_request=args.resources,
            architecture=args.architecture,
            user_parameters=user_parameters,
        ),
    )
    print(f"create devbox={devbox.model_dump_json(indent=4)}")

async def list_devboxes(args) -> None:
    """List all devboxes."""
    extra_query = {"status": args.status} if args.status is not None else None
    paginator = await runloop_api_client().devboxes.list(
        extra_query=extra_query,
        limit=args.limit,
    )
    async for devbox in paginator:
        print(f"devbox={devbox.model_dump_json(indent=4)}")

async def get(args) -> None:
    """Get a specific devbox."""
    assert args.id is not None
    devbox = await runloop_api_client().devboxes.retrieve(args.id)
    print(f"devbox={devbox.model_dump_json(indent=4)}")

async def execute(args) -> None:
    """Execute a command on a devbox."""
    assert args.id is not None
    assert args.command is not None
    result = await runloop_api_client().devboxes.execute_sync(
        id=args.id, command=args.command, shell_name=args.shell_name or NOT_GIVEN
    )
    print("exec_result=", result)

async def execute_async(args) -> None:
    """Execute a command asynchronously on a devbox."""
    assert args.id is not None
    assert args.command is not None
    devbox = await runloop_api_client().devboxes.execute_async(
        id=args.id, command=args.command, shell_name=args.shell_name or NOT_GIVEN
    )
    print(f"execution={devbox.model_dump_json(indent=4)}")

async def get_async_exec(args) -> None:
    """Get the status of an async execution."""
    assert args.id is not None
    assert args.execution_id is not None
    devbox = await runloop_api_client().devboxes.executions.retrieve(
        execution_id=args.execution_id,
        devbox_id=args.id,
        shell_name=args.shell_name or NOT_GIVEN,
    )
    print(f"execution={devbox.model_dump_json(indent=4)}")

async def logs(args) -> None:
    """Get devbox logs."""
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

async def suspend(args) -> None:
    """Suspend a devbox."""
    assert args.id is not None
    devbox = await runloop_api_client().devboxes.suspend(args.id)
    print(f"devbox={devbox.model_dump_json(indent=4)}")

async def resume(args) -> None:
    """Resume a suspended devbox."""
    assert args.id is not None
    devbox = await runloop_api_client().devboxes.resume(args.id)
    print(f"devbox={devbox.model_dump_json(indent=4)}")

async def shutdown(args) -> None:
    """Shutdown a devbox."""
    assert args.id is not None
    devbox = await runloop_api_client().devboxes.shutdown(args.id)
    print(f"devbox={devbox.model_dump_json(indent=4)}")

# SSH related functions
async def get_ssh_key(devbox_id: str) -> tuple[str, str, str] | None:
    """Get or create SSH key for a devbox."""
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

async def wait_for_ready(devbox_id: str, timeout_seconds: int = 180, poll_interval_seconds: int = 3) -> bool:
    """Wait for a devbox to be ready."""
    start_time = time.time()
    
    while True:
        try:
            devbox = await runloop_api_client().devboxes.retrieve(devbox_id)
            
            if devbox.status == "running":
                print(f"Devbox {devbox_id} is ready!")
                return True
            elif devbox.status == "failure":
                print(f"Devbox {devbox_id} failed to start (status: {devbox.status})")
                return False
            elif devbox.status in ["shutdown", "suspended"]:
                print(f"Devbox {devbox_id} is not running (status: {devbox.status})")
                return False
            else:
                elapsed = time.time() - start_time
                remaining = timeout_seconds - elapsed
                print(f"Devbox {devbox_id} is still {devbox.status}... (elapsed: {elapsed:.0f}s, remaining: {remaining:.0f}s)")
                
                if elapsed >= timeout_seconds:
                    print(f"Timeout waiting for devbox {devbox_id} to be ready after {timeout_seconds} seconds")
                    return False
                
                await asyncio.sleep(poll_interval_seconds)
                
        except Exception as e:
            elapsed = time.time() - start_time
            if elapsed >= timeout_seconds:
                print(f"Timeout waiting for devbox {devbox_id} to be ready after {timeout_seconds} seconds (error: {e})")
                return False
            
            print(f"Error checking devbox status: {e}, retrying in {poll_interval_seconds} seconds...")
            await asyncio.sleep(poll_interval_seconds)

async def ssh(args) -> None:
    """SSH into a devbox."""
    if args.id is None:
        raise ValueError("The 'id' argument is required and was not provided.")

    # Wait for devbox to be ready unless --no-wait is specified
    if not args.no_wait:
        print(f"Waiting for devbox {args.id} to be ready...")
        if not await wait_for_ready(args.id, args.timeout, args.poll_interval):
            print(f"Devbox {args.id} is not ready. Please try again later.")
            return

    devbox = await runloop_api_client().devboxes.retrieve(args.id)
    user = (
        devbox.launch_parameters.user_parameters.username
        if devbox.launch_parameters.user_parameters
        else "user"
    )

    ssh_info = await get_ssh_key(args.id)
    if not ssh_info:
        return

    keyfile_path, _, url = ssh_info

    if args.config_only:
        print(
            f"""
Host {args.id}
  Hostname {url}
  User {user}
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
        f"{user}@{url}",
    ]
    subprocess.run(command)

async def scp(args) -> None:
    """SCP files to/from a devbox."""
    assert args.id is not None
    assert args.src is not None
    assert args.dst is not None

    ssh_info = await get_ssh_key(args.id)
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

async def rsync(args) -> None:
    """Rsync files to/from a devbox."""
    assert args.id is not None
    assert args.src is not None
    assert args.dst is not None

    ssh_info = await get_ssh_key(args.id)
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

async def tunnel(args) -> None:
    """Create an SSH tunnel to a devbox."""
    if args.id is None:
        raise ValueError("The 'id' argument is required and was not provided.")

    if ":" not in args.ports:
        raise ValueError("Ports must be specified as 'local:remote'")

    local_port, remote_port = args.ports.split(":")

    ssh_info = await get_ssh_key(args.id)
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

# File operations
async def read_file(args) -> None:
    """Read a file from a devbox."""
    assert args.id is not None
    assert args.output is not None
    contents = await runloop_api_client().devboxes.read_file_contents(
        id=args.id, file_path=args.remote
    )
    with open(args.output, "w", encoding="utf-8") as f:
        f.write(contents)
    print(
        f"Wrote remote file {args.remote} from devbox {args.id} to local file {args.output}"
    )

async def write_file(args) -> None:
    """Write a file to a devbox."""
    assert args.id is not None
    assert args.input is not None
    assert args.remote is not None
    if not os.path.exists(args.input):
        raise FileNotFoundError(f"Input file {args.input} does not exist")
    with open(args.input, "r", encoding="utf-8") as f:
        contents = f.read()
    await runloop_api_client().devboxes.write_file_contents(
        id=args.id, file_path=args.remote, contents=contents
    )
    print(
        f"Wrote local file {args.input} to remote file {args.remote} on devbox {args.id}"
    )

async def upload_file(args) -> None:
    """Upload a file to a devbox."""
    assert args.id is not None
    assert args.path is not None
    assert args.file is not None

    with open(args.file, "rb") as f:
        await runloop_api_client().devboxes.upload_file(
            id=args.id, path=args.path, file=f
        )
    print(f"Uploaded file {args.file} to {args.path}")

async def download_file(args) -> None:
    """Download a file from a devbox."""
    assert args.id is not None
    assert args.file_path is not None
    assert args.output_path is not None

    result = await runloop_api_client().devboxes.download_file(
        id=args.id, path=args.file_path
    )
    await result.write_to_file(args.output_path)
    print(f"File downloaded to {args.output_path}")

# Snapshot operations
async def snapshot(args) -> None:
    """Create a snapshot of a devbox."""
    assert args.devbox_id is not None
    snapshot = await runloop_api_client().devboxes.snapshot_disk_async(args.devbox_id)
    print(f"snapshot={snapshot.model_dump_json(indent=4)}")

async def get_snapshot_status(args) -> None:
    """Get the status of a snapshot operation."""
    assert args.snapshot_id is not None
    status = await runloop_api_client().devboxes.disk_snapshots.query_status(
        args.snapshot_id
    )
    print(f"snapshot_status={status.model_dump_json(indent=4)}")

async def list_snapshots(args) -> None:
    """List all snapshots."""
    snapshots_list = await runloop_api_client().devboxes.list_disk_snapshots()
    print(f"snapshots={snapshots_list.model_dump_json(indent=4)}")