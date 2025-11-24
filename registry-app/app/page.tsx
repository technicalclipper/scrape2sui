"use client"

import Link from "next/link"
import Image from "next/image"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Shield, Lock, Zap, Code2, Coins, Database, Key, ArrowRight, Check, Sparkles } from "lucide-react"

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b-2 border-black backdrop-blur-xl bg-white/95">
        <div className="container mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 border-2 border-black bg-white flex items-center justify-center group-hover:bg-gray-100 transition-all duration-300 overflow-hidden">
              <Image
                src="/walrus-logo-main.png"
                alt="sui2scrape logo"
                width={40}
                height={40}
                className="object-contain"
              />
            </div>
            <span className="pixel-text text-2xl font-bold">SUI2SCRAPE</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8">
            <Link
              href="#how-it-works"
              className="pixel-text text-sm font-bold text-black hover:text-gray-600 transition-colors uppercase tracking-wider"
            >
              HOW IT WORKS
            </Link>
            <Link
              href="#integration"
              className="pixel-text text-sm font-bold text-black hover:text-gray-600 transition-colors uppercase tracking-wider"
            >
              INTEGRATION
            </Link>
            <Link
              href="#features"
              className="pixel-text text-sm font-bold text-black hover:text-gray-600 transition-colors uppercase tracking-wider"
            >
              FEATURES
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-32 pb-20 md:pt-40 md:pb-32">
        {/* Background Elements */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-accent/5 to-background pointer-events-none" />
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/20 rounded-full blur-[140px] pointer-events-none" />

        <div className="container mx-auto px-6 relative">
          <div className="max-w-5xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-black border-2 border-gray-400 px-4 py-2 rounded-sm text-sm font-mono font-bold mb-8 uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-gray-400" />
              <span className="text-white">POWERED BY SUI, WALRUS & SEAL</span>
            </div>

            {/* Main Headline */}
            <motion.h1
              className="pixel-text text-5xl md:text-6xl lg:text-7xl mb-6 leading-[1.1] text-balance"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            >
              MAKE AI AGENTS{" "}
              <motion.span
                className="silver-gradient"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              >
                PAY TO SCRAPE
              </motion.span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              className="text-base md:text-lg text-muted-foreground mb-10 text-pretty max-w-2xl mx-auto leading-relaxed font-mono"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              Universal paywall system that enforces on-chain payments from bots and AI agents using the{" "}
              <span className="text-foreground font-bold">x402 payment protocol</span>
            </motion.p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
              <Button
                size="lg"
                className="pixel-text text-lg px-10 h-14 bg-black text-white border-2 border-black hover:bg-gray-900 hover:border-gray-500 transition-all group uppercase tracking-wider font-mono"
                asChild
              >
                <Link href="#">
                  INSTALL PACKAGE
                  <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
              <Button
                size="lg"
                variant="outline"
                className="pixel-text text-lg px-10 h-14 bg-white text-black border-2 border-black hover:bg-gray-100 hover:border-gray-500 uppercase tracking-wider font-mono"
                asChild
              >
                <Link href="/registry">START NOW!</Link>
              </Button>
            </div>

            {/* Code Preview */}
            <div className="max-w-3xl mx-auto">
              <Card className="bg-black border-2 border-black shadow-2xl overflow-hidden">
                <div className="bg-gray-900 border-b-2 border-gray-700 px-6 py-3 flex items-center gap-2">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                  </div>
                  <span className="text-sm text-gray-300 ml-4 font-mono font-bold">middleware.js</span>
                </div>
                <div className="p-6 text-left bg-black">
                  <pre className="font-mono text-sm leading-relaxed">
                    <code className="text-gray-100">
                      <span className="text-blue-100">const</span>{" "}
                      <span className="text-gray-300">{"{"}</span> <span className="text-yellow-100">paywall</span>{" "}
                      <span className="text-gray-300">{"}"}</span> <span className="text-gray-400">=</span>{" "}
                      <span className="text-blue-100">require</span>
                      <span className="text-gray-300">(</span>
                      <span className="text-green-100">"ai-paywall"</span>
                      <span className="text-gray-300">);</span>
                      {"\n\n"}
                      <span className="text-gray-200">app</span>
                      <span className="text-gray-400">.</span>
                      <span className="text-blue-100">use</span>
                      <span className="text-gray-300">(</span>
                      <span className="text-green-100">"/premium"</span>
                      <span className="text-gray-300">, </span>
                      <span className="text-yellow-100">paywall</span>
                      <span className="text-gray-300">({"{"}</span>
                      {"\n  "}
                      <span className="text-gray-300">price: </span>
                      <span className="text-green-100">"0.1"</span>
                      <span className="text-gray-300">,</span>
                      {"\n  "}
                      <span className="text-gray-300">receiver: </span>
                      <span className="text-green-100">"0xABC123"</span>
                      {"\n"}
                      <span className="text-gray-300">{"}));"}</span>
                    </code>
                  </pre>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Problem Statement */}
      <section className="py-20 md:py-32 bg-muted/30">
        <div className="container mx-auto px-6">
          <div className="max-w-6xl mx-auto">
            <motion.div
              className="text-center mb-16"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
              <h2 className="pixel-text text-4xl md:text-5xl lg:text-6xl mb-6 text-balance leading-tight">
                AI IS SCRAPING YOUR PREMIUM CONTENT{" "}
                <span className="text-foreground">
                  FOR FREE
                </span>
              </h2>
              <p className="text-base md:text-lg text-muted-foreground text-pretty max-w-2xl mx-auto leading-relaxed">
                Bots, crawlers, and AI agents are accessing your research, APIs, and datasets without permission or
                payment. There's no standard enforcement mechanism.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-2 gap-8">
              {/* Without scrape2sui */}
              <Card className="relative overflow-hidden bg-white border-2 border-black">
                <div className="absolute top-0 left-0 right-0 h-1 bg-black" />
                <div className="p-8">
                  <div className="w-12 h-12 border-2 border-black bg-white flex items-center justify-center mb-6">
                    <span className="text-2xl">❌</span>
                  </div>
                  <h3 className="pixel-text text-xl md:text-2xl mb-4">WITHOUT SUI2SCRAPE</h3>
                  <ul className="space-y-4">
                    {[              
                      "No way to monetize content accessed by bots and crawlers",
                      "Your research and APIs become free training data for AI models",
                      "Zero control over who accesses your content or how often",
                      "Content theft with no recourse or attribution",
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-3 text-foreground">
                        <div className="w-1.5 h-1.5 rounded-full bg-black mt-2 flex-shrink-0" />
                        <span className="text-base leading-relaxed font-mono">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
          </Card>

              {/* With scrape2sui */}
              <Card className="relative overflow-hidden bg-black border-2 border-black text-white">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gray-400" />
                <div className="p-8">
                  <div className="w-12 h-12 border-2 border-gray-400 bg-black flex items-center justify-center mb-6">
                    <Check className="w-7 h-7 text-gray-400" />
                  </div>
                  <h3 className="pixel-text text-xl md:text-2xl mb-4 text-white">WITH SUI2SCRAPE</h3>
                  <ul className="space-y-4">
                    {[
                      "Pay-before-access enforcement via x402",
                      "On-chain payment verification with AccessPass",
                      "Configurable usage limits and rate control",
                      "End-to-end content encryption via Seal",
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-3 text-gray-200">
                        <Check className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                        <span className="text-base leading-relaxed font-mono">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 md:py-32 bg-gray-50">
        <div className="container mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="pixel-text text-4xl md:text-5xl lg:text-6xl mb-6 text-balance leading-tight">HOW IT WORKS</h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto text-pretty leading-relaxed">
              A seamless end-to-end flow from content upload to AI agent payment
            </p>
          </div>

          {/* System Architecture Diagram with Steps */}
          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-[1.3fr_1fr] gap-8 lg:gap-12 items-start">
              {/* Architecture Image */}
              <div className="lg:sticky lg:top-24">
                <Card className="p-4 md:p-6 bg-white border-2 border-black">
                  <h3 className="pixel-text text-xl md:text-2xl mb-4 md:mb-6 text-center">SYSTEM ARCHITECTURE</h3>
                  <div className="relative w-full overflow-hidden">
                    <Image
                      src="/architecture.png"
                      alt="Sui2Scrape System Architecture"
                      width={1400}
                      height={933}
                      className="w-full h-auto rounded-sm"
                      priority
                    />
                  </div>
                </Card>
              </div>

              {/* Steps List */}
              <div className="space-y-6 lg:space-y-8">
                {[
                  {
                    step: "01",
                    title: "Upload & Encrypt",
                    description:
                      "Content creator uploads premium content through the gateway. Automatically encrypted with Seal and stored on Walrus decentralized storage.",
                  },
                  {
                    step: "02",
                    title: "Integrate Middleware",
                    description:
                      "Install the npm package and protect your routes with the paywall() wrapper. Configure price, receiver address, and access rules in one line.",
                  },
                  {
                    step: "03",
                    title: "AI Agent Requests",
                    description:
                      "When an AI agent or bot tries to access protected content, they receive a 402 Payment Required response with payment instructions.",
                  },
                  {
                    step: "04",
                    title: "On-Chain Payment",
                    description:
                      "Agent pays via Sui smart contract. AccessPass is minted with usage limits, expiration, and metadata. Payment is verified on-chain.",
                  },
                  {
                    step: "05",
                    title: "Verify & Decrypt",
                    description:
                      "Gateway verifies the AccessPass, decrements usage counter, fetches encrypted content from Walrus, and Seal decrypts it.",
                  },
                  {
                    step: "06",
                    title: "Access Granted",
                    description:
                      "Decrypted content is returned to the AI agent. All transactions are logged on-chain for complete audit trail and analytics.",
                  },
                ].map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: "-50px" }}
                    transition={{ duration: 0.5, delay: i * 0.1 }}
                    className="flex gap-4 md:gap-6 items-start group"
                  >
                    <div className="flex-shrink-0 w-16 h-16 md:w-20 md:h-20 border-2 border-black bg-black text-white flex items-center justify-center font-bold text-lg md:text-2xl font-mono group-hover:bg-gray-900 group-hover:border-gray-500 transition-all duration-300 group-hover:scale-105">
                      {item.step}
                    </div>
                    <div className="flex-1 pt-1 md:pt-3">
                      <h3 className="pixel-text text-lg md:text-xl mb-2 md:mb-3">{item.title.toUpperCase()}</h3>
                      <p className="text-muted-foreground text-sm md:text-base leading-relaxed font-mono">{item.description}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Integration */}
      <section id="integration" className="py-20 md:py-32">
        <div className="container mx-auto px-6">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="pixel-text text-4xl md:text-5xl lg:text-6xl mb-6 text-balance leading-tight">
                INTEGRATE IN MINUTES, NOT DAYS
              </h2>
              <p className="text-base md:text-lg text-muted-foreground text-pretty max-w-2xl mx-auto leading-relaxed">
                Add AI payment enforcement to your existing application with minimal code changes
              </p>
            </div>

            <div className="space-y-8">
              {/* Step 1 */}
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 border-2 border-black bg-black text-white flex items-center justify-center text-sm font-bold font-mono">
                    1
                  </div>
                  <h3 className="pixel-text text-lg">INSTALL THE PACKAGE</h3>
                </div>
                <Card className="bg-black border-2 border-black overflow-hidden">
                  <div className="p-6">
                    <pre className="font-mono text-sm">
                      <code className="text-gray-400">npm install ai-paywall</code>
                    </pre>
                  </div>
                </Card>
              </div>

              {/* Step 2 */}
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 border-2 border-black bg-black text-white flex items-center justify-center text-sm font-bold font-mono">
                    2
                  </div>
                  <h3 className="pixel-text text-lg">ADD THE MIDDLEWARE TO YOUR ROUTES</h3>
                </div>
                <Card className="bg-black border-2 border-black overflow-hidden">
                  <div className="p-6">
                    <pre className="font-mono text-sm leading-relaxed">
                      <code>
                        <span className="text-gray-500">const</span>{" "}
                        <span className="text-gray-400">{"{"}</span> <span className="text-gray-300">paywall</span>{" "}
                        <span className="text-gray-400">{"}"}</span> <span className="text-gray-500">=</span>{" "}
                        <span className="text-gray-200">require</span>
                        <span className="text-gray-400">(</span>
                        <span className="text-gray-200">"ai-paywall"</span>
                        <span className="text-gray-400">);</span>
                        {"\n\n"}
                        <span className="text-gray-300">app</span>
                        <span className="text-gray-500">.</span>
                        <span className="text-gray-200">use</span>
                        <span className="text-gray-400">(</span>
                        <span className="text-gray-200">"/api/premium"</span>
                        <span className="text-gray-400">, </span>
                        <span className="text-gray-300">paywall</span>
                        <span className="text-gray-400">({"{"}</span>
                        {"\n  "}
                        <span className="text-gray-400">price: </span>
                        <span className="text-gray-200">"0.1"</span>
                        <span className="text-gray-400">,</span>
                        {"\n  "}
                        <span className="text-gray-400">receiver: </span>
                        <span className="text-gray-200">"0xYourSuiAddress"</span>
                        <span className="text-gray-400">,</span>
                        {"\n  "}
                        <span className="text-gray-400">domain: </span>
                        <span className="text-gray-200">"yoursite.com"</span>
                        <span className="text-gray-400">,</span>
                        {"\n  "}
                        <span className="text-gray-400">usageLimit: </span>
                        <span className="text-gray-300">100</span>
                        {"\n"}
                        <span className="text-gray-400">{"}));"}</span>
                      </code>
                    </pre>
                  </div>
                </Card>
              </div>

              {/* Step 3 */}
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 border-2 border-black bg-black text-white flex items-center justify-center text-sm font-bold font-mono">
                    3
                  </div>
                  <h3 className="pixel-text text-lg">THAT'S IT! YOUR CONTENT IS NOW PROTECTED</h3>
                </div>
                <Card className="bg-white border-2 border-black">
                  <div className="p-6">
                    <p className="text-foreground leading-relaxed font-mono">
                      AI agents will now receive payment instructions when they try to access your protected routes.
                      After successful payment, they'll receive an AccessPass and gain access to your premium
                      content.
                    </p>
                  </div>
          </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 md:py-32">
        <div className="container mx-auto px-6">
          <motion.div
            className="text-center mb-20"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <h2 className="pixel-text text-4xl md:text-5xl lg:text-6xl mb-6 text-balance leading-tight">
              EVERYTHING YOU NEED TO PROTECT & MONETIZE
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto text-pretty leading-relaxed">
              A complete solution for content creators, API providers, and data publishers
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {[
              {
                icon: Lock,
                title: "Encrypted Storage",
                description: "Content encrypted with Seal, stored on Walrus. Only paid users can decrypt and access.",
              },
              {
                icon: Coins,
                title: "On-Chain Payments",
                description:
                  "Immutable payment verification through Sui blockchain AccessPass with usage tracking.",
              },
              {
                icon: Code2,
                title: "NPM Middleware",
                description: "Simple one-line integration for any Node.js, Express, or Next.js application.",
              },
              {
                icon: Key,
                title: "x402 Protocol",
                description: 'Standard "402 Payment Required" flow designed specifically for AI agents and bots.',
              },
              {
                icon: Database,
                title: "Decentralized Storage",
                description: "Built on Walrus for reliable, censorship-resistant content delivery at scale.",
              },
              {
                icon: Shield,
                title: "Access Control",
                description: "Fine-grained permissions with time limits, usage caps, and domain restrictions.",
              },
              {
                icon: Zap,
                title: "Lightning Fast",
                description: "Optimized verification flow with sub-second payment confirmation and content delivery.",
              },
              {
                icon: Sparkles,
                title: "Web3 Native",
                description: "Fully decentralized infrastructure with no central authority or single point of failure.",
              },
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
              >
                <Card
                  className="p-6 bg-white border-2 border-black hover:border-gray-500 transition-all duration-300 hover:shadow-lg group"
                >
                <div className="w-12 h-12 border-2 border-black bg-white flex items-center justify-center mb-4 group-hover:bg-gray-100 transition-all">
                  <feature.icon className="w-6 h-6 text-black" />
                </div>
                <h3 className="pixel-text text-lg mb-2">{feature.title.toUpperCase()}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed font-mono">{feature.description}</p>
              </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech Stack */}
      <section className="py-20 md:py-32 bg-gray-50">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="pixel-text text-4xl md:text-5xl lg:text-6xl mb-6 text-balance leading-tight">
              POWERED BY SUI, WALRUS & SEAL
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto text-pretty leading-relaxed font-mono">
              Blockchain payments, decentralized storage, and encryption working together to protect your content
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              {
                logo: "/sui-logo.svg",
                title: "Sui Blockchain",
                description:
                  "Stores domain-to-content mappings and mints AccessPass objects when AI agents pay. Each AccessPass tracks usage limits and expiry, enabling pay-per-access enforcement.",
              },
              {
                logo: "/walrus-logo.png",
                title: "Walrus Storage",
                description:
                  "Holds encrypted premium content off-chain. When AccessPass is verified, the gateway fetches the encrypted blob from Walrus using the CID stored on Sui.",
              },
              {
                icon: Lock,
                title: "Seal Encryption",
                description:
                  "Encrypts content at upload and only releases decryption keys when a valid AccessPass exists. Without payment, content remains encrypted and unusable.",
              },
            ].map((tech, i) => (
              <Card
                key={i}
                className="p-8 bg-white border-2 border-black hover:border-gray-500 transition-all duration-300 group"
              >
                <div className="w-16 h-16 border-2 border-black bg-white flex items-center justify-center mb-6 group-hover:bg-gray-100 transition-all">
                  {tech.logo ? (
                    <Image
                      src={tech.logo}
                      alt={tech.title}
                      width={32}
                      height={32}
                      className="object-contain"
                    />
                  ) : tech.icon ? (
                    <tech.icon className="w-8 h-8 text-black" />
                  ) : null}
                </div>
                <h3 className="pixel-text text-xl md:text-2xl mb-4">{tech.title.toUpperCase()}</h3>
                <p className="text-muted-foreground leading-relaxed font-mono">{tech.description}</p>
          </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 md:py-32 relative overflow-hidden bg-black text-white">
        <div className="container mx-auto px-6 relative">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="pixel-text text-4xl md:text-5xl lg:text-6xl mb-6 text-balance leading-tight text-white">
              READY TO MONETIZE YOUR CONTENT?
            </h2>
            <p className="text-xl text-gray-300 mb-12 text-pretty max-w-2xl mx-auto leading-relaxed font-mono">
              Join the future of content protection and start earning from AI agents accessing your premium data.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button
                size="lg"
                className="pixel-text text-lg px-10 h-14 bg-white text-black border-2 border-white hover:bg-gray-200 hover:border-gray-400 transition-all group uppercase tracking-wider font-mono"
                asChild
              >
                <Link href="/registry">
                  GET STARTED NOW
                  <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="pixel-text text-lg px-10 h-14 bg-black text-white border-2 border-white hover:bg-gray-900 hover:border-gray-400 uppercase tracking-wider font-mono"
                asChild
              >
                <a href="https://github.com/technicalclipper/scrape2sui" target="_blank" rel="noopener noreferrer">
                  VIEW ON GITHUB
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t-2 border-black bg-white">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 border-2 border-black bg-white flex items-center justify-center overflow-hidden">
                <Image
                  src="/walrus-logo-main.png"
                  alt="sui2scrape logo"
                  width={40}
                  height={40}
                  className="object-contain"
                />
              </div>
              <span className="pixel-text text-xl font-bold">SUI2SCRAPE</span>
            </div>
            <p className="text-sm text-muted-foreground font-mono uppercase tracking-wider">
              © 2025 SUI2SCRAPE. POWERED BY SUI, WALRUS & SEAL. BUILT FOR THE AI ERA.
            </p>
        </div>
      </div>
      </footer>
    </div>
  )
}
