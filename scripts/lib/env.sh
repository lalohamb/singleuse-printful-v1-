#!/bin/bash
# env.sh — shared env file helpers

# Read a single value from a file
env_get() {
  local key="$1" file="$2"
  [[ ! -f "$file" ]] && echo "" && return 0
  grep -E "^${key}=" "$file" | tail -1 | cut -d'=' -f2- | sed "s/^['\"]//;s/['\"]$//" || true
}

# Upsert a key in a file (replace if exists, append if not)
env_set() {
  local key="$1" value="$2" file="$3"
  if grep -qE "^${key}=" "$file" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$file"
  else
    echo "${key}=${value}" >> "$file"
  fi
}

# If key is missing or empty, prompt user and write it
env_require() {
  local key="$1" file="$2" prompt="$3" default="$4"
  local current
  current=$(env_get "$key" "$file")
  if [[ -z "$current" ]]; then
    if [[ -n "$default" ]]; then
      read -rp "  $prompt [$default]: " input
      input="${input:-$default}"
    else
      read -rp "  $prompt: " input
    fi
    env_set "$key" "$input" "$file"
    echo "$input"
  else
    echo "$current"
  fi
}

# Validate all required keys are non-empty in a file
env_validate() {
  local file="$1"
  shift
  local missing=()
  for key in "$@"; do
    local val
    val=$(env_get "$key" "$file")
    [[ -z "$val" ]] && missing+=("$key")
  done
  if [[ ${#missing[@]} -gt 0 ]]; then
    echo "❌ Missing required values in $file:"
    for k in "${missing[@]}"; do echo "   - $k"; done
    return 1
  fi
  return 0
}
