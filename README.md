# my-finances — Finn 💙

Finanças pessoais: saldo previsto, contas a pagar, gastos mensais (gastos na rua), cartões, moradia, reserva e fluxo de caixa.
Tem CRUD para tudo, light/dark mode, layout responsivo (dá para instalar no celular como app) e um backend leve.

## Stack

| Parte | Tecnologia |
|---|---|
| Frontend | React 18 + Vite + TypeScript, CSS puro com variáveis (tema claro/escuro), lucide-react |
| Backend | Node 22 + [Hono](https://hono.dev) + zod |
| Banco | PostgreSQL 16 (`pg`): container Docker em dev, [Neon](https://neon.tech) (grátis) em produção |
| Deploy | Um único serviço (a API também entrega o frontend), pronto para o Render (plano free) |

## Rodando localmente

Pré-requisitos: Node 20+ e Docker.

```bash
npm install
npm run db:up    # sobe o Postgres em container (localhost:5433, usuário/senha/banco: finances)
npm run seed     # (opcional) carrega dados de exemplo — APAGA os dados atuais
npm run dev      # API em :3333 + frontend em http://localhost:5173
```

As tabelas são criadas e atualizadas automaticamente quando a API sobe. Outros comandos:

```bash
npm run db:psql  # abre o psql dentro do container
npm run db:down  # para o container (os dados ficam no volume "pgdata")
docker compose down -v   # para E apaga os dados
```

A porta do host é **5433** para não conflitar com um Postgres instalado na máquina.
Para usar outro banco, defina `DATABASE_URL` (veja `.env.example`).
Para testar no celular pela mesma rede Wi-Fi, abra `http://<ip-do-pc>:5173`.

## Como as contas são calculadas

**Saldo previsto** = renda − contas da casa − contas pessoais (incluindo faturas do mês) − gastos mensais.

| Tipo | O que é | Onde cadastra |
|---|---|---|
| **Contas da casa** | Fixas de moradia: aluguel, condomínio, luz, internet... | Ajustes → Contas da casa |
| **Contas pessoais** | Fixas suas: saúde, assinaturas, ajuda à família... | Ajustes → Contas pessoais |
| **Faturas** | Valor da fatura de cada cartão no mês | Cartões |
| **Gastos mensais** | Gastos variáveis na rua: comida, roupas, eventualidades e outros | Gastos mensais (ou o botão **+ Adicionar**) |

- **Gastos mensais** entram no saldo pelo **orçamento mensal** (definido em *Minha renda → Configurações*). Se você gastar mais que o orçamento, entra o valor gasto. Assim os meses futuros já ficam projetados.
- **Contas a pagar** lista as contas fixas e as faturas do mês. Marque cada uma como paga.
- **Moradia**: contas da casa marcadas como "moradia", comparadas com o seu salário.
- **Destaques** (ex.: Obra): qualquer conta marcada com "Destacar no painel".
- Contas e rendas são **recorrentes**. Use início/fim para limitar o período, ou início = fim para algo avulso.
- Os valores são guardados em centavos para não ter erro de arredondamento.

## Deploy grátis (para usar na rua)

### 1. Postgres no Neon (gratuito e persistente)

1. Crie uma conta em https://neon.tech e um projeto `my-finances`.
2. Copie a *connection string* (`postgres://...neon.tech/neondb?sslmode=require`). Ela é a `DATABASE_URL`.

> O Postgres gratuito do Render expira em 30 dias, por isso a sugestão é o Neon.

### 2. App no Render

1. No Render: **New → Blueprint** e selecione este repositório (ele lê o `render.yaml`).
2. Preencha `APP_PASSWORD` e `DATABASE_URL`.
3. Abra a URL `https://my-finances-xxxx.onrender.com` no celular e use **"Adicionar à tela inicial"**.

> O plano free "dorme" depois de 15 min sem uso. O primeiro acesso depois disso leva uns 30 a 50 s.
> Se quiser evitar isso, use um ping gratuito (ex.: cron-job.org) em `/api/health`.

## API

Todas as rotas ficam em `/api` e exigem `Authorization: Bearer <token>` quando `APP_PASSWORD` está definido (o token vem de `POST /api/login`).

| Recurso | Rotas |
|---|---|
| Renda | `GET/POST /incomes`, `PUT/DELETE /incomes/:id` |
| Contas fixas (casa/pessoais) | `GET/POST /bills`, `PUT/DELETE /bills/:id` |
| Gastos mensais | `GET /expenses?month=AAAA-MM`, `POST /expenses`, `PUT/DELETE /expenses/:id` |
| Cartões | `GET/POST /cards`, `PUT/DELETE /cards/:id` |
| Faturas | `GET /invoices`, `POST /invoices` (upsert por cartão + mês), `DELETE /invoices/:id` |
| Reserva | `GET/POST /reserve`, `PUT/DELETE /reserve/:id` |
| Pagamentos | `POST /payments/toggle` `{ref_type, ref_id, month}` |
| Configurações | `GET/PUT /settings` |
| Painel | `GET /summary?month=AAAA-MM`, `GET /cashflow?from=AAAA-MM&months=12` |

Categorias aceitas em `/expenses`: `comida`, `roupas`, `eventualidades`, `outros`.

## Estrutura

```
server/src
  index.ts     # servidor Hono, login, arquivos estáticos
  routes.ts    # CRUD + validação (zod)
  summary.ts   # cálculos do painel e do fluxo de caixa
  db.ts        # pool do Postgres + schema/migração automática
  seed.ts      # dados de exemplo
web/src
  pages/       # Dashboard, MonthExpenses, CashFlow, Cards, Reserve, Income, Bills
  components/  # Layout (sidebar/topbar/bottom-nav), Forms (modais de CRUD), ui
  categories.ts# categorias dos gastos mensais
  store.tsx    # mês selecionado, tema, refresh, modais
```
