import React from 'react'
import { motion } from 'framer-motion'
import { Comment } from '../types'

interface MessageContextMenuProps {
    x: number
    y: number
    msg: Comment
    isExpanded: boolean
    onClose: () => void
    onQuote: (msg: Comment) => void
    onToggleTranslation: (msgId: string) => void
    onCopy: (text: string) => void
    onBookmark: (msg: Comment) => void
    onDelete?: (msgId: string) => void
}

const MessageContextMenu: React.FC<MessageContextMenuProps> = ({
    x,
    y,
    msg,
    isExpanded,
    onClose,
    onQuote,
    onToggleTranslation,
    onCopy,
    onBookmark,
    onDelete,
}) => {
    return (
        <>
            <div className="fixed inset-0 z-[100]" onClick={onClose} />
            <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                className="fixed z-[101] bg-white dark:bg-[#1C1C1E] border border-white/10 rounded-xl shadow-2xl p-1 min-w-[150px]"
                style={{
                    left: Math.min(x, window.innerWidth - 190),
                    top: Math.min(y, window.innerHeight - 240),
                }}>
                <button
                    onClick={() => onQuote(msg)}
                    className="menu-item text-orange-500">
                    <span className="material-symbols-outlined text-sm">format_quote</span>{' '}
                    Quote
                </button>
                <button
                    onClick={() => onToggleTranslation(msg.id)}
                    className="menu-item dark:text-white">
                    <span className="material-symbols-outlined text-sm">translate</span>{' '}
                    {isExpanded ? 'Hide' : 'Translate'}
                </button>
                <button
                    onClick={() => onCopy(msg.content)}
                    className="menu-item dark:text-white">
                    <span className="material-symbols-outlined text-sm">content_copy</span>{' '}
                    Copy
                </button>
                <button
                    onClick={() => onBookmark(msg)}
                    className="menu-item dark:text-white">
                    <span className="material-symbols-outlined text-sm">bookmark</span>{' '}
                    Bookmark
                </button>
                {msg.isLocal && onDelete && (
                    <button
                        onClick={() => onDelete(msg.id)}
                        className="menu-item text-red-500">
                        <span className="material-symbols-outlined text-sm">delete</span>{' '}
                        Delete
                    </button>
                )}
            </motion.div>
        </>
    )
}

export default MessageContextMenu
