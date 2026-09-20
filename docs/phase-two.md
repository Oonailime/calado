# Fase 2 — Jardim das cinzas

Acesso direto: `/?map=phase2`.

Cena 3D procedural baseada em `assets_referencia/map/referencia_mapa_2_vulcanico_xadrez.png`. A imagem é uma referência de composição; todos os elementos da fase são geometria e materiais renderizados em tempo real, sem depender do arquivo de referência em produção.

- Vale de basalto com oito vulcões, crateras rebaixadas, encostas e um platô caminhável.
- Cerejeira ampliada com tronco curvo, casca irregular, raízes e galhos assimétricos; flores rosas de cinco pétalas. As pétalas em queda partem de posições das flores renderizadas e descem até o terreno, sem emissão acima da copa.
- Mesa de madeira, tabuleiro de 64 casas e 32 peças modeladas, em escala de 48% do conjunto inicial. Os bancos ficam atrás das duas fileiras de peças; as rainhas ocupam casas da própria cor e os reis ficam frente a frente. Colisões acompanham a escala e a posição dos objetos. Lanterna com chama e iluminação oscilante. O xadrez é um objeto do cenário, sem regras de partida implementadas.
- Rios e veios de lava animados, fumaça nas crateras, céu nublado, névoa, cinzas, rochas e árvores secas.
- Colisões no terreno, nas rochas e nos objetos da clareira; nascimento e recuperação próprios para os três personagens.

Controles: WASD/setas para andar, Espaço para pular, clique e mouse para olhar, 1/2/3 para trocar de personagem, R para retornar à clareira e Esc para pausar. As interações de itens e desafios dos outros mapas ficam desativadas nesta fase. O modo de movimento reduzido congela os efeitos ambientais animados.

`phaseTwoLayout.ts` contém o relevo e os pontos de nascimento. `phaseTwoAssets.ts` gera as malhas estáticas em lotes. `PhaseTwo.tsx` monta materiais, efeitos e física. A cena preserva o fluxo normal das ilhas e o acesso existente a `?map=phase4`.

Validação: `tests/phase-two-layout.test.ts` verifica a rota, superfícies de nascimento, crateras e altura da lava. `node scripts/capture-phase-two.mjs` verifica a fase no navegador e grava capturas e telemetria em `test-results/phase2-*`. O script aceita `PHASE_TWO_BASE_URL`, `PLAYWRIGHT_CHROMIUM_EXECUTABLE` e `PHASE_TWO_SOFTWARE=1`.

Na validação de implementação, os 136 testes unitários passaram, assim como TypeScript e ESLint dos arquivos alterados. O navegador confirmou nascimento, caminhada, salto, reinício, troca de personagem e pausa sem erros JavaScript/WebGL. A captura final está em `test-results/phase2-spawn.png`; `--visual-only` repete somente essa captura. O Chromium automatizado utilizou ANGLE/SwiftShader (renderização por software) e registrou cerca de 1 FPS a 1600 × 1000; o desempenho com aceleração gráfica real ainda não foi medido.
