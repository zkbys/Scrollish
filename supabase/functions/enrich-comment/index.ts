import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const { comment_id } = await req.json()

        if (!comment_id) {
            throw new Error('Comment ID is required')
        }

        // 1. 检查是否已经处理过
        const { data: existing } = await supabaseClient
            .from('comments_enrichment')
            .select('*')
            .eq('comment_id', comment_id)
            .single()

        if (existing) {
            return new Response(JSON.stringify(existing), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            })
        }

        // 2. 获取原评论内容
        const { data: comment, error: fetchError } = await supabaseClient
            .from('comments')
            .select('content')
            .eq('id', comment_id)
            .single()

        if (fetchError || !comment) {
            throw new Error('Comment not found')
        }

        // 3. 调用 Qwen2.5-7B (SiliconFlow)
        const apiKey = Deno.env.get('SILICONFLOW_API_KEY')
        if (!apiKey) throw new Error('Missing SILICONFLOW_API_KEY')

        const prompt = `
Task: Analyze this Reddit comment for an English learning app.
Original: "${comment.content}"

Instructions:
1. Generate difficulty variants: "Mixed" (Chinglish), "Basic" (Simple English), "Intermediate" (CET 4/6), "Expert" (Native).
2. 'Mixed' must use Chinese sentence structure with English keywords embedded.
3. Provide cultural notes ONLY if there is slang or cultural context.
4. Output MUST be a single valid JSON object.

Template:
{
  "corrected_content": "...",
  "translated_content": "...",
  "sentence_segments": [{"en": "...", "zh": "..."}],
  "difficulty_variants": {
    "Mixed": {"content": "...", "highlights": [{"word": "...", "meaning": "..."}]},
    "Basic": {"content": "...", "highlights": [{"word": "...", "meaning": "..."}]},
    "Intermediate": {"content": "...", "highlights": [{"word": "...", "meaning": "..."}]},
    "Expert": {"content": "...", "highlights": [{"word": "...", "meaning": "..."}]}
  },
  "cultural_notes": [{"trigger_word": "...", "explanation": "..."}]
}
`

        const aiResponse = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'Qwen/Qwen2.5-7B-Instruct',
                messages: [
                    { role: 'system', content: 'You are an English education expert. Return ONLY JSON.' },
                    { role: 'user', content: prompt }
                ],
                response_format: { type: 'json_object' },
                temperature: 0.1,
            }),
        })

        const aiData = await aiResponse.json()
        const aiContent = aiData.choices[0].message.content
        const result = JSON.parse(aiContent)

        // 4. 保存到数据库
        const enrichmentPayload = {
            comment_id: comment_id,
            corrected_content: result.corrected_content,
            sentence_segments: result.sentence_segments,
            difficulty_variants: result.difficulty_variants,
            cultural_notes: result.cultural_notes
        }

        const { data: savedData, error: saveError } = await supabaseClient
            .from('comments_enrichment')
            .upsert(enrichmentPayload)
            .select()
            .single()

        if (saveError) throw saveError

        // 5. 更新 comments 表的翻译内容 (content_cn)
        await supabaseClient
            .from('comments')
            .update({ content_cn: result.translated_content })
            .eq('id', comment_id)

        return new Response(JSON.stringify(savedData), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
