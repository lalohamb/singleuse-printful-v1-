#!/bin/bash
# stripe.sh — Stripe API helpers

# Register a webhook endpoint and return the signing secret
register_webhook() {
  local secret_key="$1"
  local endpoint_url="$2"

  local response
  response=$(curl -s -w "\n%{http_code}" \
    -X POST "https://api.stripe.com/v1/webhook_endpoints" \
    -u "${secret_key}:" \
    --data-urlencode "url=${endpoint_url}" \
    -d "enabled_events[]=checkout.session.completed" \
    -d "enabled_events[]=payment_intent.payment_failed")

  local http_code body
  http_code=$(echo "$response" | tail -1)
  body=$(echo "$response" | head -1)

  if [[ "$http_code" == "200" || "$http_code" == "201" ]]; then
    echo "$body" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["secret"])'
    return 0
  else
    echo "❌ Stripe webhook registration failed (HTTP $http_code): $body" >&2
    return 1
  fi
}

# Delete all existing webhooks pointing to a URL to avoid duplicates
delete_existing_webhooks() {
  local secret_key="$1"
  local endpoint_url="$2"

  local response
  response=$(curl -s "https://api.stripe.com/v1/webhook_endpoints?limit=20" \
    -u "${secret_key}:")

  local ids
  ids=$(echo "$response" | python3 -c "
import json,sys
data=json.load(sys.stdin)
for ep in data.get('data',[]):
    if ep.get('url')=='${endpoint_url}':
        print(ep['id'])
")
  for id in $ids; do
    curl -s -X DELETE "https://api.stripe.com/v1/webhook_endpoints/${id}" \
      -u "${secret_key}:" > /dev/null
  done
}
