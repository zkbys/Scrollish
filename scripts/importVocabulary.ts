/**
 * Import English Vocabulary from KyleBing's Repository
 * GitHub: https://github.com/KyleBing/english-vocabulary
 * 
 * This script downloads and imports vocabulary data for:
 * - CET4 (四级)
 * - CET6 (六级)
 * - 考研 (Postgraduate)
 * - SAT
 * - TOEFL
 * - IELTS
 */

import { supabase } from '../supabase'

interface VocabularyWord {
    word: string
    translations: Array<{
        translation: string
        type: string
    }>
    phrases?: Array<{
        phrase: string
        translation: string
    }>
}

// Dictionary configurations
const DICTIONARIES = [
    {
        name: 'CET-4 Core Vocabulary',
        description: '大学英语四级核心词汇 (约2500词)',
        url: 'https://raw.githubusercontent.com/KyleBing/english-vocabulary/master/json/CET4_T.json',
        type: 'system' as const,
    },
    {
        name: 'CET-6 Core Vocabulary',
        description: '大学英语六级核心词汇 (约2000词)',
        url: 'https://raw.githubusercontent.com/KyleBing/english-vocabulary/master/json/CET6_T.json',
        type: 'system' as const,
    },
    {
        name: 'Postgraduate Entrance Exam',
        description: '考研英语核心词汇 (约5500词)',
        url: 'https://raw.githubusercontent.com/KyleBing/english-vocabulary/master/json/KaoYan_T.json',
        type: 'system' as const,
    },
    {
        name: 'TOEFL Vocabulary',
        description: '托福核心词汇',
        url: 'https://raw.githubusercontent.com/KyleBing/english-vocabulary/master/json/TOEFL_T.json',
        type: 'system' as const,
    },
    {
        name: 'IELTS Vocabulary',
        description: '雅思核心词汇',
        url: 'https://raw.githubusercontent.com/KyleBing/english-vocabulary/master/json/IELTS_T.json',
        type: 'system' as const,
    },
    {
        name: 'SAT Vocabulary',
        description: 'SAT考试核心词汇',
        url: 'https://raw.githubusercontent.com/KyleBing/english-vocabulary/master/json/SAT_T.json',
        type: 'system' as const,
    },
]

async function fetchVocabularyData(url: string): Promise<VocabularyWord[]> {
    console.log(`📥 Fetching data from: ${url}`)

    try {
        const response = await fetch(url)
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
        }
        const data = await response.json()
        return data
    } catch (error) {
        console.error(`❌ Failed to fetch from ${url}:`, error)
        return []
    }
}

function formatDefinition(translations: VocabularyWord['translations']): string {
    return translations
        .map(t => `${t.type}. ${t.translation}`)
        .join('；')
}

function formatExamples(phrases?: VocabularyWord['phrases']) {
    if (!phrases || phrases.length === 0) return []

    // Take first 3 phrases as examples
    return phrases.slice(0, 3).map(p => ({
        en: p.phrase,
        zh: p.translation,
    }))
}

export async function importVocabularyDictionaries(
    dictionariesToImport: string[] = ['CET-4', 'CET-6', 'Postgraduate']
) {
    console.log('🚀 Starting vocabulary import...')
    console.log(`📚 Importing: ${dictionariesToImport.join(', ')}`)

    const results = {
        success: [] as string[],
        failed: [] as string[],
        totalWords: 0,
    }

    for (const dictConfig of DICTIONARIES) {
        // Check if this dictionary should be imported
        const shouldImport = dictionariesToImport.some(name =>
            dictConfig.name.includes(name)
        )

        if (!shouldImport) {
            console.log(`⏭️  Skipping: ${dictConfig.name}`)
            continue
        }

        console.log(`\n📖 Processing: ${dictConfig.name}`)

        try {
            // Step 1: Create dictionary entry
            const { data: dictionary, error: dictError } = await supabase
                .from('dictionaries')
                .insert({
                    name: dictConfig.name,
                    description: dictConfig.description,
                    type: dictConfig.type,
                    is_public: true,
                })
                .select()
                .single()

            if (dictError) {
                console.error(`❌ Failed to create dictionary:`, dictError)
                results.failed.push(dictConfig.name)
                continue
            }

            console.log(`✅ Created dictionary: ${dictionary.name}`)

            // Step 2: Fetch vocabulary data
            const words = await fetchVocabularyData(dictConfig.url)

            if (words.length === 0) {
                console.warn(`⚠️  No words fetched for ${dictConfig.name}`)
                results.failed.push(dictConfig.name)
                continue
            }

            console.log(`📝 Processing ${words.length} words...`)

            // Step 3: Prepare entries for batch insert
            const entries = words.map(word => ({
                dictionary_id: dictionary.id,
                word: word.word.toLowerCase(),
                definition: formatDefinition(word.translations),
                detail: {
                    phonetic: '', // This dataset doesn't include phonetics
                    examples: formatExamples(word.phrases),
                },
            }))

            // Step 4: Batch insert in chunks (Supabase has limits)
            const BATCH_SIZE = 500
            let insertedCount = 0

            for (let i = 0; i < entries.length; i += BATCH_SIZE) {
                const batch = entries.slice(i, i + BATCH_SIZE)

                const { error: insertError } = await supabase
                    .from('dictionary_entries')
                    .insert(batch)

                if (insertError) {
                    console.error(`❌ Batch insert failed at index ${i}:`, insertError)
                    continue
                }

                insertedCount += batch.length
                console.log(`   ✓ Inserted ${insertedCount}/${entries.length} words`)
            }

            results.success.push(dictConfig.name)
            results.totalWords += insertedCount
            console.log(`✅ Completed: ${dictConfig.name} (${insertedCount} words)`)

        } catch (error) {
            console.error(`❌ Error processing ${dictConfig.name}:`, error)
            results.failed.push(dictConfig.name)
        }
    }

    // Summary
    console.log('\n' + '='.repeat(50))
    console.log('📊 Import Summary:')
    console.log(`✅ Success: ${results.success.length} dictionaries`)
    console.log(`❌ Failed: ${results.failed.length} dictionaries`)
    console.log(`📝 Total words imported: ${results.totalWords}`)

    if (results.success.length > 0) {
        console.log('\n✅ Successfully imported:')
        results.success.forEach(name => console.log(`   - ${name}`))
    }

    if (results.failed.length > 0) {
        console.log('\n❌ Failed to import:')
        results.failed.forEach(name => console.log(`   - ${name}`))
    }

    console.log('='.repeat(50))

    return results
}

// Quick import presets
export const importPresets = {
    // 大学生常用
    college: () => importVocabularyDictionaries(['CET-4', 'CET-6']),

    // 考研学生
    postgraduate: () => importVocabularyDictionaries(['CET-4', 'CET-6', 'Postgraduate']),

    // 出国留学
    abroad: () => importVocabularyDictionaries(['TOEFL', 'IELTS', 'SAT']),

    // 全部导入
    all: () => importVocabularyDictionaries([
        'CET-4', 'CET-6', 'Postgraduate', 'TOEFL', 'IELTS', 'SAT'
    ]),
}
