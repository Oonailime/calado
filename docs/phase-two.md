# Fase 2 — Jardim das cinzas

Acesso direto: `/?map=phase2`.

Cena 3D procedural baseada em `assets_referencia/map/referencia_mapa_2_vulcanico_xadrez.png`. A imagem é uma referência de composição; todos os elementos da fase são geometria e materiais renderizados em tempo real, sem depender do arquivo de referência em produção.

- Vale de basalto com oito vulcões, crateras rebaixadas, encostas e um platô caminhável.
- Cerejeira ampliada com tronco curvo, casca irregular, raízes e galhos assimétricos; flores rosas de cinco pétalas. As pétalas em queda partem de posições das flores renderizadas e descem até o terreno, sem emissão acima da copa.
- Mesa de madeira, tabuleiro de 64 casas e as peças existentes, em escala de 48% do conjunto inicial. O minigame usa `chess.js` como fonte de verdade; a aba lateral e as peças 3D representam a mesma posição. As peças se movem com GSAP e os inputs ficam bloqueados até o fim da animação.
- Rios e veios de lava animados, fumaça nas crateras, céu nublado, névoa, cinzas, rochas e árvores secas.
- Colisões no terreno, nas rochas e nos objetos da clareira; nascimento e recuperação próprios para os três personagens.

Controles: WASD/setas para andar, Espaço para pular, clique e mouse para olhar, 1/2/3 para trocar de personagem, R para retornar à clareira e Esc para pausar. No desafio, aproxime-se da cepa das brancas e pressione E ou clique para começar; a cepa das pretas permanece vazia. Na partida livre, sente dois macacos, trocando de personagem entre as ocupações. O indicador de uma cepa só aparece perto dela, quando o personagem pode sentar, e desaparece ao sentar. Durante o xadrez, clique nas casas da aba; Esc ou Sair da mesa encerra e restaura câmera, personagens e controles.

## Xadrez

O botão **Abrir aba de xadrez** abre a interface imediatamente, mesmo antes de ocupar as cepas. Os botões de modo também abrem a aba; mudar do modo livre para o desafio libera as ocupações anteriores. A aba mostra quem ocupa cada lado; os lances ficam bloqueados até iniciar a sessão. Durante a preparação, WASD e 1/2/3 continuam disponíveis e o cursor permanece livre.

`phase2Chess.ts` coordena a sessão e preserva o histórico do `chess.js` ao desfazer tentativas incorretas. `historicalChessChallenge.ts` carrega diretamente a FEN `r1bq1k1r/1p2b1pp/p4p2/3NQ2B/1P1pP3/8/2PK3P/3R2R1 w - - 2 22`. A sequência é `22.Rxg7 fxe5 23.Rf7+ Ke8 24.Rxe7+ Kf8 25.Rf1+ Kg8 26.Rff7`. As respostas pretas são históricas; não carregam a IA. O resultado histórico é abandono, não xeque-mate.

`historicalChessPuzzleSolved` é persistido em localStorage. A conclusão libera o portal físico existente para a Fase 4 e o modo livre, sem trocar automaticamente de mapa. Partidas livres não mudam essa conclusão. Se o navegador bloquear armazenamento, a sessão mantém a conquista e informa que não conseguiu salvá-la.

As cepas existentes são os anchors de `PHASE_TWO_STOOLS`: índice 0/brancas em Z=3,872, rotação 0; índice 1/pretas em Z=6,128, rotação π; ambas X=0. Altura e posição acompanham o terreno. No desafio apenas o jogador ocupa as brancas, com respostas históricas automáticas. No modo livre o primeiro macaco é NPC e o segundo é o jogador; qualquer macaco pode ocupar qualquer lado. Os personagens usam o clipe idle existente nas cepas, com followers suspensos até sair.

`chessCoordinates.ts` centraliza `squareToWorldPosition` e `worldToSquare`: célula de 0,144 unidade, arquivos a→h no sentido -X e linhas 1→8 no sentido +Z, em torno da mesa (0,5). `ChessScene.syncFromFen` reutiliza um pool de 32 malhas com as seis geometrias originais. Capturas escondem malhas; promoções reutilizam a geometria correspondente. Roque move rei e torre; en passant remove o peão na casa correta. Reinício restaura o pool inteiro. A aba gira para o lado do jogador e oferece escolha das quatro promoções.

