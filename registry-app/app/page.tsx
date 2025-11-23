import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Shield, Lock, Zap, Code2, Coins, Database, Key, ArrowRight, Check, Sparkles } from "lucide-react"

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/40 backdrop-blur-xl bg-background/80">
        <div className="container mx-auto px-6 py-5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary via-accent to-secondary flex items-center justify-center shadow-lg shadow-primary/20 group-hover:shadow-primary/40 transition-all duration-300 overflow-hidden">
              <Image
                src="/walrus-logo-main.png"
                alt="sui2scrape logo"
                width={40}
                height={40}
                className="object-contain"
              />
            </div>
            <span className="text-2xl font-bold tracking-tight">sui2scrape</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8">
            <Link
              href="#features"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Features
            </Link>
            <Link
              href="#how-it-works"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              How it Works
            </Link>
            <Link
              href="#integration"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Integration
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
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20 px-4 py-2 rounded-full text-sm font-medium mb-8 backdrop-blur-sm">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-foreground">Powered by Sui, Walrus & Seal</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 leading-[1.1] text-balance tracking-tight">
              Make AI Agents{" "}
              <span className="bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">
                Pay to Scrape
              </span>
            </h1>

            {/* Subheadline */}
            <p className="text-lg md:text-xl text-muted-foreground mb-10 text-pretty max-w-2xl mx-auto leading-relaxed">
              Universal paywall system that enforces on-chain payments from bots and AI agents using the{" "}
              <span className="text-foreground font-medium">x402 payment protocol</span>
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
              <Button
                size="lg"
                className="text-lg px-10 h-14 shadow-xl shadow-primary/30 hover:shadow-primary/50 transition-all group"
                asChild
              >
                <Link href="#">
                  Install Package
                  <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="text-lg px-10 h-14 bg-background/50 backdrop-blur-sm border-border/50"
                asChild
              >
                <Link href="/registry">Register Now</Link>
              </Button>
            </div>

            {/* Code Preview */}
            <div className="max-w-3xl mx-auto">
              <Card className="bg-card/50 backdrop-blur-xl border border-border/50 shadow-2xl overflow-hidden">
                <div className="bg-muted/50 border-b border-border/50 px-6 py-3 flex items-center gap-2">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-destructive/60" />
                    <div className="w-3 h-3 rounded-full bg-accent/60" />
                    <div className="w-3 h-3 rounded-full bg-primary/60" />
                  </div>
                  <span className="text-sm text-muted-foreground ml-4 font-mono">middleware.js</span>
                </div>
                <div className="p-6 text-left">
                  <pre className="font-mono text-sm leading-relaxed">
                    <code>
                      <span className="text-muted-foreground">const</span>{" "}
                      <span className="text-foreground">{"{"}</span> <span className="text-accent">paywall</span>{" "}
                      <span className="text-foreground">{"}"}</span> <span className="text-muted-foreground">=</span>{" "}
                      <span className="text-primary">require</span>
                      <span className="text-foreground">(</span>
                      <span className="text-secondary">"ai-paywall"</span>
                      <span className="text-foreground">);</span>
                      {"\n\n"}
                      <span className="text-foreground">app</span>
                      <span className="text-muted-foreground">.</span>
                      <span className="text-primary">use</span>
                      <span className="text-foreground">(</span>
                      <span className="text-secondary">"/premium"</span>
                      <span className="text-foreground">, </span>
                      <span className="text-accent">paywall</span>
                      <span className="text-foreground">({"{"}</span>
                      {"\n  "}
                      <span className="text-foreground">price: </span>
                      <span className="text-secondary">"0.1"</span>
                      <span className="text-foreground">,</span>
                      {"\n  "}
                      <span className="text-foreground">receiver: </span>
                      <span className="text-secondary">"0xABC123"</span>
                      {"\n"}
                      <span className="text-foreground">{"}));"}</span>
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
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 text-balance leading-tight tracking-tight">
                AI is scraping your premium content{" "}
                <span className="bg-gradient-to-r from-destructive to-destructive/60 bg-clip-text text-transparent">
                  for free
                </span>
              </h2>
              <p className="text-base md:text-lg text-muted-foreground text-pretty max-w-2xl mx-auto leading-relaxed">
                Bots, crawlers, and AI agents are accessing your research, APIs, and datasets without permission or
                payment. There's no standard enforcement mechanism.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {/* Without scrape2sui */}
              <Card className="relative overflow-hidden bg-card border-destructive/20">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-destructive/50 to-destructive/20" />
                <div className="p-8">
                  <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center mb-6">
                    <span className="text-2xl">❌</span>
                  </div>
                  <h3 className="text-xl md:text-2xl font-semibold mb-4 tracking-tight">Without sui2scrape</h3>
                  <ul className="space-y-4">
                    {[              
                      "No way to monetize content accessed by bots and crawlers",
                      "Your research and APIs become free training data for AI models",
                      "Zero control over who accesses your content or how often",
                      "Content theft with no recourse or attribution",
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-3 text-muted-foreground">
                        <div className="w-1.5 h-1.5 rounded-full bg-destructive/60 mt-2 flex-shrink-0" />
                        <span className="text-base leading-relaxed">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Card>

              {/* With scrape2sui */}
              <Card className="relative overflow-hidden bg-gradient-to-br from-primary/5 to-accent/5 border-primary/30">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-accent" />
                <div className="p-8">
                  <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center mb-6">
                    <Check className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="text-xl md:text-2xl font-semibold mb-4 tracking-tight">With sui2scrape</h3>
                  <ul className="space-y-4">
                    {[
                      "Pay-before-access enforcement via x402",
                      "On-chain payment verification with AccessPass",
                      "Configurable usage limits and rate control",
                      "End-to-end content encryption via Seal",
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-3 text-muted-foreground">
                        <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                        <span className="text-base leading-relaxed">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 md:py-32">
        <div className="container mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 text-balance leading-tight tracking-tight">
              Everything you need to protect & monetize
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto text-pretty leading-relaxed">
              A complete solution for content creators, API providers, and data publishers
            </p>
          </div>

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
              <Card
                key={i}
                className="p-6 bg-card/50 backdrop-blur-sm border border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-xl hover:shadow-primary/5 group"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center mb-4 group-hover:from-primary/20 group-hover:to-accent/20 transition-all">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-bold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 md:py-32 bg-muted/30">
        <div className="container mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 text-balance leading-tight tracking-tight">How it works</h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto text-pretty leading-relaxed">
              A seamless end-to-end flow from content upload to AI agent payment
            </p>
          </div>

          {/* System Architecture Diagram */}
          <div className="max-w-6xl mx-auto mb-20">
            <Card className="p-8 md:p-12 bg-card/50 backdrop-blur-sm border border-border/50">
              <h3 className="text-2xl font-bold mb-8 text-center">System Architecture</h3>
              <div className="relative w-full">
                <Image
                  src="/architecture.png"
                  alt="Sui2Scrape System Architecture"
                  width={1200}
                  height={800}
                  className="w-full h-auto rounded-lg"
                  priority
                />
              </div>
            </Card>
          </div>

          <div className="max-w-4xl mx-auto space-y-12">
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
              <div key={i} className="flex gap-8 items-start group">
                <div className="flex-shrink-0 w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20 flex items-center justify-center font-bold text-2xl text-primary group-hover:from-primary/20 group-hover:to-accent/20 group-hover:border-primary/40 transition-all duration-300 group-hover:scale-105">
                  {item.step}
                </div>
                <div className="flex-1 pt-3">
                  <h3 className="text-xl md:text-2xl font-semibold mb-3 tracking-tight">{item.title}</h3>
                  <p className="text-muted-foreground text-lg leading-relaxed">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Integration */}
      <section id="integration" className="py-20 md:py-32">
        <div className="container mx-auto px-6">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 text-balance leading-tight tracking-tight">
                Integrate in minutes, not days
              </h2>
              <p className="text-base md:text-lg text-muted-foreground text-pretty max-w-2xl mx-auto leading-relaxed">
                Add AI payment enforcement to your existing application with minimal code changes
              </p>
            </div>

            <div className="space-y-8">
              {/* Step 1 */}
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
                    1
                  </div>
                  <h3 className="text-lg font-semibold">Install the package</h3>
                </div>
                <Card className="bg-muted/50 backdrop-blur-sm border border-border/50 overflow-hidden">
                  <div className="p-6">
                    <pre className="font-mono text-sm">
                      <code className="text-foreground">npm install ai-paywall</code>
                    </pre>
                  </div>
                </Card>
              </div>

              {/* Step 2 */}
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
                    2
                  </div>
                  <h3 className="text-lg font-semibold">Add the middleware to your routes</h3>
                </div>
                <Card className="bg-muted/50 backdrop-blur-sm border border-border/50 overflow-hidden">
                  <div className="p-6">
                    <pre className="font-mono text-sm leading-relaxed">
                      <code>
                        <span className="text-muted-foreground">const</span>{" "}
                        <span className="text-foreground">{"{"}</span> <span className="text-accent">paywall</span>{" "}
                        <span className="text-foreground">{"}"}</span> <span className="text-muted-foreground">=</span>{" "}
                        <span className="text-primary">require</span>
                        <span className="text-foreground">(</span>
                        <span className="text-secondary">"ai-paywall"</span>
                        <span className="text-foreground">);</span>
                        {"\n\n"}
                        <span className="text-foreground">app</span>
                        <span className="text-muted-foreground">.</span>
                        <span className="text-primary">use</span>
                        <span className="text-foreground">(</span>
                        <span className="text-secondary">"/api/premium"</span>
                        <span className="text-foreground">, </span>
                        <span className="text-accent">paywall</span>
                        <span className="text-foreground">({"{"}</span>
                        {"\n  "}
                        <span className="text-foreground">price: </span>
                        <span className="text-secondary">"0.1"</span>
                        <span className="text-foreground">,</span>
                        {"\n  "}
                        <span className="text-foreground">receiver: </span>
                        <span className="text-secondary">"0xYourSuiAddress"</span>
                        <span className="text-foreground">,</span>
                        {"\n  "}
                        <span className="text-foreground">domain: </span>
                        <span className="text-secondary">"yoursite.com"</span>
                        <span className="text-foreground">,</span>
                        {"\n  "}
                        <span className="text-foreground">usageLimit: </span>
                        <span className="text-accent">100</span>
                        {"\n"}
                        <span className="text-foreground">{"}));"}</span>
                      </code>
                    </pre>
                  </div>
                </Card>
              </div>

              {/* Step 3 */}
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
                    3
                  </div>
                  <h3 className="text-lg font-semibold">That's it! Your content is now protected</h3>
                </div>
                <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-primary/30">
                  <div className="p-6">
                    <p className="text-muted-foreground leading-relaxed">
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

      {/* Tech Stack */}
      <section className="py-20 md:py-32 bg-muted/30">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 text-balance leading-tight tracking-tight">
              Built on cutting-edge technology
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto text-pretty leading-relaxed">
              Three critical technologies working together to enforce AI payments
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
                className="p-8 bg-card/50 backdrop-blur-sm border border-border/50 hover:border-primary/50 transition-all duration-300 group"
              >
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center mb-6 group-hover:from-primary/20 group-hover:to-accent/20 transition-all">
                  {tech.logo ? (
                    <Image
                      src={tech.logo}
                      alt={tech.title}
                      width={32}
                      height={32}
                      className="object-contain"
                    />
                  ) : tech.icon ? (
                    <tech.icon className="w-8 h-8 text-primary" />
                  ) : null}
                </div>
                <h3 className="text-xl md:text-2xl font-semibold mb-4 tracking-tight">{tech.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{tech.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 md:py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-accent/5 to-background pointer-events-none" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/20 rounded-full blur-[140px] pointer-events-none" />

        <div className="container mx-auto px-6 relative">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 text-balance leading-tight tracking-tight">
              Ready to monetize your content?
            </h2>
            <p className="text-xl text-muted-foreground mb-12 text-pretty max-w-2xl mx-auto leading-relaxed">
              Join the future of content protection and start earning from AI agents accessing your premium data.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button
                size="lg"
                className="text-lg px-10 h-14 shadow-xl shadow-primary/30 hover:shadow-primary/50 transition-all group"
                asChild
              >
                <Link href="/registry">
                  Get Started Now
                  <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="text-lg px-10 h-14 bg-background/50 backdrop-blur-sm border-border/50"
                asChild
              >
                <a href="https://github.com/technicalclipper/scrape2sui" target="_blank" rel="noopener noreferrer">
                  View on GitHub
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border/40 bg-muted/30">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary via-accent to-secondary flex items-center justify-center overflow-hidden">
                <Image
                  src="/walrus-logo-main.png"
                  alt="sui2scrape logo"
                  width={40}
                  height={40}
                  className="object-contain"
                />
              </div>
              <span className="text-xl font-bold">sui2scrape</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2025 sui2scrape. Powered by Sui, Walrus & Seal. Built for the AI era.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
