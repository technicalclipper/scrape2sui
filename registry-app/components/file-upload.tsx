"use client"

import * as React from "react"
import { Upload, File, X, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface FileUploadProps {
  onFileSelect: (file: File) => void
  selectedFile: File | null
  disabled?: boolean
}

export function FileUpload({ onFileSelect, selectedFile, disabled }: FileUploadProps) {
  const [isDragging, setIsDragging] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    if (disabled) return
    
    const file = e.dataTransfer.files[0]
    if (file) {
      onFileSelect(file)
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onFileSelect(file)
    }
  }

  const handleClick = () => {
    if (!disabled) {
      fileInputRef.current?.click()
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i]
  }

  return (
    <div className="w-full">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileInput}
        disabled={disabled}
      />
      
      <Card
        className={cn(
          "border-2 border-dashed transition-colors cursor-pointer",
          isDragging && "border-primary bg-accent",
          selectedFile && "border-primary",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <CardContent className="flex flex-col items-center justify-center p-12">
          {selectedFile ? (
            <>
              <CheckCircle2 className="h-12 w-12 text-primary mb-4" />
              <div className="text-center">
                <p className="text-sm font-medium mb-1">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(selectedFile.size)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="mt-4"
                onClick={(e) => {
                  e.stopPropagation()
                  onFileSelect(null as any)
                }}
                disabled={disabled}
              >
                <X className="h-4 w-4 mr-2" />
                Remove
              </Button>
            </>
          ) : (
            <>
              <Upload className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm font-medium mb-1">
                Click to upload or drag and drop
              </p>
              <p className="text-xs text-muted-foreground">
                Select a file to encrypt and store
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

