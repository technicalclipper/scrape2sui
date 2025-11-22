"use client"

import * as React from "react"
import { useState } from "react"
import { Upload, Lock, Database, CheckCircle2, Loader2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { FileUpload } from "@/components/file-upload"

type ProcessStep = "idle" | "uploading" | "encrypting" | "storing" | "success" | "error"

interface RegistryResult {
  walrusCid: string
  sealPolicyId: string
  encrypted: boolean
  domain?: string
  resource?: string
  endEpoch?: string
  suiObjectId?: string
  fileName?: string
  fileSize?: number
}

export default function RegistryPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [domain, setDomain] = useState("")
  const [resource, setResource] = useState("")
  const [price, setPrice] = useState("0.1")
  const [processStep, setProcessStep] = useState<ProcessStep>("idle")
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<RegistryResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFileSelect = (file: File | null) => {
    setSelectedFile(file)
    setError(null)
    setResult(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedFile) {
      setError("Please select a file")
      return
    }

    if (!domain.trim()) {
      setError("Please enter a domain")
      return
    }

    if (!resource.trim()) {
      setError("Please enter a resource path")
      return
    }

    setError(null)
    setResult(null)
    setProcessStep("uploading")
    setProgress(10)

    try {
      // Step 1: Upload file
      const formData = new FormData()
      formData.append("file", selectedFile)
      formData.append("domain", domain)
      formData.append("resource", resource)
      formData.append("price", price)

      setProgress(30)

      // Step 2: Encrypt with Seal
      setProcessStep("encrypting")
      setProgress(50)

      // Step 3: Store to Walrus
      setProcessStep("storing")
      setProgress(80)

      const response = await fetch("/api/registry/register", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to register content")
      }

      const data = await response.json()
      setResult(data)
      setProgress(100)
      setProcessStep("success")
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      setProcessStep("error")
      setProgress(0)
    }
  }

  const resetForm = () => {
    setSelectedFile(null)
    setDomain("")
    setResource("")
    setPrice("0.1")
    setProcessStep("idle")
    setProgress(0)
    setResult(null)
    setError(null)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Content Registry</h1>
          <p className="text-muted-foreground">
            Encrypt your content with Seal and store it on Walrus
          </p>
        </div>

        {/* Main Form Card */}
        <Card>
          <CardHeader>
            <CardTitle>Register New Content</CardTitle>
            <CardDescription>
              Upload a file to encrypt and store. This content will be protected behind the paywall.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* File Upload */}
              <div className="space-y-2">
                <Label>File to Encrypt</Label>
                <FileUpload
                  onFileSelect={handleFileSelect}
                  selectedFile={selectedFile}
                  disabled={processStep !== "idle" && processStep !== "error"}
                />
              </div>

              {/* Domain Input */}
              <div className="space-y-2">
                <Label htmlFor="domain">Domain</Label>
                <Input
                  id="domain"
                  placeholder="www.example.com"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  disabled={processStep !== "idle" && processStep !== "error"}
                  required
                />
              </div>

              {/* Resource Input */}
              <div className="space-y-2">
                <Label htmlFor="resource">Resource Path</Label>
                <Input
                  id="resource"
                  placeholder="/hidden/content"
                  value={resource}
                  onChange={(e) => setResource(e.target.value)}
                  disabled={processStep !== "idle" && processStep !== "error"}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  The URL path where this content will be accessible
                </p>
              </div>

              {/* Price Input */}
              <div className="space-y-2">
                <Label htmlFor="price">Price (SUI)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.1"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  disabled={processStep !== "idle" && processStep !== "error"}
                  required
                />
              </div>

              {/* Progress Indicator */}
              {(processStep === "uploading" || processStep === "encrypting" || processStep === "storing") && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {processStep === "uploading" && "Uploading file..."}
                      {processStep === "encrypting" && "Encrypting with Seal..."}
                      {processStep === "storing" && "Storing to Walrus..."}
                    </span>
                    <span className="text-muted-foreground">{progress}%</span>
                  </div>
                  <Progress value={progress} />
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="flex items-center gap-2 p-4 rounded-md bg-destructive/10 text-destructive border border-destructive/20">
                  <AlertCircle className="h-5 w-5" />
                  <p className="text-sm">{error}</p>
                </div>
              )}

              {/* Success Result */}
              {result && processStep === "success" && (
                <Card className="border-primary/50 bg-primary/5">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                      Content Registered Successfully
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Walrus Blob ID</Label>
                        <p className="text-sm font-mono break-all">{result.walrusCid}</p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Seal Policy ID</Label>
                        <p className="text-sm font-mono break-all">{result.sealPolicyId}</p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Domain</Label>
                        <p className="text-sm">{result.domain}</p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Resource</Label>
                        <p className="text-sm">{result.resource}</p>
                      </div>
                      {result.suiObjectId && (
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Sui Object ID</Label>
                          <p className="text-sm font-mono break-all">{result.suiObjectId}</p>
                        </div>
                      )}
                      {result.endEpoch && (
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Storage End Epoch</Label>
                          <p className="text-sm">{result.endEpoch}</p>
                        </div>
                      )}
                    </div>
                    <Button type="button" onClick={resetForm} className="w-full">
                      Register Another File
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Submit Button */}
              {processStep !== "success" && (
                <Button
                  type="submit"
                  className="w-full"
                  disabled={
                    !selectedFile ||
                    !domain.trim() ||
                    !resource.trim() ||
                    processStep !== "idle" && processStep !== "error"
                  }
                >
                  {processStep === "idle" && (
                    <>
                      <Lock className="h-4 w-4 mr-2" />
                      Encrypt & Register
                    </>
                  )}
                  {(processStep === "uploading" || processStep === "encrypting" || processStep === "storing") && (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  )}
                  {processStep === "error" && "Try Again"}
                </Button>
              )}
            </form>
          </CardContent>
        </Card>

        {/* Info Cards */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Lock className="h-5 w-5" />
                Seal Encryption
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Your content is encrypted using Seal's key management system. Only authorized users with valid AccessPass can decrypt.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Database className="h-5 w-5" />
                Walrus Storage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Encrypted content is stored on Walrus decentralized storage. The CID is registered on-chain for access control.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

