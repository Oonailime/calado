# Emiliano Calado — História e Templo dos Três

Portfólio pessoal interativo de Emiliano Calado. A história biográfica acompanha o scroll e conduz a uma experiência 3D jogável, **O Templo dos Três**. O projeto segue em desenvolvimento; veja o [estado atual](PLANO_IMPLEMENTACAO.md) e a [direção do produto](Prompt_portfolio_Emiliano_Calado.md).

## Executar no PC

Node.js 22 ou superior.

```bash
npm ci
npm run dev
```

- `http://localhost:3000`: história interativa de oito cenas, portfólio de projetos e entrada para o jogo.
- `http://localhost:3000/?map=phase2`: abre diretamente a região vulcânica e o desafio de xadrez.
- `http://localhost:3000/?map=phase3`: abre diretamente a região da copa, com platôs e cipós.
- `http://localhost:3000/?map=phase4`: alias compatível de `phase3`.
- `http://localhost:3000/?map=phase2&skip`: atalho local para inspecionar o desafio de xadrez.
- `http://localhost:3000/estudo`: caderno e ferramentas internas de pré-produção. Em produção, a rota fica oculta a menos que `ENABLE_STUDIO=1` seja configurado.

O jogo bloqueia o scroll. **Esc** abre pausa/configurações, de onde também dá para sair do modo jogo; **Retomar** preserva a progressão. Celulares recebem orientação para usar PC.

## Controles do jogo

| Ação                                                | Controle                                       |
| --------------------------------------------------- | ----------------------------------------------- |
| Movimento                                           | WASD / setas                                   |
| Câmera                                              | Clique na tela; o mouse passa a olhar ao redor continuamente até Esc |
| Pular                                               | Espaço                                         |
| Kikazaru dourado / Mizaru prateado / Iwazaru bronze | 1 / 2 / 3                                      |
| Alternar personagem                                 | Q                                              |
| Poder no símbolo correspondente                     | Manter F; remapeável para G/H                  |
| Sustentar poder                                     | Manter F e trocar de personagem, depois soltar |
| Liberar sustentação manualmente                     | Reselecionar o personagem e pressionar F       |
| Construir com Iwazaru                               | E / Enter ou F perto do mecanismo              |
| Reposicionar grupo                                  | R                                              |
| Pausa/configurações (e sair do modo jogo a partir dali) | Esc                                        |

Os comandos também aparecem de forma contextual dentro do jogo. Áudio começa desligado; pausa oferece qualidade, contraste, movimento reduzido, volumes e remapeamento inicial da habilidade.

O inventário mostra bananas e, até a construção da ponte, madeiras coletadas em relação ao total, com um aviso visual de cinco segundos para cada coleta. No desafio sonoro, a trilha de Mizaru fica bem baixinha enquanto ele lê a sequência (fora dessa missão ele ouve normalmente): ondas pretas com o som “A” representam `1` e ondas brancas com “Um” representam `0`. Kikazaru ouve a trilha sempre baixa e abafada, e para de ouvir tudo enquanto o poder dele está ativo. Cada bit dura três segundos; depois dos quatro bits há seis segundos de silêncio antes de a sequência recomeçar. O cadeado oferece três dicas progressivas, reveladas somente quando o jogador as solicita, e avisa visualmente quando um algarismo é digitado errado. Como a câmera trava o cursor durante o jogo, o painel de dicas do cadeado e a pausa liberam o mouse automaticamente para poderem ser clicados.

## Verificação

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Para os testes de navegador, mantenha o servidor local aberto e prepare o Chromium:

```bash
npx playwright install chromium
npm run test:browser
```

Em Linux, o navegador também precisa das bibliotecas de sistema indicadas pelo Playwright. Se já existir um Chromium compatível, informe seu executável em `PLAYWRIGHT_CHROMIUM_EXECUTABLE`. `TEST_BASE_URL` permite selecionar outro servidor.

## Altura e colisão das ilhas

`src/features/game/world/layout.ts` centraliza a superfície do solo (`y = 1.2`), as dimensões das ilhas e os pontos de nascimento/checkpoint. Cada ilha usa um colisor `trimesh` derivado da própria malha visível; a navegação dos companheiros acompanha esse contorno orgânico. Objetos de chão, vegetação e piso da ponte usam a mesma altura de referência, independentemente do nível da água.

O acabamento do terreno separa topo gramado, terra aparente e uma rampa física de areia até a água. Nas margens voltadas para a ponte, a praia é mais estreita para manter o canal e a função do desafio. Vegetação, rochas costeiras, montanhas e detalhes da água são renderizados em lotes; o mar usa um único plano, e a resolução interna foi reduzida nos níveis médio e baixo.

Os testes de terreno verificam a correspondência entre malha e colisão, o repouso das cápsulas e o vão da ponte. Os testes de navegador cobrem nascimento, reposicionamento, travessia e checkpoint.

## Estrutura e documentação

História em `src/features/story`; jogo separado em personagens, câmera, controles, estado/regras, mundo, áudio e interface. `src/content/profile.ts` contém os destinos reais extraídos do currículo, preparados para os portais futuros; não são expostos por um menu.

- [Direção atual do produto](Prompt_portfolio_Emiliano_Calado.md)
- [Estado atual e evolução](PLANO_IMPLEMENTACAO.md)
- [Regras para agentes de código](AGENTS.md)
- [Prompt inicial (legado)](docs/legado/Prompt_portfolio_Emiliano_Calado.md)
- [Plano inicial (legado)](docs/legado/PLANO_IMPLEMENTACAO.md)

O caderno interno não faz parte da navegação pública. A rota principal também não é indexada nesta fase do projeto. O código atual é a fonte de verdade para funcionalidades implementadas; documentos iniciais substituídos estão preservados em `docs/legado/`.
