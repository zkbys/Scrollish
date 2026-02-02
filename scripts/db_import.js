import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// Simple helper to load env variables from .env or .env.local
const loadEnv = (filePath) => {
    if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8')
        content.split('\n').forEach(line => {
            const [key, ...valueParts] = line.split('=')
            if (key && valueParts.length > 0) {
                process.env[key.trim()] = valueParts.join('=').trim()
            }
        })
    }
}

loadEnv('.env')
loadEnv('.env.local')

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Supabase URL or Key missing in env files!')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

const DICTIONARIES = [
    {
        name: 'CET-6 (六级核心)',
        description: '大学英语六级核心词汇',
        url: 'https://raw.githubusercontent.com/KyleBing/english-vocabulary/master/json/4-CET6-%E9%A1%BA%E5%BA%8F.json'
    },
    {
        name: '考研英语 (Graduate)',
        description: '考研英语核心词汇',
        url: 'https://raw.githubusercontent.com/KyleBing/english-vocabulary/master/json/5-%E8%80%83%E7%A0%94-%E9%A1%BA%E5%BA%8F.json'
    }
]

async function importDict() {
    for (const dict of DICTIONARIES) {
        console.log(`\n📦 Importing ${dict.name}...`)

        // Create Dictionary
        const { data: dictData, error: dictError } = await supabase
            .from('dictionaries')
            .insert({
                name: dict.name,
                description: dict.description,
                type: 'system',
                is_public: true
            })
            .select()
            .single()

        if (dictError) {
            console.error(`❌ Error creating dictionary ${dict.name}:`, dictError.message)
            continue
        }

        const dictId = dictData.id
        console.log(`✅ Created dictionary ID: ${dictId}`)

        // Fetch Words using global fetch (Node 18+)
        try {
            console.log(`🌐 Fetching JSON from: ${dict.url}`)
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000); // 1 minute timeout

            const response = await fetch(dict.url, { signal: controller.signal })
            clearTimeout(timeoutId);

            if (!response.ok) throw new Error(`Fetch failed with status ${response.status}`)

            const text = await response.text();
            console.log(`📄 Received ${text.length} characters. Parsing JSON...`)
            const words = JSON.parse(text);

            console.log(`📥 Parsed ${words.length} words. Starting batch insert...`)

            // Format entries
            const entries = words.map(item => ({
                dictionary_id: dictId,
                word: item.word,
                definition: item.translations.map(t => `${t.type}. ${t.translation}`).join('; '),
                detail: {
                    phrases: item.phrases || []
                }
            }))

            // Batch insert in chunks of 50
            const chunkSize = 50
            for (let i = 0; i < entries.length; i += chunkSize) {
                const chunk = entries.slice(i, i + chunkSize)
                const { error: entryError } = await supabase
                    .from('dictionary_entries')
                    .insert(chunk)

                if (entryError) {
                    console.error(`\n❌ Error inserting chunk starting at ${i}:`, entryError.message)
                } else {
                    process.stdout.write(`\r✅ Progress: ${Math.min(i + chunkSize, entries.length)}/${entries.length} words`)
                }
            }

            console.log(`\n✨ Finished ${dict.name}`)
        } catch (err) {
            console.error(`\n❌ Error for ${dict.name}:`, err.message)
        }
    }
    console.log('\n🚀 All dictionaries imported successfully!')
}

importDict()
