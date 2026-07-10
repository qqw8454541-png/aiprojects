#!/bin/bash

# Configuration
API_URL="https://llm-web-api.vercel.app/api/evaluate"
API_SECRET="${LLM_API_SECRET:-dev-secret-key-123}"

echo "Testing LLM API..."
echo "Endpoint: $API_URL"

# Request Payload
PAYLOAD=$(cat <<EOF
{
  "players": [
    { "playerId": "1", "playerName": "Alice", "pt": 50, "rank": 1, "history": [1, 2, 1] },
    { "playerId": "2", "playerName": "Bob", "pt": 10, "rank": 2, "history": [2, 1, 2] }
  ],
  "locale": "zh",
  "scoringCtx": {
    "ruleName": "Standard",
    "uma": [15, 5, -5, -15],
    "roundCount": 1
  }
}
EOF
)

MAX_RETRIES=3
RETRY_DELAY=10

for ((i=1; i<=MAX_RETRIES; i++)); do
  echo "Attempt $i of $MAX_RETRIES..."
  
  # Perform curl request and capture HTTP status code and response body
  RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $API_SECRET" \
    -d "$PAYLOAD")

  # The last line of the output is the HTTP status code, everything before is the body
  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  BODY=$(echo "$RESPONSE" | sed '$d')

  echo "Status Code: $HTTP_CODE"

  if [ "$HTTP_CODE" -eq 200 ]; then
    break
  fi

  echo "Error response text: $BODY"
  
  if [ "$i" -lt "$MAX_RETRIES" ]; then
    echo "Request failed, retrying in $RETRY_DELAY seconds..."
    sleep $RETRY_DELAY
  else
    echo "All $MAX_RETRIES attempts failed."
    exit 1
  fi
done

echo "Response JSON:"
echo "$BODY" | jq .

# JSON format check
HAS_DATA=$(echo "$BODY" | jq -e 'has("data")' 2>/dev/null)
if [ "$HAS_DATA" != "true" ]; then
  echo "Test failed: JSON response does not contain 'data' property."
  exit 1
fi

DATA_PROP_TYPE=$(echo "$BODY" | jq -r '.data | type' 2>/dev/null)

if [ "$DATA_PROP_TYPE" != "object" ]; then
  echo "Test failed: 'data' property is not a valid object. It is a $DATA_PROP_TYPE."
  exit 1
fi

echo "JSON format check passed! ✅"
exit 0
