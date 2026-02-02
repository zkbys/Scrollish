/**
 * Seed Dictionary Data
 * This script populates the database with sample dictionary data for testing
 */

import { supabase } from '../supabase'

export const seedDictionaryData = async () => {
    console.log('🌱 Starting dictionary data seeding...')

    try {
        // Step 1: Create a test dictionary
        const { data: dictionary, error: dictError } = await supabase
            .from('dictionaries')
            .insert({
                name: 'CET-4 Core Vocabulary (Demo)',
                description: 'Common words for testing the smart dictionary feature',
                type: 'system',
                is_public: true,
            })
            .select()
            .single()

        if (dictError) {
            console.error('❌ Failed to create dictionary:', dictError)
            return
        }

        console.log('✅ Created dictionary:', dictionary.name)

        // Step 2: Insert sample words
        const sampleWords = [
            {
                word: 'community',
                definition: 'n. 社区；团体；共同体',
                detail: {
                    phonetic: 'kəˈmjuːnəti',
                    examples: [
                        {
                            en: 'The local community came together to support the charity.',
                            zh: '当地社区团结起来支持这项慈善事业。',
                        },
                        {
                            en: 'Online communities have become increasingly important.',
                            zh: '在线社区变得越来越重要。',
                        },
                    ],
                },
            },
            {
                word: 'discussion',
                definition: 'n. 讨论；商讨',
                detail: {
                    phonetic: 'dɪˈskʌʃn',
                    examples: [
                        {
                            en: 'We had a lengthy discussion about the project.',
                            zh: '我们就这个项目进行了长时间的讨论。',
                        },
                    ],
                },
            },
            {
                word: 'reply',
                definition: 'v./n. 回复；答复',
                detail: {
                    phonetic: 'rɪˈplaɪ',
                    examples: [
                        {
                            en: 'Please reply to my email as soon as possible.',
                            zh: '请尽快回复我的邮件。',
                        },
                    ],
                },
            },
            {
                word: 'message',
                definition: 'n. 消息；信息',
                detail: {
                    phonetic: 'ˈmesɪdʒ',
                    examples: [
                        {
                            en: 'I received your message this morning.',
                            zh: '我今天早上收到了你的消息。',
                        },
                    ],
                },
            },
            {
                word: 'thread',
                definition: 'n. 线索；话题；帖子串',
                detail: {
                    phonetic: 'θred',
                    examples: [
                        {
                            en: 'This thread has over 100 replies.',
                            zh: '这个帖子有超过100条回复。',
                        },
                    ],
                },
            },
            {
                word: 'context',
                definition: 'n. 上下文；语境；背景',
                detail: {
                    phonetic: 'ˈkɒntekst',
                    examples: [
                        {
                            en: 'You need to understand the context to get the joke.',
                            zh: '你需要理解语境才能明白这个笑话。',
                        },
                    ],
                },
            },
            {
                word: 'explore',
                definition: 'v. 探索；探讨',
                detail: {
                    phonetic: 'ɪkˈsplɔː',
                    examples: [
                        {
                            en: 'Let\'s explore new possibilities together.',
                            zh: '让我们一起探索新的可能性。',
                        },
                    ],
                },
            },
            {
                word: 'profile',
                definition: 'n. 简介；档案；轮廓',
                detail: {
                    phonetic: 'ˈprəʊfaɪl',
                    examples: [
                        {
                            en: 'Update your profile to include your latest achievements.',
                            zh: '更新你的个人资料以包含最新成就。',
                        },
                    ],
                },
            },
            {
                word: 'trending',
                definition: 'adj. 流行的；趋势的',
                detail: {
                    phonetic: 'ˈtrendɪŋ',
                    examples: [
                        {
                            en: 'This topic is trending on social media.',
                            zh: '这个话题在社交媒体上很流行。',
                        },
                    ],
                },
            },
            {
                word: 'awesome',
                definition: 'adj. 令人惊叹的；很棒的',
                detail: {
                    phonetic: 'ˈɔːsəm',
                    examples: [
                        {
                            en: 'That was an awesome performance!',
                            zh: '那是一场精彩的表演！',
                        },
                    ],
                },
            },
        ]

        const entries = sampleWords.map((word) => ({
            dictionary_id: dictionary.id,
            ...word,
        }))

        const { error: entriesError } = await supabase
            .from('dictionary_entries')
            .insert(entries)

        if (entriesError) {
            console.error('❌ Failed to insert words:', entriesError)
            return
        }

        console.log(`✅ Inserted ${sampleWords.length} words`)
        console.log('🎉 Dictionary seeding completed successfully!')

        return dictionary.id
    } catch (error) {
        console.error('❌ Seeding failed:', error)
    }
}
