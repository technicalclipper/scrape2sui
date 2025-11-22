import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Lock, Database, Shield, ArrowRight } from "lucide-react"

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center space-y-6 mb-16">
          <h1 className="text-5xl font-bold tracking-tight">
            AI Paywall Registry
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Protect your premium content with blockchain-based access control.
            Encrypt with Seal, store on Walrus, and register on Sui.
          </p>
          <div className="flex gap-4 justify-center">
            <Button asChild size="lg">
              <Link href="/registry">
                Register Content
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
          <Card>
            <CardHeader>
              <Lock className="h-8 w-8 mb-2 text-primary" />
              <CardTitle>Seal Encryption</CardTitle>
              <CardDescription>
                Your content is encrypted using Seal's advanced key management system
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <Database className="h-8 w-8 mb-2 text-primary" />
              <CardTitle>Walrus Storage</CardTitle>
              <CardDescription>
                Encrypted content is stored on decentralized Walrus storage network
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <Shield className="h-8 w-8 mb-2 text-primary" />
              <CardTitle>Sui Blockchain</CardTitle>
              <CardDescription>
                Access control and payment verification on Sui blockchain
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    </div>
  )
}
