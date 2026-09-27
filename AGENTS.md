<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Contexto deste projeto

- Leia [`Prompt_portfolio_Emiliano_Calado.md`](Prompt_portfolio_Emiliano_Calado.md) para a direção atual e [`PLANO_IMPLEMENTACAO.md`](PLANO_IMPLEMENTACAO.md) para o estado e a estrutura implementados.
- `docs/legado/` guarda o prompt e o plano originais. Eles são referência histórica; quando divergirem do código, dados e instruções atuais, não os use como requisitos ativos.
- A experiência atual combina uma história bilíngue controlada pelo scroll e um jogo 3D para computador. Os mapas válidos são `islands`, `phase2` e `phase3`; `phase4` é alias compatível de `phase3`.
- Preserve a arquitetura, os dados, os testes existentes e alterações do usuário. Não substitua funcionalidades por descrições antigas de protótipo ou por etapas planejadas que já não representam o produto.
- Use `src/content/story.ts` e `src/content/portfolio.ts` como fontes do conteúdo narrativo e dos projetos. Não invente fatos biográficos, resultados ou destinos.
- Aplique o bloco Next.js acima: consulte a documentação instalada em `node_modules/next/dist/docs/` antes de escrever código e preserve o bloco gerenciado pelo Next.
