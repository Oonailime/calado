# Emiliano Calado — História e Templo dos Três

Primeira entrega de pré-produção e prototipagem, seguindo [PLANO_IMPLEMENTACAO.md](PLANO_IMPLEMENTACAO.md). Não é o portfólio completo: a direção artística e as mecânicas precisam passar pela validação da Etapa 3 antes da produção integral.

## Executar no PC

Node.js 22 ou superior.

```bash
npm ci
npm run dev
```

- `http://localhost:3000`: animatic de oito cenas ligado ao scroll. Ao final, clique em **Jogar** para entrar no protótipo.
- `http://localhost:3000/estudo`: caderno interno com conceito do trio, pelagens, storyboards, animatic com controle manual e mapa.

O jogo bloqueia o scroll. **Esc** sai do modo jogo; **Retomar** preserva a progressão. Celulares recebem orientação para usar PC.

## Controles do protótipo

| Ação | Controle |
| --- | --- |
| Movimento | WASD / setas |
| Câmera | Arrastar o mouse |
| Pular | Espaço |
| Mizaru / Kikazaru / Calado | 1 / 2 / 3 |
| Alternar personagem | Q |
| Poder no símbolo correspondente | Manter F; remapeável para G/H |
| Sustentar poder | Manter F e trocar de personagem, depois soltar |
| Liberar sustentação manualmente | Reselecionar o personagem e pressionar F |
| Construir com Calado | E / Enter ou F perto do mecanismo |
| Reposicionar grupo | R |
| Sair do modo jogo | Esc |

Os comandos também aparecem de forma contextual dentro do jogo. Áudio começa desligado; pausa oferece qualidade, contraste, movimento reduzido, volumes e remapeamento inicial da habilidade.

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

## Estrutura e próxima etapa

História em `src/features/story`; jogo separado em personagens, câmera, controles, estado/regras, mundo, áudio e interface. `src/content/profile.ts` contém os destinos reais extraídos do currículo, preparados para os portais futuros; não são expostos por um menu.

- [Direção e decisões](docs/preproducao/DIRECAO.md)
- [Inventário de assets e desempenho](docs/preproducao/ASSETS.md)
- [Protocolo e pendências de validação](docs/preproducao/VALIDACAO.md)
- [Prompt da prancha gerada](docs/preproducao/PROMPTS.md)

O caderno fica desativado em produção por padrão. `ENABLE_STUDIO=1` serve somente para uma revisão interna explicitamente configurada. Toda a pré-produção está com `noindex`.

Faltam validação com pessoas e em PC de referência, arte/áudio definitivos, transição cinematográfica final, regiões completas e portais. As referências e o currículo originais foram preservados.
