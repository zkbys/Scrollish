const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * 助手函数：确保数据是 Data URI 格式 (如果是 Base64 的话)
 */
function ensureDataUri(data: string, mediatype = 'audio/wav'): string {
    if (data.startsWith('data:') || data.startsWith('http')) return data;
    return `data:${mediatype};base64,${data}`;
}

/**
 * 带有指数退避的重试包装函数
 */
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3) {
    let lastError: any;
    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await fetch(url, options);
            if (response.status === 429 || response.status >= 500) {
                const waitTime = Math.pow(2, i) * 500 + Math.random() * 200;
                console.warn(`DashScope returned ${response.status}. Retrying in ${Math.round(waitTime)}ms... (Attempt ${i + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                continue;
            }
            return response;
        } catch (err) {
            console.error(`Fetch attempt ${i + 1} failed:`, err.message);
            lastError = err;
            const waitTime = Math.pow(2, i) * 500;
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }
    throw lastError || new Error(`Failed after ${maxRetries} retries`);
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const body = await req.json().catch(() => ({}))
        const {
            text,
            voice = 'Cherry',
            format = 'wav',
            model: requestedModel,
            reference_audio,
            reference_text,
            action = 'synthesize',
            preferred_name = 'user_clone'
        } = body

        const apiKey = Deno.env.get('DASHSCOPE_API_KEY')
        if (!apiKey) throw new Error('TTS configuration missing on server (Missing API Key)');

        if (action === 'enroll') {
            if (!reference_audio) throw new Error('reference_audio is required for enrollment');

            // 智能识别：如果是 URL 则直接透传；如果是 Base64 则包装成 Data URI
            const isUrl = reference_audio.startsWith('http');
            const audioData = isUrl ? reference_audio : ensureDataUri(reference_audio, `audio/${format || 'wav'}`);

            console.log('Action: Enrollment. Audio Source:', isUrl ? 'URL' : 'Base64/DataURI', 'Length:', audioData.length);

            const enrollmentPayload: any = {
                model: "qwen-voice-enrollment",
                input: {
                    action: "create",
                    target_model: "qwen3-tts-vc-2026-01-22",
                    preferred_name: preferred_name,
                    audio: {
                        data: audioData
                    }
                }
            };

            // 部分 DashScope 接口在处理 URL 时也支持 input.audio_url 字段
            if (isUrl) {
                enrollmentPayload.input.audio_url = audioData;
            }

            const enrollResponse = await fetchWithRetry('https://dashscope.aliyuncs.com/api/v1/services/audio/tts/customization', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(enrollmentPayload),
            });

            const enrollText = await enrollResponse.text();
            let enrollResult: any = {};
            try { enrollResult = JSON.parse(enrollText); } catch (e) { console.error('Failed to parse enrollment response:', enrollText); }

            if (!enrollResponse.ok) {
                console.error(`Enrollment Failed (Status ${enrollResponse.status}):`, enrollText);
                throw new Error(`Enrollment Failed (${enrollResponse.status}): ${enrollResult.message || enrollResponse.statusText || 'Unknown Error'}`);
            }

            return new Response(JSON.stringify(enrollResult), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // --- 2. 处理语音合成 (Synthesis) ---
        if (!text) throw new Error('Text is required for TTS');

        let finalModel = requestedModel || 'qwen3-tts-flash';
        if (voice.startsWith('qwen-tts-vc-') || voice === 'cloned') {
            finalModel = 'qwen3-tts-vc-2026-01-22';
        }

        const payload: any = {
            model: finalModel,
            input: { text },
            parameters: {
                format: format,
                sample_rate: 24000,
                volume: 50,
            }
        }

        if (finalModel.includes('cosyvoice')) {
            payload.parameters.reference_audio = reference_audio;
            if (reference_text) payload.parameters.reference_text = reference_text;
        } else {
            payload.input.voice = voice;
            if (!finalModel.includes('-vc')) payload.parameters.voice = voice;
        }

        const response = await fetchWithRetry('https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'X-DashScope-DataInspection': 'enable',
            },
            body: JSON.stringify(payload),
        })

        const resultText = await response.text();
        let data: any = {};
        try { data = JSON.parse(resultText); } catch (e) { /* ignore */ }

        if (!response.ok) {
            throw new Error(`DashScope API Error (${response.status}): ${data.message || 'Unknown error'}`);
        }

        const audioUrl = data.output?.audio?.url || data.output?.audio_url
        return new Response(JSON.stringify({ url: audioUrl }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error) {
        console.error('TTS Function Error:', error.message);
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }
})
