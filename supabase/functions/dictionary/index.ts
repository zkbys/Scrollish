import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { word, context, model } = await req.json()
    const apiKey = Deno.env.get('SILICONFLOW_API_KEY')

    if (!apiKey) {
      throw new Error('Missing SILICONFLOW_API_KEY')
    }

    const messages = [
      {
        role: 'system',
        content: `You are a linguistic expert API. 
        Analyze the target word in the given context.
        Output strictly valid JSON with this structure:
        {
          "ipa": "pronunciation",
          "context_meaning_cn": "Meaning in this specific sentence (Chinese)",
          "context_meaning_en": "Meaning in this specific sentence (English)",
          "definition_cn": "General dictionary definition (Chinese)",
          "definition_en": "General dictionary definition (English)",
          "roots": "Etymology/Roots breakdown (e.g., 're-(again) + act(do)')"
        }
        Do not output markdown code blocks, just the raw JSON string.`,
      },
      {
        role: 'user',
        content: `Word: "${word}"\nContext: "${context}"`,
      },
    ]

    const response = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || 'Qwen/Qwen2.5-7B-Instruct', // 使用默认模型，或允许前端覆盖
        messages: messages,
        stream: false,
        temperature: 0.3,
      }),
    })

    const data = await response.json()

    return new Response(JSON.stringify(data), {
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
