🚀 PROJECT NAME
AI Paywall System — Pay-Before-Access Middleware + Encrypted Content using Sui + Walrus + Seal
🎯 WHAT THIS PROJECT SOLVES

AI agents, bots, crawlers, and scrapers can currently access:

premium data

research content

APIs

datasets

hidden pages

…FOR FREE.

Creators cannot enforce:

payment

licensing

rate limits

ownership

access control

There is no standard for “AI must pay before accessing data”.

This project solves that.

💡 CORE IDEA
A universal NPM middleware + on-chain AccessPass system that forces AI agents to pay on-chain before accessing encrypted premium content stored on Walrus, decrypted using Seal.

This system:

lets websites hide content behind your infrastructure

ensures AI must pay to access

enforces usage limits

decrypts data only after payment

logs everything on-chain

🧩 HIGH-LEVEL WORKFLOW

Website owner uploads premium content to your platform

Your platform encrypts the content using Seal & stores it on Walrus

Your Sui registry contract stores metadata linking website → route → Walrus CID

Website integrates your NPM middleware to protect the route

AI agent requests protected route → receives 402 challenge (payment required)

AI agent pays through your client SDK → Sui mints AccessPass object

Agent retries request with signed headers

Gateway verifies AccessPass, decrements usage, fetches encrypted Walrus content

Seal decrypts the content → gateway returns decrypted content to website

Website serves the final content to AI agent

This entire pipeline is automated.

🔐 DETAILED COMPONENTS
✔ 1. Registry Contract (Sui Move)

Stores:

domain → resource → walrusCid

encryption metadata

Seal policy data

Example entry stored on-chain:

{
  domain: "www.efd.com",
  resource: "/hidden",
  walrusCid: "<CID123>",
  sealPolicy: "<policy_id>"
}

✔ 2. Encrypted Storage (Walrus)

Premium content is:

encrypted using Seal key servers

uploaded to Walrus

referenced with walrus CID stored in contract

Website never stores plaintext.
Only your system can decrypt.

✔ 3. Seal Encryption & Decryption

Seal responsibilities:

encrypt content at upload time

release decryption key ONLY when:

AccessPass exists

owner matches signer

remaining > 0

Seal enforces:

“Only paid users can decrypt.”

This makes content useless without paying.

✔ 4. NPM Middleware (installed by website)

Website owner installs:

npm install ai-paywall


Then protects routes:

const { paywall } = require("ai-paywall");

app.use("/hidden", paywall({
   price: "0.1",
   receiver: "0xABC123",
   domain: "www.efd.com"
}));


Middleware does:

detect premium request

send 402 if unpaid

forward proof headers to gateway

serve decrypted content returned by gateway

✔ 5. 402 Payment Required Flow

On first request:

GET /hidden


Middleware returns:

{
  "status": 402,
  "price": "0.1 SUI",
  "receiver": "0xABC123",
  "payTo": "<smart-contract>",
  "domain": "www.efd.com",
  "resource": "/hidden",
  "nonce": "uuid"
}


This informs AI:

how much to pay

where to pay

for which resource

reference nonce for pass minting

✔ 6. Client SDK (AI agent usage)

Agent uses:

client.payForAccess({
   domain: "www.efd.com",
   resource: "/hidden"
});


SDK calls:

purchase_pass()


on Sui contract.

✔ 7. AccessPass (Minted on Sui)

Contract mints:

AccessPass {
  passId,
  owner,
  domain,
  resource,
  walrusCid,
  remaining,
  expiry,
  nonce
}


This is the license to decrypt content.

✔ 8. AI Agent Retries With Signed Headers

AI agent signs:

{ passId, domain, resource, ts }


Headers sent:

x-pass-id
x-signer
x-sig
x-ts


Middleware forwards to gateway.

✔ 9. Gateway Verifies Access

Gateway:

verifies signature

fetches AccessPass from Sui

checks:

owner == signer

domain matches

resource matches

remaining > 0

expiry not passed

decrements usage:

consume_pass(passId)


fetches encrypted content from Walrus

calls Seal for decryption

returns plaintext content → middleware

✔ 10. Middleware Returns Final Content to User

Your middleware receives decrypted result from gateway, then:

res.send(decryptedContent)


User or AI agent gets the original content.

🔁 ENTIRE END-TO-END FLOW (AS STEPS)
1. Website owner uploads hidden content → encrypted → Walrus
2. Registry contract stores domain → resource → CID mapping
3. Website integrates NPM middleware
4. Agent requests premium content
5. Middleware returns 402 challenge
6. Agent uses SDK to pay (on-chain)
7. AccessPass minted on Sui
8. Agent retries request with signed headers
9. Gateway verifies AccessPass
10. Gateway consumes remaining access
11. Gateway fetches Walrus encrypted blob
12. Gateway calls Seal to decrypt
13. Gateway returns decrypted content
14. Middleware sends content to agent
15. All accesses logged (audit)