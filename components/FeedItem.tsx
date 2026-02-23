import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useUserStore } from '../store/useUserStore'
import { useHistoryStore } from '../store/useHistoryStore'
import { useAnalyticsStore } from '../store/useAnalyticsStore'
import { supabase } from '../supabase'
import { STAGGER_CONTAINER, STAGGER_ITEM } from '../motion'
import JellyLikeButton from './JellyLikeButton'
import JellyCommentButton from './JellyCommentButton'
import JellyFollowButton from './JellyFollowButton'

export interface FeedItemProps {
    post: any
    onOpenDiscussion: () => void
    isExiting: boolean
    onBack?: () => void
    isActive: boolean
    isNear?: boolean
    isReady?: boolean
    isLoading?: boolean
}

export const FeedItem: React.FC<FeedItemProps> = ({
    post,
    onOpenDiscussion,
    isExiting,
    onBack,
    isActive,
    isNear = true,
    isReady = true,
    isLoading = false,
}) => {
    const {
        toggleLike,
        isLiked: checkIsLiked,
        toggleFollowCommunity,
        isFollowing,
    } = useHistoryStore()
    const { logEvent } = useAnalyticsStore()

    const isLiked = checkIsLiked(post.id)
    const isSubscribed = post.community_id
        ? isFollowing(post.community_id)
        : false

    const initialLikes =
        typeof post.upvotes === 'number' ? post.upvotes : parseInt(post.likes) || 0
    const imageUrl = post.image_url || post.image || ''
    const videoUrl = post.video_url || post.videoUrl || null
    const titleEn = post.title_en || post.titleEn || ''
    const titleCn = post.title_cn || post.titleZh || ''
    const subreddit = post.subreddit || 'Community'
    const commentCount = post.comments || post.comment_count || 0

    const [likes, setLikes] = useState(initialLikes)
    const videoRef = useRef<HTMLVideoElement>(null)
    const [videoError, setVideoError] = useState(false)
    const [imageLoaded, setImageLoaded] = useState(false)
    const [imageError, setImageError] = useState(false)
    const [isSlowLoad, setIsSlowLoad] = useState(false)

    const hasVideo = !!videoUrl && !videoError

    const handleToggleSub = (e: React.MouseEvent) => {
        e.stopPropagation()
        if (post.community_id) {
            toggleFollowCommunity(post.community_id)
            if (navigator.vibrate) navigator.vibrate(50)
        }
    }

    useEffect(() => {
        let timeout: NodeJS.Timeout
        if (!hasVideo && isActive && !imageLoaded && !imageError) {
            timeout = setTimeout(() => {
                if (!imageLoaded) setIsSlowLoad(true)
            }, 30000)
        }
        return () => clearTimeout(timeout)
    }, [hasVideo, isActive, imageLoaded, imageError])

    const handleRetryImage = () => {
        setImageError(false)
        setIsSlowLoad(false)
        setImageLoaded(false)
    }

    useEffect(() => {
        if (hasVideo && videoRef.current && !isExiting) {
            const attemptPlay = async () => {
                try {
                    if (isActive) {
                        videoRef.current!.muted = true
                        await videoRef.current!.play()
                    } else {
                        videoRef.current!.pause()
                    }
                } catch (e) { }
            }
            attemptPlay()
        }
    }, [hasVideo, isExiting, isActive])

    const handleLike = async () => {
        if (isExiting) return
        toggleLike(post)
        if (navigator.vibrate) navigator.vibrate(50)
        logEvent({ post_id: post.id, interaction_type: 'click_like' })
        setLikes((prev) => (isLiked ? Math.max(0, prev - 1) : prev + 1))

        try {
            const newCount = isLiked
                ? initialLikes > 0
                    ? initialLikes - 1
                    : 0
                : initialLikes + 1
            await supabase
                .from('production_posts')
                .update({ upvotes: newCount })
                .eq('id', post.id)
        } catch (e) { }
    }

    const handleDiscussionClick = () => {
        logEvent({ post_id: post.id, interaction_type: 'click_discussion' })
        onOpenDiscussion()
    }
    const handleShare = async () => {
        logEvent({ post_id: post.id, interaction_type: 'click_share' })
        if (navigator.share)
            navigator.share({
                title: titleEn,
                text: titleCn,
                url: window.location.href,
            })
    }

    const CITRUS_SQUISH = {
        type: 'spring',
        stiffness: 600,
        damping: 15,
        mass: 1,
    }

    const DROPLET_SHAPE = '50% 50% 50% 50% / 60% 60% 43% 43%'

    return (
        <div className="h-full w-full bg-[#0B0A09] relative">
            <motion.div
                transition={{ type: 'spring', stiffness: 70, damping: 20 }}
                className="relative h-full w-full overflow-hidden bg-[#121212] z-[100]">
                {onBack && !isExiting && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            onBack()
                        }}
                        className="absolute top-12 left-5 z-[60] w-10 h-10 flex items-center justify-center bg-black/20 backdrop-blur-md rounded-full border border-white/10 text-white">
                        <span className="material-symbols-outlined text-[24px]">
                            arrow_back
                        </span>
                    </button>
                )}

                <div
                    className="absolute inset-0 h-full w-full overflow-hidden"
                    onClick={() => {
                        if (!isExiting && hasVideo && videoRef.current)
                            videoRef.current.paused
                                ? videoRef.current.play()
                                : videoRef.current.pause()
                    }}>
                    {isNear ? (
                        hasVideo ? (
                            <video
                                ref={videoRef}
                                src={videoUrl || ''}
                                className="h-full w-full object-cover"
                                style={{ objectPosition: 'center 35%' }}
                                loop
                                muted
                                playsInline
                                preload={isActive ? 'auto' : 'metadata'}
                                onError={() => setVideoError(true)}
                            />
                        ) : (
                            <>
                                <div
                                    className="absolute inset-0 bg-cover bg-center blur-3xl scale-125 opacity-80"
                                    style={{ backgroundImage: `url("${imageUrl}")` }}
                                />
                                <div className="absolute inset-0 bg-black/40 mix-blend-multiply" />

                                <AnimatePresence>
                                    {(!imageLoaded || imageError || isSlowLoad) && (
                                        <motion.div
                                            exit={{ opacity: 0 }}
                                            className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-gray-900/40 backdrop-blur-md px-10 text-center">
                                            {imageError ? (
                                                <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
                                                    <span className="material-symbols-outlined text-red-500 text-5xl mb-4 opacity-80">
                                                        broken_image
                                                    </span>
                                                    <p className="text-white/60 text-xs font-bold leading-relaxed mb-6">
                                                        Image Unavailable
                                                        <br />
                                                        <span className="text-[10px] opacity-50 font-medium">
                                                            Connection reset or timed out
                                                        </span>
                                                    </p>
                                                    <button
                                                        onClick={handleRetryImage}
                                                        className="px-6 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full text-white text-[10px] font-black uppercase tracking-widest transition-all active:scale-95">
                                                        Retry
                                                    </button>
                                                </div>
                                            ) : isSlowLoad ? (
                                                <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
                                                    <span className="material-symbols-outlined text-orange-500 text-5xl mb-4 opacity-80">
                                                        timer_slow
                                                    </span>
                                                    <p className="text-white/60 text-xs font-bold leading-relaxed mb-6">
                                                        Connection Slow
                                                        <br />
                                                        <span className="text-[10px] opacity-50 font-medium">
                                                            Taking longer than expected to load
                                                        </span>
                                                    </p>
                                                    <button
                                                        onClick={handleRetryImage}
                                                        className="px-6 py-2 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30 rounded-full text-orange-500 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-[0_0_15px_rgba(249,115,22,0.2)]">
                                                        Keep Waiting
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="relative w-12 h-12">
                                                    <div className="absolute inset-0 border-4 border-orange-500/20 rounded-full" />
                                                    <motion.div
                                                        animate={{ rotate: 360 }}
                                                        transition={{
                                                            duration: 1,
                                                            repeat: Infinity,
                                                            ease: 'linear',
                                                        }}
                                                        className="absolute inset-0 border-4 border-orange-500 border-t-transparent rounded-full"
                                                    />
                                                </div>
                                            )}
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <motion.img
                                    src={imageUrl}
                                    loading={isActive ? 'eager' : 'lazy'}
                                    onLoad={() => {
                                        setImageLoaded(true)
                                        setIsSlowLoad(false)
                                        setImageError(false)
                                    }}
                                    onError={() => {
                                        setImageError(true)
                                        setIsSlowLoad(false)
                                    }}
                                    className={`absolute inset-0 w-full h-full object-contain z-10 drop-shadow-2xl transition-opacity duration-500 ${imageLoaded && !imageError ? 'opacity-100' : 'opacity-0'}`}
                                    style={{ objectPosition: 'center 35%' }}
                                    transition={{ type: 'spring', stiffness: 70, damping: 20 }}
                                />
                            </>
                        )
                    ) : (
                        <div className="absolute inset-0 bg-[#0B0A09]" />
                    )}

                    <div
                        className={`absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/90 via-black/30 to-transparent pointer-events-none z-20 transition-opacity duration-300 ${isExiting ? 'opacity-0' : 'opacity-100'}`}
                    />
                </div>

                <div
                    className={`absolute inset-0 z-30 transition-all ${isExiting ? 'pointer-events-none' : ''}`}
                    onDoubleClick={handleLike}
                />

                <motion.div
                    key={`actions-${post.id}`}
                    variants={STAGGER_CONTAINER}
                    initial="initial"
                    animate={isReady && isActive && !isLoading ? 'animate' : 'initial'}
                    exit="exit"
                    inherit={false}
                    className="absolute inset-0 z-[120] pointer-events-none">
                    <div
                        className="absolute bottom-0 left-0 w-[85%] p-[clamp(1rem,3vh,1.5rem)] pb-[clamp(1rem,8vh,6rem)] flex flex-col items-start gap-[clamp(0.5rem,1.2vh,1rem)]"
                        style={{
                            paddingBottom:
                                'calc(max(1rem, env(safe-area-inset-bottom)) + clamp(3.5rem, 8vh, 5.5rem))',
                        }}>
                        <motion.div
                            variants={STAGGER_ITEM}
                            className="flex items-center gap-2.5 pointer-events-auto">
                            <div
                                className="w-[clamp(2.1rem,4.5vh,2.5rem)] h-[clamp(2.1rem,4.5vh,2.5rem)] border-2 border-orange-400/30 bg-black/60 backdrop-blur-xl flex items-center justify-center overflow-hidden shadow-lg relative"
                                style={{ borderRadius: DROPLET_SHAPE }}>
                                <div className="absolute top-1 right-1.5 w-3.5 h-2 bg-green-500/60 rounded-full rotate-[-35deg] blur-[0.3px] pointer-events-none" />
                                <span className="text-orange-400 font-black text-[clamp(14px,1.6vh,16px)]">
                                    {subreddit.substring(0, 1).toUpperCase()}
                                </span>
                            </div>
                            <div className="flex flex-col drop-shadow-xl">
                                <span className="text-white font-black text-[clamp(13px,1.4vh,15px)] leading-tight flex items-center gap-1.5">
                                    r/{subreddit}
                                    <AnimatePresence>
                                        {isSubscribed && (
                                            <motion.button
                                                initial={{ scale: 0, opacity: 0 }}
                                                animate={{ scale: 1, opacity: 1 }}
                                                exit={{
                                                    scale: 1.5,
                                                    opacity: 0,
                                                    transition: { duration: 0.2 },
                                                }}
                                                transition={{
                                                    type: 'spring',
                                                    damping: 10,
                                                    stiffness: 300,
                                                }}
                                                onClick={handleToggleSub}
                                                className="material-symbols-outlined text-[clamp(12px,1.2vh,14px)] fill-[1] text-orange-500 cursor-pointer active:scale-75 transition-transform">
                                                verified
                                            </motion.button>
                                        )}
                                    </AnimatePresence>
                                </span>
                                <div className="flex items-center gap-1 mt-0.5 opacity-60">
                                    <span className="text-white text-[clamp(8px,0.9vh,10px)] font-black uppercase tracking-widest">
                                        Active Community
                                    </span>
                                </div>
                            </div>
                        </motion.div>

                        <motion.div
                            variants={STAGGER_ITEM}
                            className="pointer-events-auto p-[clamp(0.75rem,2vh,1.51rem)] bg-black/60 backdrop-blur-3xl border-2 border-white/5 rounded-[clamp(1.5rem,3.5vh,2.5rem)] shadow-2xl relative overflow-hidden group max-w-[95%] select-none -webkit-touch-callout-none">
                            <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-orange-500/10 rounded-full blur-2xl group-hover:bg-orange-500/20 transition-all duration-700" />
                            <h1 className="text-white text-[clamp(16px,2vh,20px)] font-black leading-tight drop-shadow-2xl mb-1.5">
                                {titleEn}
                            </h1>
                            <p className="text-white/70 text-[clamp(13px,1.6vh,15px)] font-bold leading-relaxed line-clamp-2">
                                {titleCn}
                            </p>
                        </motion.div>
                    </div>

                    <motion.div
                        variants={STAGGER_ITEM}
                        className="absolute bottom-[clamp(4.5rem,8vh,6.5rem)] right-2 flex flex-col-reverse items-center gap-[clamp(0.75rem,1.8vh,1.5rem)] pointer-events-auto w-[clamp(3rem,8dvw,3.5rem)]"
                        style={{
                            bottom:
                                'calc(max(1rem, env(safe-area-inset-bottom)) + clamp(3.5rem, 8vh, 5.5rem))',
                        }}>
                        <div className="flex flex-col items-center gap-1">
                            <motion.button
                                whileHover={{ scale: 1.1, y: -2 }}
                                whileTap={{ scale: 0.9 }}
                                transition={CITRUS_SQUISH}
                                onClick={handleShare}
                                className="flex items-center justify-center transition-all overflow-hidden bg-transparent"
                                style={{
                                    borderRadius: DROPLET_SHAPE,
                                    width: 'clamp(2.5rem,5.5vh,3rem)',
                                    height: 'clamp(2.5rem,5.5vh,3rem)',
                                }}>
                                <span className="material-symbols-outlined text-[clamp(20px,2.5vh,24px)] text-white">
                                    sunny
                                </span>
                            </motion.button>
                            <span className="text-white/50 text-[clamp(8px,0.9vh,9px)] font-black tracking-[0.15em] uppercase drop-shadow-md">
                                Share
                            </span>
                        </div>

                        <JellyCommentButton
                            onClick={handleDiscussionClick}
                            label="Discuss"
                        />

                        <JellyLikeButton
                            isLiked={isLiked}
                            onClick={handleLike}
                            count={likes}
                        />

                        <JellyFollowButton
                            isFollowing={isSubscribed}
                            onClick={handleToggleSub}
                        />
                    </motion.div>
                </motion.div>
            </motion.div>
        </div>
    )
}

export default FeedItem
