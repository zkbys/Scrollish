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

/**
 * 助手函数：将长文本按标点符号切分为多个片段 (防止阿里 API 600字符限制)
 */
function splitText(text: string, maxLength = 500): string[] {
    if (text.length <= maxLength) return [text];

    // 匹配标点符号：。！？. ! ? \n
    const regex = /([^。！？.!？\n]+[。！？.!？\n]*)/g;
    const matches = text.match(regex) || [text];
    const segments: string[] = [];
    let currentChunk = "";

    for (const part of matches) {
        if ((currentChunk + part).length > maxLength && currentChunk !== "") {
            segments.push(currentChunk.trim());
            currentChunk = part;
        } else {
            currentChunk += part;
        }
    }
    if (currentChunk) segments.push(currentChunk.trim());
    return segments;
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
            preferred_name = 'user_clone',
            speech_rate = 1.0,  // 新增：语速控制
            pitch_rate = 1.0    // 新增：语调控制
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

        // 长文本处理：切分为多个片段
        const textSegments = splitText(text, 500);
        console.log(`Synthesis text length: ${text.length}. Segments: ${textSegments.length}`);

        let finalModel = requestedModel || 'qwen3-tts-flash';
        if (voice.startsWith('qwen-tts-vc-') || voice === 'cloned') {
            finalModel = 'qwen3-tts-vc-2026-01-22';
        }

        const urls: string[] = [];

        // 串行请求各个片段
        for (const segment of textSegments) {
            const payload: any = {
                model: finalModel,
                input: { text: segment },
                parameters: {
                    format: format,
                    sample_rate: 24000,
                    volume: 50,
                    speech_rate: speech_rate, // 语速：范围为 (0.5, 2.0)
                    pitch_rate: pitch_rate    // 语调：范围为 (0.5, 2.0)
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
                const msg = data.message || data.error?.message || 'Unknown error';
                throw new Error(`DashScope API Error (${response.status}): ${msg}`);
            }

            const audioUrl = data.output?.audio?.url || data.output?.audio_url;
            if (audioUrl) urls.push(audioUrl);
        }

        if (urls.length === 0) throw new Error('No audio URL returned from server');

        // 如果只有一段，返回单个 string 保持兼容；如果多段，返回数组
        return new Response(JSON.stringify({ url: urls.length === 1 ? urls[0] : urls }), {
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
