import { useState, useCallback, useRef, useEffect } from 'react'
import { Page } from '../types'
import { useAppStore } from '../store/useAppStore'

/**
 * Defines the rank of each page for transition animations.
 */
export const getPageRank = (page: Page) => {
    switch (page) {
        case Page.Home:
            return 0
        case Page.Explore:
            return 1
        case Page.Study:
            return 2
        case Page.Profile:
            return 3
        case Page.CommunityDetail:
            return 4
        case Page.Login:
            return -1
        default:
            return 0
    }
}

/**
 * Hook to manage application routing and navigation state.
 */
export const useRouter = () => {
    const [currentPage, setCurrentPage] = useState<Page>(Page.Home)
    const [lastPage, setLastPage] = useState<Page>(Page.Home)
    const [originPage, setOriginPage] = useState<Page>(Page.Home)
    const [transitionDirection, setTransitionDirection] = useState(1)

    const currentPageRef = useRef(currentPage)
    useEffect(() => {
        currentPageRef.current = currentPage
    }, [currentPage])

    const navigateTo = useCallback((nextPage: Page) => {
        if (currentPageRef.current === nextPage) {
            if (nextPage === Page.Home) {
                const { refreshFeed } = useAppStore.getState()
                refreshFeed()
            }
            return
        }

        // Save scroll position when leaving Home
        if (currentPageRef.current === Page.Home && nextPage !== Page.Home) {
            useAppStore.getState().saveCurrentPosition()
        }

        // Restore scroll position when returning to Home
        if (nextPage === Page.Home && currentPageRef.current !== Page.Home) {
            const store = useAppStore.getState()
            store.setIsRestoring(true)
            store.restoreSavedPosition()
            setTimeout(() => {
                useAppStore.getState().setIsRestoring(false)
            }, 200)
        }

        const oldRank = getPageRank(currentPageRef.current)
        const newRank = getPageRank(nextPage)

        setTransitionDirection(newRank >= oldRank ? 1 : -1)
        setLastPage(currentPageRef.current)

        const mainTabPages = [Page.Home, Page.Explore, Page.Study, Page.Profile]
        if (mainTabPages.includes(nextPage)) {
            setOriginPage(nextPage)
        }
        setCurrentPage(nextPage)
    }, [])

    return {
        currentPage,
        lastPage,
        originPage,
        transitionDirection,
        setCurrentPage,
        setLastPage,
        setOriginPage,
        setTransitionDirection,
        navigateTo,
        currentPageRef,
    }
}
