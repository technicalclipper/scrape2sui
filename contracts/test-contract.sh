#!/bin/bash

# Test script for AI Paywall Contract
# Usage: ./test-contract.sh

PACKAGE_ID="0x6813c38e75aa12141e8047a082edec4242e1f0fff47e2a3c886d760b04a4ec4f"
TREASURY_ID="0x6018aa0359bba7af126f9c837325ff2bdddebc250a33bff420c3e2e6d9519808"
PASS_COUNTER_ID="0x6cd4a831ed04f75da5e5a2a14710830dc26d1a929b4e5f50a4e71d3e3b4ee85c"

echo "🧪 Testing AI Paywall Contract"
echo "================================"
echo ""

# Get current account address
ADDRESS=$(sui client active-address)
echo "📝 Active Address: $ADDRESS"
echo ""

# Check Treasury object
echo "1️⃣  Checking Treasury Object..."
sui client object $TREASURY_ID
echo ""

# Check PassCounter object
echo "2️⃣  Checking PassCounter Object..."
sui client object $PASS_COUNTER_ID
echo ""

# Check package
echo "3️⃣  Checking Published Package..."
sui client object $PACKAGE_ID
echo ""

echo "✅ Basic checks complete!"
echo ""
echo "To test purchase_pass function, you need to:"
echo "  1. Create a payment coin with SUI"
echo "  2. Call purchase_pass with payment, domain, resource, remaining, expiry, nonce"
echo ""
echo "Example purchase command:"
echo "  sui client call --package $PACKAGE_ID \\"
echo "    --module paywall \\"
echo "    --function purchase_pass \\"
echo "    --args <PAYMENT_COIN_ID> <DOMAIN_BYTES> <RESOURCE_BYTES> 5 0 <NONCE_BYTES> $TREASURY_ID $PASS_COUNTER_ID \\"
echo "    --gas-budget 100000000"

