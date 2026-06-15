import CryptoJS from 'https://esm.sh/crypto-js@4.2.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SCHOOL_CENTER = {
  name: '西安文理学院高新校区',
  address: '西安市雁塔区科技六路1号',
  latitude: 34.215692,
  longitude: 108.906064,
  radius: 800,
}

const jsonResponse = (payload: unknown, status = 200) => {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
    },
  })
}

const requireEnv = (name: string) => {
  const value = Deno.env.get(name)
  if (!value) {
    throw new Error(`Missing Supabase function secret: ${name}`)
  }

  return value
}

const toUrlSafeBase64 = (value: string) => {
  return value.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

const encryptMeituanContent = (plainText: string, base64SecretKey: string) => {
  const key = CryptoJS.enc.Base64.parse(base64SecretKey)
  const encrypted = CryptoJS.AES.encrypt(plainText, key, {
    mode: CryptoJS.mode.ECB,
    padding: CryptoJS.pad.Pkcs7,
  })

  return toUrlSafeBase64(encrypted.ciphertext.toString(CryptoJS.enc.Base64))
}

const buildOfficialQuery = (body: Record<string, any>) => {
  const query = body.query || {}

  return {
    method: 'waimai.poi.list',
    ts: Math.floor(Date.now() / 1000),
    entId: Number(requireEnv('MEITUAN_ENT_ID')),
    longitude: Number(query.longitude || Math.round(SCHOOL_CENTER.longitude * 1000000)),
    latitude: Number(query.latitude || Math.round(SCHOOL_CENTER.latitude * 1000000)),
    page_index: Number(query.page_index || 1),
    page_size: Number(query.page_size || 20),
    sort_type: Number(query.sort_type || 0),
    keyword: String(query.keyword || '美食'),
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return jsonResponse({ message: 'Only POST is supported.' }, 405)
  }

  try {
    const apiHost = Deno.env.get('MEITUAN_API_HOST') || 'https://api-open-cater.meituan.com'
    const token = requireEnv('MEITUAN_ACCESS_KEY')
    const secretKey = requireEnv('MEITUAN_SECRET_KEY')
    const body = await request.json().catch(() => ({}))
    const query = buildOfficialQuery(body)
    const content = encryptMeituanContent(JSON.stringify(query), secretKey)
    const form = new URLSearchParams({
      token,
      version: Deno.env.get('MEITUAN_API_VERSION') || '1.0',
      content,
    })

    const response = await fetch(`${apiHost}/waimai/v1/poi/list`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    })

    const responseText = await response.text()
    let payload: unknown = responseText

    try {
      payload = JSON.parse(responseText)
    } catch {
      payload = { raw: responseText }
    }

    return jsonResponse({
      provider: 'meituan-enterprise-waimai',
      school: SCHOOL_CENTER,
      request: query,
      payload,
    }, response.ok ? 200 : response.status)
  } catch (error) {
    return jsonResponse({
      message: error instanceof Error ? error.message : 'Unknown meituan proxy error.',
    }, 500)
  }
})
