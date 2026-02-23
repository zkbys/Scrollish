import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const commentId = body.commentId || body.comment_id
    const contextSummary = body.contextSummary || ''
    const providedTargetContent = body.targetContent || ''

    // [新增] 接收前端传来的更丰富的上下文
    const parentContent = body.parentContent || ''
    const opContent = body.opContent || ''

    if (!commentId) {
      throw new Error('缺少必要参数: commentId')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: cachedComment, error: fetchError } = await supabase
      .from('comments')
      .select('content, dopa_explanation')
      .eq('id', commentId)
      .maybeSingle()

    if (fetchError) {
      console.error('DB Error:', fetchError)
    }

    if (cachedComment?.dopa_explanation) {
      return new Response(
        JSON.stringify({
          explanation: cachedComment.dopa_explanation,
          cached: true,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        },
      )
    }

    const targetContent = providedTargetContent || cachedComment?.content
    if (!targetContent) {
      throw new Error(`找不到评论内容，无法解析 (ID: ${commentId})`)
    }

    const SILICONFLOW_API_KEY = Deno.env.get('SILICONFLOW_API_KEY')
    if (!SILICONFLOW_API_KEY) {
      throw new Error('Missing SILICONFLOW_API_KEY')
    }

    // [强化] 让 Dopa 拥有完整的语境大局观
    const prompt = `你是精通英/美式幽默和英文互联网梗的嘴替 Dopa。请用最接地气的大白话（60字内）解释下面这条 Reddit 评论的笑点、槽点或潜台词。
【原帖背景】：${opContent || '无'}
【父级评论语境】：${parentContent || '无'}
【当前需要解释的评论】：${targetContent}

注意：不要翻译腔，不要解释语法。结合上下文直接指出笑点/反讽点。`

    const aiResponse = await fetch(
      'https://api.siliconflow.cn/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SILICONFLOW_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'deepseek-ai/DeepSeek-V3',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
        }),
      },
    )

    const aiData = await aiResponse.json()
    const explanation = aiData.choices?.[0]?.message?.content?.trim()

    if (!explanation) {
      throw new Error('AI 返回内容为空')
    }

    await supabase
      .from('comments')
      .update({ dopa_explanation: explanation })
      .eq('id', commentId)

    return new Response(JSON.stringify({ explanation, cached: false }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
