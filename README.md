# IACRM — Dashboard Insider (Evino)

Dashboard de analytics multicanal integrado à **Insider One**, feito para rodar **100% na Vercel**.
O usuário escolhe **canal** + **período**, o app consulta a Insider por um proxy serverless
(as chaves ficam só no servidor) e renderiza **KPIs + série temporal + heatmap-calendário**.

## Stack

- **Next.js 14** (App Router) + **TypeScript**
- **Recharts** (série temporal)
- Tema **Evino** em modo claro (`src/app/globals.css`)

## Canais

| Canal | Endpoint | Auth | Histórico |
|---|---|---|---|
| Email | `/email/v2/overall` | `X-INS-AUTH-KEY` | ✅ até 1 ano |
| SMS | `/analytics/v1/overall` | `X-INS-AUTH-KEY` | ✅ até 1 ano |
| WhatsApp | Architect `/v1/overall` (`channels[]=whatsapp`) | `Bearer` | ✅ |
| Web Push | `/v1/statistics/top-metrics` | `Bearer` + `partner_id` string | ✅ (exige chave própria) |
| App Push | `get_statistics` | `api_key` no body | ⚠️ só dia atual |

> **Web Push** e **App Push** costumam exigir chaves próprias (`INSIDER_WEBPUSH_API_KEY`
> e `INSIDER_MOBILE_API_KEY`). Sem elas, o dashboard mostra um aviso claro em vez de quebrar.

## Rodando local

```bash
npm install
cp .env.example .env   # e preencha INSIDER_API_KEY
npm run dev            # http://localhost:3000
```

## Deploy na Vercel

1. Suba o repo e importe na Vercel (framework detectado: Next.js).
2. Em **Settings > Environment Variables**, adicione as chaves do `.env.example`.
3. Em produção, ajuste `AUTH_URL` para a URL pública do site ou remova essa variável para deixar o NextAuth inferir o host.
4. No Google Cloud Console, adicione a URI de callback do deploy: `https://SEU-DOMINIO/api/auth/callback/google`.
5. Deploy. A rota `/api/analytics` roda como Serverless Function (`maxDuration = 60s`).

## Como os dados são montados

- **KPIs**: 1 chamada agregada do range.
- **Série + heatmap**: fan-out — 1 chamada por bucket (**dia** até 45 dias; **semana** em períodos longos),
  com concorrência limitada por canal (Web Push = 2, respeitando 30 req/min).

Arquitetura: `src/lib/insider/` (adapters por canal + dispatcher), `src/app/api/analytics/` (rota),
`src/components/` (charts), `src/app/page.tsx` (UI).
