import { Variants, Transition } from 'framer-motion';

/**
 * 物理特性定义
 */
export const SPRING_GENTLE: Transition = {
    type: "spring",
    stiffness: 260,
    damping: 30,
};

export const SPRING_SNAPPY: Transition = {
    type: "spring",
    stiffness: 500,
    damping: 30,
    mass: 1,
};

export const SPRING_BOUNCY: Transition = {
    type: "spring",
    stiffness: 400,
    damping: 10,
};

/**
 * 全局页面转场变体
 */
export const PAGE_VARIANTS: Variants = {
    initial: {
        opacity: 0,
    },
    animate: {
        opacity: 1,
        transition: {
            duration: 0.2,
            ease: "easeOut"
        },
    },
    exit: {
        opacity: 0,
        transition: {
            duration: 0.15,
            ease: "easeIn"
        },
    },
};

/**
 * 列表/层级流动变体
 */
export const STAGGER_CONTAINER: Variants = {
    initial: { opacity: 0 },
    animate: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1,
            delayChildren: 0.4,
        },
    },
    exit: { opacity: 0 }
};

export const STAGGER_ITEM: Variants = {
    initial: { opacity: 0, y: 50 },
    animate: {
        opacity: 1,
        y: 0,
        transition: SPRING_GENTLE,
    },
    exit: { opacity: 0, y: 20, transition: { duration: 0.2 } },
};

/**
 * 交互反馈变体
 */
export const TAP_SCALE = {
    whileHover: { scale: 1.02 },
    whileTap: { scale: 0.98 },
};

export const BUTTON_SPRING = {
    whileHover: { scale: 1.05 },
    whileTap: { scale: 0.95 },
    transition: SPRING_SNAPPY,
};
