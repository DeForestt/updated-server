#!/bin/bash
set -euo pipefail

SANDBOX_IMAGE="${AFLAT_SANDBOX_IMAGE:-aflat-sandbox:latest}"

start_dockerd() {
  mkdir -p /var/lib/docker /var/run
  dockerd --host=unix:///var/run/docker.sock --storage-driver=vfs > /var/log/dockerd.log 2>&1 &
  local pid=$!

  for _ in $(seq 1 30); do
    if docker info >/dev/null 2>&1; then
      return
    fi
    sleep 1
  done

  echo "Docker daemon failed to start" >&2
  wait "$pid"
}

ensure_sandbox_image() {
  if docker image inspect "$SANDBOX_IMAGE" >/dev/null 2>&1; then
    return
  fi

  if docker pull "$SANDBOX_IMAGE"; then
    return
  fi

  echo "Failed to pull sandbox image $SANDBOX_IMAGE" >&2
  exit 1
}

start_dockerd
ensure_sandbox_image
cd /project
exec sudo -E ./bin/a.out "$@"
