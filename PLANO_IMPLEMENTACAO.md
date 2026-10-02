# Estado atual e direção de evolução

Este documento substitui o plano inicial de pré-produção, preservado em [`docs/legado/PLANO_IMPLEMENTACAO.md`](docs/legado/PLANO_IMPLEMENTACAO.md). O repositório já contém a experiência narrativa e mapas jogáveis; portanto, não use o antigo cronograma por etapas como descrição do estado atual.

## Estado do produto

O projeto está em desenvolvimento ativo. Há uma experiência pública integrada e funcionalidades jogáveis, mas isso não significa que arte, áudio, desempenho, validação com pessoas ou publicação estejam finalizados. Considere concluído apenas o que estiver presente e funcionando no código atual.

| Área | Implementação atual | Código principal |
| --- | --- | --- |
| História | Oito cenas ligadas ao scroll, com personagem, cenário, câmera e conteúdo em português/inglês | `src/features/story`, `src/content/story.ts` |
| Projetos | Seis projetos com destinos e descrições próprios; painel aparece na transição da UFBA para o trabalho | `src/features/story/WorkPortfolio.tsx`, `src/content/portfolio.ts` |
| Mundo inicial | Personagens selecionáveis, exploração, poderes cooperativos, construção, pontos seguros e interface contextual | `src/features/game/world/World.tsx`, `src/features/game/characters`, `src/features/game/state` |
| Região vulcânica | Tabuleiro de xadrez, desafio histórico, partidas livres e troféus | `src/features/game/world/PhaseTwo.tsx`, `phase2Chess.ts`, `src/features/game/state` |
| Região da copa | Platôs, caminhos arbóreos, cipós andáveis e balanço, cooperação, portais e cubo | `src/features/game/world/PhaseFour.tsx`, `phaseFourAssets.ts`, `phaseFourLayout.ts` |
| Ferramentas internas | Caderno visual e páginas de inspeção de animações/rig | `src/app/estudo`, `src/app/estudo/animacoes`, `src/app/estudo/rig-macaco` |

Os nomes internos dos módulos e mapas são históricos: o mapa público `phase3` renderiza a região implementada em `PhaseFour.tsx`; `phase4` é mantido como alias compatível. Evite renomear ou migrar esse fluxo como parte de uma tarefa visual pequena.

## Como executar e acessar

Use Node.js 22 ou superior:

```bash
npm ci
npm run dev
```

- `/` abre a história e o portfólio também no celular. Antes da navegação, o celular mostra um aviso sobre a adaptação em desenvolvimento; após aceitar, mostra uma animação que orienta a girar o aparelho. Ambos podem ser fechados. A rolagem, inclusive por toque, conduz até o botão **Jogar**. Uma tela de carregamento com a coroa de cipó de seleção cobre a página até a cena 3D carregar. No computador, a barra de rolagem é um tronco com um cipó; no toque, ela fica escondida.
- Modo claro é a história original; modo escuro é a história no cenário vulcânico. O tema segue a preferência do sistema até o visitante escolher no botão de sol/lua, e a escolha fica salva no navegador.
- `/design2` abre direto no modo escuro, sem alterar a escolha salva.
- O cabeçalho da história e a barra do jogo têm um botão de tela cheia. Ele vale para a página inteira, então sair do jogo para a história mantém a tela cheia. No celular cujo navegador não abre páginas em tela cheia (Safari do iPhone), o botão explica como adicionar o site à Tela de Início; aberto pelo ícone, ele roda sem as barras do navegador (`src/app/manifest.ts`, `appleWebApp` e `viewport-fit=cover` em `src/app/layout.tsx`).
- `/?map=phase2` abre diretamente a região vulcânica.
- `/?map=phase3` abre diretamente a região da copa.
- `/?map=phase4` continua aceito como alias de `phase3`.
- `/?map=phase2&skip` é um atalho local para inspeção do xadrez; não representa progressão normal.
- `&debug` (ou `?debug`) mostra a ferramenta de debug de movimentação no jogo: o botão na barra e a tecla `` ` ``. Sem ele, a ferramenta fica escondida.
- `/estudo` é interno e fica oculto em produção, salvo quando `ENABLE_STUDIO=1` estiver explicitamente definido.

No computador, `Esc` abre as configurações e permite sair. Os atalhos de personagem, interação e habilidade são mostrados contextualmente; a habilidade padrão é remapeável. No celular, o jogo é usado na horizontal: joystick à esquerda, câmera e pinça à direita, botões redondos com ícones para pular, interagir e usar a habilidade, além de Subir/Descer quando o macaco está num cipó, e o botão de pausa. Os retratos trocam de personagem. Na vertical, o jogo pausa e esconde os comandos sob um aviso animado para girar o aparelho. No toque, as dicas contextuais (e, na fase 2, as instruções do xadrez) ficam num único botão **?** acima do joystick e só aparecem quando o jogador toca nele. Na fase 2, a câmera do toque parte do enquadramento próximo dos outros mapas; afastar com a pinça abre a vista do vale. Um botão de lupa acima do Interagir afasta a câmera e, tocado de novo, a devolve ao zoom anterior. A qualidade inicial no toque é baixa e pode ser alterada na pausa. Mantenha essa interface como fonte de verdade ao editar controles.

A bananeira usa o FBX original no computador e um GLB com geometria Draco e imagens de até 1024 px no celular. `scripts/prepare-banana-plant.py` reproduz a conversão com Blender 5.2; os arquivos de decodificação Draco ficam em `public/assets/draco/`.
No celular, o canvas da história é desmontado enquanto o jogo está aberto e recriado ao sair, para não manter os dois cenários 3D na memória ao mesmo tempo.

## Arquitetura

- `src/app`: entrada Next.js, layout, metadados e ferramentas internas.
- `src/content`: textos biográficos, projetos e dados de perfil.
- `src/features/story`: composição narrativa, scroll e painel de projetos.
- `src/features/story/scene3d`: câmera, personagem, prédios e cenário da biografia.
- `src/features/game`: montagem do jogo, câmera, personagens, controles, estado, regras, interface, áudio e mundos.
- `src/features/studio`: ferramentas de pré-produção que não fazem parte da navegação pública.
- `tests` e `tests/browser`: testes de lógica e cenários de navegador.

Não mova dados de conteúdo para componentes se isso duplicar as fontes de `src/content`. Não crie uma segunda implementação dos sistemas existentes sem antes entender os módulos e testes relacionados.

## Regras de evolução

1. Leia a solicitação atual e inspecione os componentes, estado, dados e testes diretamente envolvidos.
2. Preserve alterações do usuário e comportamento fora do escopo. Faça mudanças focadas e mantenha os caminhos de entrada existentes.
3. Consulte as instruções de [`AGENTS.md`](AGENTS.md) antes de modificar código; a versão instalada do Next.js tem convenções próprias documentadas localmente.
4. Atualize português e inglês juntos para qualquer conteúdo visível traduzido.
5. Não invente fatos profissionais, requisitos de produto, testes já realizados, compatibilidade, desempenho ou status de publicação.
6. Para mudanças comportamentais, rode verificações proporcionais ao risco: `npm run typecheck`, `npm run lint`, `npm test` ou `npm run test:browser`. Não afirme que foram executadas se não foram.
7. Atualize este documento e o README quando uma mudança relevante alterar rotas, controles, estrutura ou estado do produto.

## Verificações disponíveis

```bash
npm run typecheck
npm run lint
npm test
npm run test:browser
npm run build
```

Os testes de navegador usam Playwright. Consulte os arquivos de configuração e scripts antes de assumir a URL local, o navegador ou as variáveis disponíveis.
