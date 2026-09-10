# IACRM — Dashboard Insider (Evino / Grand Cru)

Dashboard de analytics multicanal integrado à **Insider One**, feito para rodar **100% na Vercel**.
O usuário escolhe **conta** + **canal** + **período**, o app consulta a Insider por um proxy serverless
(as chaves ficam só no servidor) e renderiza **KPIs + série temporal + heatmap-calendário**.

## Contas (Evino / Grand Cru)

A **logo no topo da sidebar é o botão de conta**: clicar nela abre as logos da Evino e da
Grand Cru para escolher (fecha ao clicar fora ou com `Esc`). A escolha fica salva no navegador
(`localStorage: iacrm-brand`) e vale para o dashboard e para o chat de IA. Trocar de conta muda:

- a **logo** da sidebar;
- a **conta Insider** consultada (cada marca tem seu próprio conjunto de chaves — ver `.env.example`);
- as **tabelas do Redshift** de receita/conversões/garrafas (`ev_*` para Evino, `gc_*` para Grand Cru).

> **Uma única chave geral por conta atende todos os canais** (`INSIDER_API_KEY` / `INSIDER_GC_API_KEY`);
> as variáveis por canal são overrides, só necessárias se a conta emitir um token exclusivo.
> Duas exceções, iguais nas duas contas: **App Push** exige a chave do projeto Mobile
> (`*_MOBILE_API_KEY` — a chave geral responde "Bad Api Key") e **Web Push** exige o
> `*_WEBPUSH_PARTNER_ID` (ID numérico da conta, não é chave).
>
> Não há fallback de credenciais entre as contas: se as variáveis `INSIDER_GC_*` não estiverem
> preenchidas, a conta Grand Cru mostra erro explícito em vez de exibir dados da Evino.
>
> O Next lê o `.env` **apenas ao subir** — depois de editar chaves, reinicie o servidor.
>
> Em Grand Cru, **garrafas** são contadas por item de pedido — `gc_fact_order_item` não expõe
> quantidade por item. O dashboard exibe esse aviso junto dos dados.

## Stack

- **Next.js 14** (App Router) + **TypeScript**
- **Recharts** (série temporal)
- Tema corporativo em modo claro, com a marca Evino como acento (`src/app/globals.css`)

## Canais

| Canal | Endpoint | Auth | Histórico |
|---|---|---|---|
| Email | `/email/v2/overall` | `X-INS-AUTH-KEY` | ✅ até 1 ano |
| SMS | `/analytics/v1/overall` | `X-INS-AUTH-KEY` | ✅ até 1 ano |
| WhatsApp | `/v1/statistics/overall` (campanhas, `summary`+`details`) | `x-ins-auth-key` | ✅ até 1 ano |
| Web Push | `/v1/statistics/overall-metrics` (paginado, por campanha) | `Bearer` + `partner_id` string | ✅ (exige chave própria) |
| App Push | `get_statistics` | `api_key` no body | ⚠️ só dia atual |

> **Web Push** e **App Push** costumam exigir chaves próprias (`INSIDER_WEBPUSH_API_KEY`
> e `INSIDER_MOBILE_API_KEY`). Sem elas, o dashboard mostra um aviso claro em vez de quebrar.

## Rodando local

```bash
npm install
cp .env.example .env   # preencha INSIDER_API_KEY (Evino) e INSIDER_GC_API_KEY (Grand Cru)
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

Conta ativa: `src/lib/brands.ts` (catálogo client-safe: rótulo + logos),
`src/components/BrandContext.tsx` (estado compartilhado e persistido),
`src/lib/insider/env.ts` (chaves por conta) e `src/lib/redshiftRevenue.ts` (tabelas por conta).
