#!/bin/bash
# supabase.sh — Supabase API helpers

# Run SQL via psql if available, otherwise via Supabase Management API
run_sql() {
  local sql="$1"
  local project_ref="$2"
  local service_role_key="$3"
  local db_url="$4"

  if [[ -n "$db_url" ]] && command -v psql &>/dev/null; then
    echo "$sql" | psql "$db_url" -q
    return $?
  fi

  # Fallback: Supabase Management API
  local response
  response=$(curl -s -w "\n%{http_code}" \
    -X POST "https://api.supabase.com/v1/projects/${project_ref}/database/query" \
    -H "Authorization: Bearer ${service_role_key}" \
    -H "Content-Type: application/json" \
    -d "{\"query\": $(echo "$sql" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')}")
  local http_code
  http_code=$(echo "$response" | tail -1)
  if [[ "$http_code" != "200" ]]; then
    echo "❌ SQL execution failed (HTTP $http_code)"
    echo "$response" | head -1
    return 1
  fi
  return 0
}

# Run a SQL file
run_sql_file() {
  local file="$1"
  local project_ref="$2"
  local service_role_key="$3"
  local db_url="$4"

  if [[ -n "$db_url" ]] && command -v psql &>/dev/null; then
    psql "$db_url" -q -f "$file"
    return $?
  fi

  run_sql "$(cat "$file")" "$project_ref" "$service_role_key" "$db_url"
}

# Create a Supabase auth user via Admin API
create_auth_user() {
  local project_ref="$1"
  local service_role_key="$2"
  local email="$3"
  local password="$4"

  local response
  response=$(curl -s -w "\n%{http_code}" \
    -X POST "https://${project_ref}.supabase.co/auth/v1/admin/users" \
    -H "apikey: ${service_role_key}" \
    -H "Authorization: Bearer ${service_role_key}" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"${email}\", \"password\": \"${password}\", \"email_confirm\": true}")

  local http_code body
  http_code=$(echo "$response" | tail -1)
  body=$(echo "$response" | head -1)

  if [[ "$http_code" == "200" || "$http_code" == "201" ]]; then
    echo "$body" | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])'
    return 0
  elif echo "$body" | grep -q "already been registered"; then
    # User exists — fetch their ID
    local list_response
    list_response=$(curl -s \
      "https://${project_ref}.supabase.co/auth/v1/admin/users?email=${email}" \
      -H "apikey: ${service_role_key}" \
      -H "Authorization: Bearer ${service_role_key}")
    echo "$list_response" | python3 -c 'import json,sys; users=json.load(sys.stdin).get("users",[]); print(users[0]["id"]) if users else print("")'
    return 0
  else
    echo "❌ Failed to create auth user (HTTP $http_code): $body" >&2
    return 1
  fi
}

# Insert user ID into admins table
insert_admin() {
  local project_ref="$1"
  local service_role_key="$2"
  local user_id="$3"
  local email="$4"

  curl -s -o /dev/null \
    -X POST "https://${project_ref}.supabase.co/rest/v1/admins" \
    -H "apikey: ${service_role_key}" \
    -H "Authorization: Bearer ${service_role_key}" \
    -H "Content-Type: application/json" \
    -H "Prefer: resolution=ignore-duplicates" \
    -d "{\"id\": \"${user_id}\", \"email\": \"${email}\", \"role\": \"super_admin\"}"
}

# Push secrets to Supabase edge functions
push_secrets() {
  local project_ref="$1"
  local access_token="$2"
  shift 2
  local secrets_json="["
  local first=true
  while [[ $# -gt 0 ]]; do
    local key="$1" value="$2"
    shift 2
    [[ "$first" == "true" ]] && first=false || secrets_json+=","
    secrets_json+="{\"name\":\"${key}\",\"value\":\"${value}\"}"
  done
  secrets_json+="]"

  local response
  response=$(curl -s -w "\n%{http_code}" \
    -X POST "https://api.supabase.com/v1/projects/${project_ref}/secrets" \
    -H "Authorization: Bearer ${access_token}" \
    -H "Content-Type: application/json" \
    -d "$secrets_json")
  local http_code
  http_code=$(echo "$response" | tail -1)
  [[ "$http_code" == "200" || "$http_code" == "201" ]] && return 0 || return 1
}

# Deploy edge functions
deploy_functions() {
  local project_ref="$1"
  shift
  for fn in "$@"; do
    echo "    Deploying $fn..."
    npx supabase functions deploy "$fn" --project-ref "$project_ref" 2>&1 | tail -1
  done
}
