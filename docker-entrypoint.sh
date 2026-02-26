#!/bin/bash
set -euo pipefail

SANDBOX_IMAGE="${AFLAT_SANDBOX_IMAGE:-deforestt/aflat-sandbox:latest}"

cleanup_old_sandbox_images() {
  local repo="${SANDBOX_IMAGE%:*}"
  local keep_tag="${SANDBOX_IMAGE##*:}"
  local keep_image="${repo}:${keep_tag}"
  local keep_cached="${repo}:cached"

  local image_listing
  image_listing=$(docker image ls "$repo" | tail -n +2 || true)
  if [[ -z "${image_listing//[[:space:]]/}" ]]; then
    return
  fi

  while read -r repo_name tag _rest; do
    [[ -z "$repo_name" ]] && continue
    local ref="${repo_name}:${tag}"
    if [[ "$ref" == "$keep_image" || "$ref" == "$keep_cached" ]]; then
      continue
    fi
    if docker image rm -f "$ref" >/dev/null 2>&1; then
      echo "Removed stale sandbox image $ref"
    fi
  done <<<"$image_listing"
}

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

ensure_sandbox_image_async() {
  if docker image inspect "$SANDBOX_IMAGE" >/dev/null 2>&1; then
    return
  fi

  (
    set +e
    if docker pull "$SANDBOX_IMAGE"; then
      docker image tag "$SANDBOX_IMAGE" "${SANDBOX_IMAGE%:*}:cached"
      cleanup_old_sandbox_images
      echo "Sandbox image pull completed"
    else
      echo "Sandbox image pull failed" >&2
    fi
  ) &
  SANDBOX_PULL_PID=$!
  export SANDBOX_PULL_PID
}

start_dockerd
ensure_sandbox_image_async
cd /project
exec sudo -E ./bin/a.out "$@"
