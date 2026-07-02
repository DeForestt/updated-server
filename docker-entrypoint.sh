#!/bin/bash
set -euo pipefail

if [[ -n "${AFLAT_TAG:-}" ]]; then
  SANDBOX_IMAGE="deforestt/aflat-sandbox:${AFLAT_TAG:-latest}"
elif [[ -n "${AFLAT_SANDBOX_IMAGE:-}" ]]; then
  SANDBOX_IMAGE="$AFLAT_SANDBOX_IMAGE"
else
  SANDBOX_IMAGE="deforestt/aflat-sandbox:latest"
fi

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

verify_sandbox_image() {
  docker run --rm "$SANDBOX_IMAGE" -c 'aflat --help >/dev/null 2>&1; code=$?; [ "$code" -eq 0 ] || [ "$code" -eq 1 ]'
}

pull_sandbox_image() {
  if command -v ionice >/dev/null 2>&1; then
    ionice -c3 nice -n 19 docker pull "$SANDBOX_IMAGE"
  else
    nice -n 19 docker pull "$SANDBOX_IMAGE"
  fi
}

mark_sandbox_ready() {
  docker image tag "$SANDBOX_IMAGE" "${SANDBOX_IMAGE%:*}:cached"
  cleanup_old_sandbox_images
  echo "ready" > /project/tmp/aflat-sandbox-image.status
  echo "Sandbox image is ready"
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
  mkdir -p /project/tmp
  if docker image inspect "$SANDBOX_IMAGE" >/dev/null 2>&1; then
    if verify_sandbox_image; then
      mark_sandbox_ready
    else
      echo "preparing" > /project/tmp/aflat-sandbox-image.status
      echo "Sandbox image is present but failed the aflat smoke test; pulling a fresh copy" >&2
      if docker image rm -f "$SANDBOX_IMAGE" >/dev/null 2>&1; then
        echo "Removed failed local sandbox image $SANDBOX_IMAGE"
      fi
      (
        set +e
        if pull_sandbox_image && verify_sandbox_image; then
          mark_sandbox_ready
        else
          echo "error" > /project/tmp/aflat-sandbox-image.status
          echo "Sandbox image refresh or smoke test failed" >&2
        fi
      ) &
      SANDBOX_PULL_PID=$!
      export SANDBOX_PULL_PID
    fi
    return
  fi

  echo "preparing" > /project/tmp/aflat-sandbox-image.status
  (
    set +e
    sleep 10

    if pull_sandbox_image && verify_sandbox_image; then
      mark_sandbox_ready
    else
      echo "error" > /project/tmp/aflat-sandbox-image.status
      echo "Sandbox image pull or smoke test failed" >&2
    fi
  ) &
  SANDBOX_PULL_PID=$!
  export SANDBOX_PULL_PID
}

start_dockerd
cd /project
ensure_sandbox_image_async
exec sudo -E ./bin/a.out "$@"
