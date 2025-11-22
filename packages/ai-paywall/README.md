# ai-paywall

Middleware for protecting routes behind Sui blockchain payments.

## Installation

```bash
npm install ai-paywall
```

## Usage

```javascript
const { paywall } = require("ai-paywall");

app.use("/hidden", paywall({
   price: "0.1",
   receiver: "0xABC123",
   domain: "www.efd.com",
   contractAddress: "0x..."
}));
```

## Documentation

Coming soon...

