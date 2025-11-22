#!/bin/bash

# Test consume_pass with AccessPass ID
# Usage: ./test-consume.sh [ACCESS_PASS_ID]

PACKAGE_ID="0x6813c38e75aa12141e8047a082edec4242e1f0fff47e2a3c886d760b04a4ec4f"
ACCESS_PASS_ID="${1:-0xbbf31655ad2485d1f2e769784341ee5b83e8c40dc402c612990b5a5edc002723}"

echo "🧪 Testing consume_pass with AccessPass"
echo "AccessPass ID: $ACCESS_PASS_ID"
echo ""

echo "1️⃣  View AccessPass before consume..."
sui client object $ACCESS_PASS_ID
echo ""

echo "2️⃣  Calling consume_pass..."
sui client call \
  --package $PACKAGE_ID \
  --module paywall \
  --function consume_pass \
  --args $ACCESS_PASS_ID \
  --gas-budget 100000000

echo ""
echo "3️⃣  View AccessPass after consume..."
sui client object $ACCESS_PASS_ID

