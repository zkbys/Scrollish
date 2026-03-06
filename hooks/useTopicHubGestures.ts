import React, { useRef } from 'react'

interface GestureOptions {
    onNext: () => void
    onPrev: () => void
    onDiscussion: () => void
    isOpCard: boolean
    isCardAtBottom: boolean
    contentRef: React.RefObject<HTMLDivElement>
}

export const useTopicHubGestures = ({
    onNext,
    onPrev,
    onDiscussion,
    isOpCard,
    isCardAtBottom,
    contentRef,
}: GestureOptions) => {
    const startPos = useRef({ x: 0, y: 0 })
    const touchStartTime = useRef(0)

    const handleTouchStart = (e: React.TouchEvent) => {
        const target = e.target as HTMLElement
        if (target.closest('.cursor-pointer, button, [role="button"]')) {
            startPos.current = { x: -1, y: -1 }
            return
        }

        startPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
        touchStartTime.current = Date.now()
    }

    const handleTouchEnd = (e: React.TouchEvent) => {
        if (startPos.current.x === -1) return

        const diffX = e.changedTouches[0].clientX - startPos.current.x
        const diffY = e.changedTouches[0].clientY - startPos.current.y
        const touchDuration = Date.now() - touchStartTime.current

        if (touchDuration > 1000) return
        if (Math.abs(diffX) < 70 && Math.abs(diffY) < 70) return

        if (Math.abs(diffX) > Math.abs(diffY)) {
            if (Math.abs(diffX) > 70) diffX < 0 ? onNext() : onPrev()
        } else {
            if (diffY < -70 && !isOpCard) {
                if (
                    isCardAtBottom ||
                    (contentRef.current &&
                        contentRef.current.scrollHeight <= contentRef.current.clientHeight)
                ) {
                    onDiscussion()
                }
            }
        }

        startPos.current = { x: -1, y: -1 }
    }

    return { handleTouchStart, handleTouchEnd }
}
