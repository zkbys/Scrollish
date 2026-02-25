import React from 'react';
import { motion } from 'framer-motion';
import { IMAGES, getAssetPath } from '../../constants';

interface ProfileIdentityProps {
    profile: any;
    userLevel: number;
}

const STAGGER_ITEM = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 }
};

export const ProfileIdentity: React.FC<ProfileIdentityProps> = ({ profile, userLevel }) => {
    return (
        <motion.div variants={STAGGER_ITEM} className="flex p-4 flex-col items-center mt-2 max-w-lg mx-auto">
            <div className="relative">
                <div className="p-1 rounded-full bg-gradient-to-tr from-yellow-400 via-orange-500 to-red-600 shadow-xl ring-4 ring-white/30 dark:ring-white/5">
                    <div
                        className="bg-center bg-no-repeat aspect-square bg-cover rounded-full h-[clamp(4.5rem,11vh,6.5rem)] w-[clamp(4.5rem,11vh,6.5rem)] border-[3px] border-white dark:border-[#1C1C1E] shadow-inner"
                        style={{ backgroundImage: `url("${getAssetPath(IMAGES.avatarProfile)}")` }}>
                    </div>
                </div>
                <div className="absolute -bottom-1 -right-1 bg-orange-500 text-white text-[clamp(8px,1.2vh,10px)] font-black px-[clamp(0.4rem,1vh,0.6rem)] py-[clamp(0.2rem,0.4vh,0.3rem)] rounded-full border-2 border-white dark:border-[#1C1C1E] shadow-lg">
                    LV {userLevel}
                </div>
            </div>

            <div className="flex flex-col items-center mt-[clamp(0.75rem,2vh,1.25rem)] gap-1.5">
                <div className="flex items-center gap-2">
                    <p className="text-gray-900 dark:text-white text-[clamp(18px,2.8vh,24px)] font-black tracking-tight">{profile?.display_name || 'My Space'}</p>
                    <span className="material-symbols-outlined text-orange-500 text-[clamp(16px,2.2vh,20px)]" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                </div>
                <div className="flex items-center gap-1.5 glass-card-premium px-3 py-1 border-white/80 dark:border-white/10">
                    <span className="material-symbols-outlined text-orange-500 text-[clamp(11px,1.4vh,14px)]" style={{ fontVariationSettings: "'FILL' 1" }}>stars</span>
                    <p className="text-orange-600 dark:text-orange-400 text-[clamp(8px,1.1vh,10px)] font-extrabold uppercase tracking-widest">Premium Member</p>
                </div>
            </div>
        </motion.div>
    );
};
