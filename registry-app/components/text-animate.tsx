"use client"

import { motion } from "framer-motion"
import { useEffect, useState } from "react"

interface TextAnimateProps {
  text: string
  className?: string
  delay?: number
  duration?: number
}

export function TextAnimate({ text, className = "", delay = 0, duration = 0.5 }: TextAnimateProps) {
  const [displayedText, setDisplayedText] = useState("")
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setDisplayedText((prev) => prev + text[currentIndex])
        setCurrentIndex((prev) => prev + 1)
      }, delay * 1000 + (duration * 1000) / text.length)

      return () => clearTimeout(timeout)
    }
  }, [currentIndex, text, delay, duration])

  return (
    <motion.span
      className={className}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {displayedText}
    </motion.span>
  )
}

interface ShuffleTextProps {
  text: string
  className?: string
  duration?: number
}

export function ShuffleText({ text, className = "", duration = 0.05 }: ShuffleTextProps) {
  const [displayText, setDisplayText] = useState(text)
  const [isAnimating, setIsAnimating] = useState(false)

  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"

  const shuffle = () => {
    setIsAnimating(true)
    let iteration = 0
    const interval = setInterval(() => {
      setDisplayText(
        text
          .split("")
          .map((char, index) => {
            if (index < iteration) {
              return text[index]
            }
            return chars[Math.floor(Math.random() * chars.length)]
          })
          .join("")
      )

      if (iteration >= text.length) {
        clearInterval(interval)
        setIsAnimating(false)
      }

      iteration += 1 / 3
    }, duration * 1000)
  }

  return (
    <motion.span
      className={className}
      onHoverStart={shuffle}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {displayText}
    </motion.span>
  )
}

interface FadeInTextProps {
  children: React.ReactNode
  className?: string
  delay?: number
}

export function FadeInText({ children, className = "", delay = 0 }: FadeInTextProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}