`stockfishEngine.ts` carrega Stockfish 19 lite single-thread WASM em Worker somente ao começar uma partida livre. Aguarda `uciok`/`readyok`, lê os limites de `UCI_Elo`, usa `UCI_LimitStrength=true` e busca de 700 ms. Dourado: 800 solicitado, 1320 efetivo (mínimo anunciado); marrom: 1600; branco: 2000. Não permite buscas simultâneas; sair encerra o Worker e invalida respostas atrasadas. A força é aproximada e não uma classificação calibrada para este tempo de busca.

`tests/phase-two-chess.test.ts` reconstrói a partida apenas no teste para confirmar a FEN após 21...Kf8, valida a sequência, erros, reinício, restauração e persistência. `tests/chess-scene.test.ts` cobre capturas, roque, en passant, promoção e cancelamento de animação. `tests/browser/phase-two-chess.spec.ts` executa o Worker real nos três níveis e joga pela aba, incluindo partidas livres dos dois lados.

`phaseTwoLayout.ts` contém o relevo e os pontos de nascimento. `phaseTwoAssets.ts` gera as malhas estáticas em lotes. `PhaseTwo.tsx` monta materiais, efeitos e física. A cena preserva o fluxo normal das ilhas e o acesso existente a `?map=phase4`.

Validação: `tests/phase-two-layout.test.ts` verifica a rota, superfícies de nascimento, crateras e altura da lava. `node scripts/capture-phase-two.mjs` verifica a fase no navegador e grava capturas e telemetria em `test-results/phase2-*`. O script aceita `PHASE_TWO_BASE_URL`, `PLAYWRIGHT_CHROMIUM_EXECUTABLE` e `PHASE_TWO_SOFTWARE=1`.

Na validação de implementação, os 136 testes unitários passaram, assim como TypeScript e ESLint dos arquivos alterados. O navegador confirmou nascimento, caminhada, salto, reinício, troca de personagem e pausa sem erros JavaScript/WebGL. A captura final está em `test-results/phase2-spawn.png`; `--visual-only` repete somente essa captura. O Chromium automatizado utilizou ANGLE/SwiftShader (renderização por software) e registrou cerca de 1 FPS a 1600 × 1000; o desempenho com aceleração gráfica real ainda não foi medido.


As atualizações do xadrez ficam no painel e no tabuleiro; o cenário só observa a conclusão histórica para liberar o portal. Os buffers de colisão são memoizados para evitar reconstrução da física e cópias gigantes no medidor de desempenho do React em desenvolvimento. A aba publica cada lance imediatamente, enquanto a peça 3D completa um movimento de 280 ms, sem mensagem de loading a cada lance. O tabuleiro 3D usa uma superfície de clique e desenha somente os destaques ativos, em vez de 64 superfícies transparentes.

Validação da correção de fluidez: 147 testes unitários, TypeScript e lint passaram. No Chromium com a RTX 3060 via Direct3D11, a seleção de peças respondeu entre 13 e 23 ms; os quadros sem cliques ficaram próximos de 16,7 ms. O teste de navegador completou o desafio com a cepa das pretas vazia, verificou os indicadores por proximidade, restaurou os personagens e jogou partidas livres dos dois lados, sem erros JavaScript.


A pose na cepa alinha o quadril do modelo ao centro do assento, preservando a âncora física e a animação idle. Na aba, as letras A–H ficam na borda horizontal e os números 1–8 na vertical; ambos acompanham a orientação do jogador, sem rótulos dentro das casas.

Vitórias por xeque-mate em partidas livres concedem os itens únicos `chess-mizaru`, `chess-kikazaru` e `chess-iwazaru`, conforme o adversário derrotado. O inventário existente exibe cada troféu separadamente, com nome e cor próprios, e anuncia a conquista. A coleção é salva em `localStorage.chessTrophies`, sobrevive ao recarregamento e ao reposicionamento do grupo e não duplica vitórias repetidas. Empates, derrotas e o desafio histórico não concedem esses itens. Os testes cobrem vitórias dos dois lados, os três adversários, persistência, dados inválidos e armazenamento bloqueado; o navegador confirma a entrega no inventário após lances legais contra um Worker de teste determinístico.
