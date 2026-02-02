import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Page } from '../types';

import { supabase } from '../supabase';

interface LoginProps {
    onNavigate: (page: Page) => void;
    onLoginSuccess: (user: any) => void;
}

const Login: React.FC<LoginProps> = ({ onNavigate, onLoginSuccess }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // 简易内测登录逻辑：直接查询 user_profiles 表
            const { data, error: fetchError } = await supabase
                .from('user_profiles')
                .select('*')
                .eq('email', email)
                .eq('password', password)
                .maybeSingle();

            if (fetchError) throw fetchError;

            if (data) {
                onLoginSuccess(data);
            } else {
                setError('Invalid credentials or not an authorized beta user');
            }
        } catch (err: any) {
            setError(err.message || 'An error occurred during authentication');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-full w-full bg-white dark:bg-[#0B0A09] flex flex-col items-center justify-center p-6 overflow-y-auto">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-sm"
            >
                {/* Header */}
                <div className="mb-10 text-center">
                    <motion.div
                        whileHover={{ scale: 1.1 }}
                        className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-2xl mb-4"
                    >
                        <span className="material-symbols-outlined text-primary text-4xl font-black">
                            scrollable
                        </span>
                    </motion.div>
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-2 tracking-tight">
                        Scrollish
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                        Learning English by Scrolling
                    </p>
                </div>

                {/* Form Container */}
                <div className="bg-gray-50 dark:bg-white/5 p-8 rounded-[40px] shadow-sm border border-gray-100 dark:border-white/5">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <AnimatePresence mode="wait">
                            {!isLogin && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    key="username"
                                >
                                    <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5 ml-2">
                                        Username
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        className="w-full h-14 px-6 bg-white dark:bg-black/20 border border-transparent focus:border-primary/30 rounded-2xl outline-none transition-all dark:text-white font-medium shadow-sm"
                                        placeholder="Your name"
                                    />
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div>
                            <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5 ml-2">
                                Email Address
                            </label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full h-14 px-6 bg-white dark:bg-black/20 border border-transparent focus:border-primary/30 rounded-2xl outline-none transition-all dark:text-white font-medium shadow-sm"
                                placeholder="name@example.com"
                            />
                        </div>

                        <div className="relative">
                            <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1.5 ml-2">
                                Password
                            </label>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full h-14 px-6 bg-white dark:bg-black/20 border border-transparent focus:border-primary/30 rounded-2xl outline-none transition-all dark:text-white font-medium shadow-sm"
                                placeholder="••••••••"
                            />
                            <button type="button" className="absolute right-4 bottom-4 text-gray-400 active:text-primary">
                                <span className="material-symbols-outlined text-[20px]">
                                    visibility
                                </span>
                            </button>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full h-14 bg-primary text-white font-black rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-primary/30 mt-4 flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                'Sign In'
                            )}
                        </button>
                    </form>

                    {/* Social Login */}
                    <div className="relative py-6">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-100 dark:border-white/10"></div>
                        </div>
                        <div className="relative flex justify-center text-[10px] font-black uppercase text-gray-400">
                            <span className="bg-gray-50 dark:bg-[#1C1C1E] px-4 rounded-full">Or continue with</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <button className="h-12 border border-gray-100 dark:border-white/10 bg-white dark:bg-transparent rounded-2xl flex items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-white/5 transition-all active:scale-95">
                            <span className="material-symbols-outlined text-[18px] text-[#07C160]">chat</span>
                            <span className="text-xs font-bold dark:text-white">WeChat</span>
                        </button>
                        <button className="h-12 border border-gray-100 dark:border-white/10 bg-white dark:bg-transparent rounded-2xl flex items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-white/5 transition-all active:scale-95">
                            <span className="material-symbols-outlined text-[18px] text-[#12B7F5]">chat_bubble</span>
                            <span className="text-xs font-bold dark:text-white">QQ</span>
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-8 text-center pb-6">
                    <p className="text-xs text-gray-500 font-medium">
                        Don't have an account?
                        <button
                            type="button"
                            onClick={() => { }} // 设为无反应
                            className="text-primary font-black hover:underline underline-offset-4 ml-1 cursor-default"
                        >
                            Create Account
                        </button>
                    </p>
                </div>

                {error && (
                    <div className="text-red-500 text-xs font-bold px-2 animate-pulse mt-4 text-center">
                        {error}
                    </div>
                )}
            </motion.div>
        </div>
    );
};

export default Login;
