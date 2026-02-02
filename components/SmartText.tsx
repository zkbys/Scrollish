import React, { useState } from 'react'
import { useDictionaryStore } from '../store/useDictionaryStore'

interface SmartTextProps {
    content: string
    onWordClick?: (word: string, isVip: boolean) => void
}

/**
 * SmartText Component
 * Tokenizes text and highlights words from the active dictionary
 */
const SmartText: React.FC<SmartTextProps> = ({ content, onWordClick }) => {
    const { highlightSet } = useDictionaryStore()

    // Tokenize text into words and non-words (punctuation, spaces)
    const tokenize = (text: string): { text: string; isWord: boolean }[] => {
        // Match words (letters, numbers, apostrophes, hyphens)
        const regex = /([a-zA-Z0-9'-]+)/g
        const tokens: { text: string; isWord: boolean }[] = []
        let lastIndex = 0

        text.replace(regex, (match, p1, offset) => {
            // Add non-word content before this word
            if (offset > lastIndex) {
                tokens.push({ text: text.slice(lastIndex, offset), isWord: false })
            }
            // Add the word
            tokens.push({ text: match, isWord: true })
            lastIndex = offset + match.length
            return match
        })

        // Add remaining non-word content
        if (lastIndex < text.length) {
            tokens.push({ text: text.slice(lastIndex), isWord: false })
        }

        return tokens
    }

    const tokens = tokenize(content)

    const handleWordClick = (word: string, isVip: boolean) => {
        if (onWordClick) {
            onWordClick(word, isVip)
        }
    }

    return (
        <span className="smart-text">
            {tokens.map((token, index) => {
                if (!token.isWord) {
                    return <span key={index}>{token.text}</span>
                }

                const isVip = highlightSet.has(token.text.toLowerCase())

                return (
                    <span
                        key={index}
                        onClick={() => handleWordClick(token.text, isVip)}
                        className={`
              ${isVip ? 'vip-word' : 'normal-word'}
              cursor-pointer transition-all duration-150
            `}
                        style={
                            isVip
                                ? {
                                    background: 'linear-gradient(to right, rgba(251, 146, 60, 0.15), rgba(251, 146, 60, 0.05))',
                                    borderBottom: '2px solid rgba(251, 146, 60, 0.5)',
                                    borderRadius: '2px',
                                    padding: '0 2px',
                                }
                                : {}
                        }>
                        {token.text}
                    </span>
                )
            })}
        </span>
    )
}

export default SmartText
