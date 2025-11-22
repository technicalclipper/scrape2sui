# Why Split Coins?

## Short Answer

**Splitting coins is necessary IF you don't already have a coin with exactly the payment amount (0.01 SUI = 10,000,000 MIST).**

## Long Answer

### How the Contract Works

The `purchase_pass` function signature is:
```move
public entry fun purchase_pass(
    payment: coin::Coin<SUI>,  // Takes a Coin OBJECT, not an amount
    ...
)
```

**Key Points:**
1. The function takes a **Coin object**, not an amount
2. The **entire coin** is transferred to the treasury (you can't pay part of a coin)
3. If you pass a 1 SUI coin, the contract takes all 1 SUI (you'd overpay!)

### Why Split?

**Scenario 1: You have large coins (1 SUI, 5 SUI, etc.)**
```
Your wallet:
  - Coin 1: 1 SUI (1,000,000,000 MIST)
  - Coin 2: 5 SUI (5,000,000,000 MIST)

You need to pay: 0.01 SUI (10,000,000 MIST)

❌ Can't use Coin 1 directly - would overpay by 0.99 SUI!
❌ Can't use Coin 2 directly - would overpay by 4.99 SUI!

✅ Solution: Split 0.01 SUI from one of your coins
```

**Scenario 2: You already have a coin with exactly 0.01 SUI**
```
Your wallet:
  - Coin 1: 0.01 SUI (10,000,000 MIST)
  - Coin 2: 0.5 SUI (500,000,000 MIST)

You need to pay: 0.01 SUI (10,000,000 MIST)

✅ You can use Coin 1 directly - no splitting needed!
```

### When You Can Skip Splitting

**Option 1: Already have exact amount**
```bash
# Check your coins
sui client gas

# If you see a coin with exactly 10,000,000 MIST (0.01 SUI)
# You can use it directly:
sui client call \
  --package 0x6813c38e75aa12141e8047a082edec4242e1f0fff47e2a3c886d760b04a4ec4f \
  --module paywall \
  --function purchase_pass \
  --args <COIN_WITH_EXACTLY_0.01_SUI> \
    "www.example.com" \
    "/premium" \
    10 \
    0 \
    "<NONCE>" \
  --gas-budget 10000000
```

**Option 2: Don't mind overpaying**
```bash
# If you have a coin larger than 0.01 SUI and don't mind overpaying:
sui client call \
  --package 0x6813c38e75aa12141e8047a082edec4242e1f0fff47e2a3c886d760b04a4ec4f \
  --module paywall \
  --function purchase_pass \
  --args <LARGER_COIN> \
    "www.example.com" \
    "/premium" \
    10 \
    0 \
    "<NONCE>" \
  --gas-budget 10000000

# ⚠️ Warning: You'll pay the entire coin amount, not just 0.01 SUI!
```

### Best Practice: Always Split

**Why split?**
1. ✅ **Pay exactly the right amount** - no overpayment
2. ✅ **Works with any coin size** - flexible
3. ✅ **Standard pattern** - what most Sui apps do
4. ✅ **Prevents mistakes** - won't accidentally overpay

**The split command:**
```bash
sui client split-coins \
  --gas-budget 10000000 \
  --coins <YOUR_LARGE_COIN> \
  --amounts 10000000  # Creates a new coin with exactly 10,000,000 MIST
```

This creates a **new coin** with exactly 10,000,000 MIST (0.01 SUI) that you can use for payment.

### Summary

| Situation | Need to Split? |
|-----------|---------------|
| Have coin with exactly 0.01 SUI | ❌ No |
| Have coin larger than 0.01 SUI | ✅ Yes (to pay exact amount) |
| Have coin larger than 0.01 SUI but don't mind overpaying | ❌ No (but not recommended) |
| Have multiple small coins | ✅ Yes (or use one that's close) |

**Recommendation:** Always split to ensure you pay exactly the right amount!

