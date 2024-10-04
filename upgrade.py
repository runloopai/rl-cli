#!/usr/bin/env python3

import os
import subprocess
import sys
import re
import toml

def run_command(command, cwd=None):
    try:
        result = subprocess.run(command, check=True, text=True, capture_output=True, cwd=cwd)
        return result.stdout.strip()
    except subprocess.CalledProcessError as e:
        print(f"Error running command: {' '.join(command)}")
        print(f"Error details: {e}")
        print(f"Error output: {e.output}")
        sys.exit(1)

def check_directory():
    homebrew_formula_path = "../homebrew-tap/Formula/rl-cli.rb"
    if not os.path.exists(homebrew_formula_path):
        print("Error: ../homebrew-tap/Formula/rl-cli.rb does not exist.")
        print("Please clone the homebrew-tap repo adjacent to this repo:")
        print("git clone https://github.com/runloopai/homebrew-tap.git ../homebrew-tap")
        sys.exit(1)

def check_git_status(repo_path):
    if run_command(["git", "status", "--porcelain"], cwd=repo_path):
        print(f"Error: Git repository at {repo_path} has uncommitted changes.")
        sys.exit(1)

def get_version():
    try:
        with open('pyproject.toml', 'r') as f:
            pyproject = toml.load(f)
        return pyproject['project']['version']
    except Exception as e:
        print(f"Error reading version from pyproject.toml: {e}")
        sys.exit(1)

def update_homebrew_formula():
    package_name = "rl-cli"
    homebrew_formula_path = f"../homebrew-tap/Formula/{package_name}.rb"
    resources_path = f"../homebrew-tap/Formula/{package_name}_resources.rb"

    # Generate resources file
    resources_content = run_command(["poet", "-r", package_name])
    with open(resources_path, 'w') as f:
        f.write(resources_content)

    # Update main formula file to import resources
    with open(homebrew_formula_path, 'r') as f:
        formula_content = f.read()

    if "require_relative" not in formula_content:
        formula_content = f"require_relative '{package_name}_resources'\n\n" + formula_content
        formula_content = formula_content.replace("def install", f"include RlCliResources\n\n  def install")

    # Update version and URL
    version = get_version()
    url = f"https://github.com/runloopai/rl-cli/archive/v{version}.tar.gz"
    formula_content = re.sub(r'url ".*"', f'url "{url}"', formula_content)
    
    # Calculate new SHA256
    sha256 = run_command(["curl", "-L", url, "|", "shasum", "-a", "256"]).split()[0]
    formula_content = re.sub(r'sha256 ".*"', f'sha256 "{sha256}"', formula_content)

    with open(homebrew_formula_path, 'w') as f:
        f.write(formula_content)

def main():
    print("Checking directories...")
    check_directory()

    print("Checking git status...")
    check_git_status(".")
    check_git_status("../homebrew-tap")

    print("Updating Homebrew formula...")
    update_homebrew_formula()

    print("\nUpgrade process complete!")
    print("\nNext steps:")
    print("1. Review the changes in the homebrew-tap repository.")
    print("2. If satisfactory, commit and push the changes:")
    print("   cd ../homebrew-tap")
    print("   git add Formula/")
    print("   git commit -m 'Update rl-cli formula'")
    print("   git push origin main")
    print("3. Create a new release for rl-cli on GitHub.")
    print("4. Run the publish.py script to publish to PyPI.")

if __name__ == "__main__":
    main()