# AI Paywall Registry App

A Next.js application for registering and encrypting content for the AI Paywall system. This app allows clients to upload files, encrypt them using Seal, and store them on Walrus.

## Features

- 📤 **File Upload**: Drag-and-drop or click to upload files
- 🔐 **Seal Encryption**: Encrypt files using Seal's key management system
- 💾 **Walrus Storage**: Store encrypted content on decentralized Walrus storage
- 🔗 **Sui Registration**: Register content metadata on Sui blockchain (pending contract)
- 🎨 **Modern UI**: Built with Tailwind CSS and Radix UI components

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

```bash
cd registry-app
npm install
```

### Environment Variables

Create a `.env.local` file in the `registry-app` directory:

```env
# Sui Contract Configuration (Required)
# This is the package ID of your Move contract (ai_paywall::registry)
SUI_PACKAGE_ID=0x6813c38e75aa12141e8047a082edec4242e1f0fff47e2a3c886d760b04a4ec4f

# Registry Object ID (Required)
# The shared Registry object ID created when the contract was initialized
SUI_REGISTRY_ID=0x...

# Sui Network (default: testnet)
SUI_NETWORK=testnet

# Seal Configuration (Optional)
# Threshold for Seal encryption (default: 2)
SEAL_THRESHOLD=2

# Server-side Registration (Optional)
# If provided, the server will automatically register resources on-chain
# Format: hex-encoded private key (64 characters, no 0x prefix)
# WARNING: Only use this in secure environments with a dedicated account
SUI_SERVER_PRIVATE_KEY=...
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build

```bash
npm run build
npm start
```

## Project Structure

```
registry-app/
├── app/
│   ├── api/
│   │   └── registry/
│   │       └── register/     # API route for content registration
│   ├── registry/              # Registry page
│   ├── layout.tsx             # Root layout
│   ├── page.tsx               # Home page
│   └── globals.css            # Global styles
├── components/
│   ├── ui/                    # Reusable UI components
│   └── file-upload.tsx        # File upload component
└── lib/
    └── utils.ts               # Utility functions
```

## Usage

1. Navigate to `/registry` page
2. Upload a file using drag-and-drop or file picker
3. Enter domain (e.g., `www.example.com`)
4. Enter resource path (e.g., `/hidden/content`)
5. Set price in SUI
6. Click "Encrypt & Register"
7. Wait for encryption and storage to complete
8. Copy the returned Walrus CID and Seal Policy ID

## Integration Status

- ✅ UI Components and File Upload
- ✅ API Route Structure
- ✅ Seal Encryption Integration (using @mysten/seal SDK)
- ✅ Walrus Storage Integration (using Walrus publisher endpoints)
- ✅ Sui Contract Registration (integrated with ai_paywall::registry contract)

## Next Steps

1. **Deploy Contract**: Deploy the `ai_paywall_registry.move` contract and set `SUI_REGISTRY_ID`
2. **Client-side Signing**: For production, implement wallet integration for client-side transaction signing
3. **Error Handling**: Enhance error handling and retry logic for Seal/Walrus/Sui operations
4. **File Validation**: Add file type and size validation
5. **Access Pass Purchase**: Implement the purchase flow using the contract's `purchase_pass` function

## Technologies

- **Next.js 16**: React framework
- **TypeScript**: Type safety
- **Tailwind CSS**: Styling
- **Radix UI**: Accessible component primitives
- **Lucide React**: Icons
- **@mysten/seal**: Seal encryption SDK
- **@mysten/sui**: Sui blockchain client

## License

ISC
