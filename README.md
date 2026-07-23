# Evolua

Web app mobile-first para acompanhar treino, peso, água, alimentação, proteína, metas e conquistas.

## Executar

1. Copie `.env.example` para `.env.local` e informe as chaves públicas do Supabase.
2. Execute `supabase/schema.sql` no SQL Editor do projeto Supabase.
3. No Supabase Authentication, habilite Email OTP.
4. Instale e inicie:

```bash
npm install
npm run dev
```

## Produção

O projeto está preparado para Vercel. Cadastre `VITE_SUPABASE_URL` e
`VITE_SUPABASE_ANON_KEY` nas variáveis do projeto e adicione a URL publicada
em Supabase → Authentication → URL Configuration.

## Segurança

A aplicação utiliza somente a chave pública `anon`. O banco aplica Row Level
Security para garantir que cada pessoa acesse apenas os próprios registros.
