# Direção atual do projeto — Emiliano Calado

Este documento descreve o produto que existe no repositório hoje e orienta mudanças futuras. Ele substitui a especificação inicial de pré-produção, arquivada em [`docs/legado/Prompt_portfolio_Emiliano_Calado.md`](docs/legado/Prompt_portfolio_Emiliano_Calado.md). Use o código e os dados atuais como fonte de verdade para detalhes de comportamento.

## Produto

O projeto é um portfólio pessoal interativo, em português e inglês, que conta a trajetória de Emiliano Calado por uma história visual controlada pelo scroll e continua em uma experiência 3D jogável chamada **Templo dos Três**. Não é um site institucional convencional com menu de páginas ou catálogo de currículo.

## Experiência que está implementada

- A rota `/` apresenta oito momentos narrativos: nascimento, escola, Ciência e Tecnologia na UFBA, Engenharia da Computação na UFBA, trabalho, mobilidade em Ciência da Computação na UFMG, encontro dos três macacos e transição para o jogo.
- A história avança e retrocede com a rolagem. Personagem, cenário e câmera acompanham o progresso.
- A área **Projetos selecionados** apresenta seis projetos reais. Sua entrada é escalonada e reversível pelo scroll; ela começa depois da saída da construção de Engenharia da Computação na UFBA e desaparece com a abertura da porta da UFMG.
- Ao final da história, **Jogar** inicia o mundo 3D. Durante o jogo, a página fica bloqueada; `Esc` abre pausa e permite retomar ou sair.
- O mapa `islands` contém exploração e mecânicas cooperativas com os três personagens.
- `phase2` abre a região vulcânica com tabuleiro de xadrez, desafio histórico, partidas livres e troféus.
- `phase3` abre a região de copa das árvores, com exploração vertical, cipós, cooperação e o desafio do cubo. `phase4` continua aceito como alias compatível de `phase3`.
- A rota `/estudo` é uma ferramenta interna de pré-produção. Em produção ela responde como inexistente, a menos que `ENABLE_STUDIO=1` seja configurado explicitamente.

## Direção e limites

- Preserve a identidade e o tom visual já estabelecidos; use referências visuais fornecidas pelo usuário como direção, sem copiar assets de terceiros.
- Conteúdo biográfico e descrições de projetos devem vir de `src/content/story.ts`, `src/content/portfolio.ts` e das fontes autorizadas. Não invente cargos, datas, resultados, clientes ou links.
- A história é bilíngue. Mantenha português e inglês sincronizados quando alterar texto visível.
- A experiência funciona em computador e em celulares recentes com navegador e tela de toque. A história e o portfólio acompanham o scroll por toque; o jogo usa controles na tela e orientação horizontal. Preserve os controles, o visual e o desempenho do computador ao adaptar o celular.
- Mantenha a navegação da história reversível, os controles contextuais e o suporte existente a movimento reduzido, contraste, qualidade gráfica e volume.
- No jogo, os três macacos têm habilidades complementares. Preserve seleção livre, companheiros, sustentação de habilidades, progresso dos desafios e retorno seguro.
- Interface de controles, dicas e estado de quebra-cabeças é permitida. Não reintroduza a premissa antiga de que o jogo não pode apresentar qualquer instrução de mecânica.
- Não trate tarefas ainda não implementadas como concluídas. Descreva o estado observado no código e atualize esta direção quando uma mudança relevante alterar o produto.

## Base técnica atual

Next.js 16 com React 19 e TypeScript; Three.js por React Three Fiber; Rapier para física; GSAP/ScrollTrigger para a história; Zustand para estado; `chess.js` e Stockfish para os recursos de xadrez. A interface usa CSS Modules. Os detalhes de versões vêm de `package.json`.

Para arquitetura, rotas de desenvolvimento, comandos e critérios de mudança, consulte [`AGENTS.md`](AGENTS.md), [`CLAUDE.md`](CLAUDE.md), [`PLANO_IMPLEMENTACAO.md`](PLANO_IMPLEMENTACAO.md) e [`README.md`](README.md).
