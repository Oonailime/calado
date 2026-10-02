# Emiliano Calado — História e Templo dos Três

Portfólio pessoal interativo de Emiliano Calado. A história biográfica acompanha o scroll e conduz a uma experiência 3D jogável, **O Templo dos Três**. O projeto segue em desenvolvimento; veja o [estado atual](PLANO_IMPLEMENTACAO.md) e a [direção do produto](Prompt_portfolio_Emiliano_Calado.md).

## Executar no computador ou celular recente

Node.js 22 ou superior.

```bash
npm ci
npm run dev
```

- `http://localhost:3000`: história interativa de oito cenas, portfólio de projetos e entrada para o jogo. Abre com uma tela de carregamento (a coroa de cipó de seleção) e tem modo claro (a história original) e modo escuro (o cenário vulcânico com cerejeiras, xadrez e lareira), escolhidos no botão de sol/lua ou pela preferência do sistema.
- `http://127.0.0.1:3000` também funciona para desenvolvimento local; o Next permite essa origem para os recursos de desenvolvimento.
- `http://localhost:3000/design2`: abre direto no modo escuro, sem alterar a escolha salva.
- `http://localhost:3000/?map=phase2`: abre diretamente a região vulcânica e o desafio de xadrez.
- `http://localhost:3000/?map=phase3`: abre diretamente a região da copa, com platôs e cipós.
- `http://localhost:3000/?map=phase4`: alias compatível de `phase3`.
- `http://localhost:3000/?map=phase2&skip`: atalho local para inspecionar o desafio de xadrez.
- Acrescente `&debug` (ou use `?debug`) para mostrar a ferramenta de debug de movimentação no jogo; sem ele, o botão e a tecla `` ` `` ficam desativados.
- `http://localhost:3000/estudo`: caderno e ferramentas internas de pré-produção. Em produção, a rota fica oculta a menos que `ENABLE_STUDIO=1` seja configurado.

No computador e no celular, a história avança com a rolagem. Ao abrir em um celular, um aviso explica que a adaptação ainda está em desenvolvimento; quem optar por continuar verá uma orientação animada para girar o aparelho. Os dois avisos podem ser fechados. O jogo bloqueia o scroll e só pode ser jogado na horizontal no celular; ao voltar para a vertical, a simulação pausa até o aparelho ser girado novamente. No computador, **Esc** abre pausa/configurações, de onde também dá para sair do modo jogo; **Retomar** preserva a progressão.

No celular com tela de toque, use o joystick à esquerda para andar, arraste à direita para girar a câmera e faça uma pinça à direita para aproximar ou afastar. Os botões redondos de **Pular**, **Agarrar / interagir** e **Habilidade** (ícones de seta, mão e faísca) e o botão **Pausar** ficam na tela; **Subir** e **Descer** aparecem ao agarrar um cipó. Toque nos retratos para trocar de macaco. As dicas do jogo só aparecem quando você toca no botão **?** acima do joystick. Na fase 2, a câmera começa perto dos macacos; afaste com a pinça para ver o vale. O botão de lupa acima do **Agarrar / interagir** afasta a câmera e, tocado de novo, a traz de volta. O botão de tela cheia funciona no Android; no iPhone, cujo Safari não abre sites em tela cheia, ele explica como adicionar o Templo dos Três à Tela de Início, e aberto pelo ícone o site roda sem as barras do navegador. O jogo começa em qualidade baixa, que pode ser alterada na pausa.

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

Os comandos também aparecem de forma contextual dentro do jogo, com dicas próprias para toque. Áudio começa desligado; pausa oferece qualidade, contraste, movimento reduzido, volumes e remapeamento inicial da habilidade.

O inventário mostra bananas e, até a construção da ponte, madeiras coletadas em relação ao total, com um aviso visual de cinco segundos para cada coleta. No desafio sonoro, a trilha de Mizaru fica bem baixinha enquanto ele lê a sequência (fora dessa missão ele ouve normalmente): ondas pretas com o som “A” representam `1` e ondas brancas com “Um” representam `0`. Kikazaru ouve a trilha sempre baixa e abafada, e para de ouvir tudo enquanto o poder dele está ativo. Cada bit dura três segundos; depois dos quatro bits há seis segundos de silêncio antes de a sequência recomeçar. O cadeado oferece cinco dicas progressivas, reveladas somente quando o jogador as solicita: da primeira, que explica como fazer as ondas aparecerem, à última, que explica a conversão de 4 bits para um algarismo decimal, e avisa visualmente quando um algarismo é digitado errado. Como a câmera trava o cursor durante o jogo, o painel de dicas do cadeado e a pausa liberam o mouse automaticamente para poderem ser clicados.

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
