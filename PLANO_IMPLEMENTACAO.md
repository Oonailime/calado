# Plano de implementação — Portfólio de Emiliano Calado

Status: primeira entrega das Etapas 1 e 2 implementada, com caderno de pré-produção, animatic e protótipo de cooperação. Validação artística, testes com pessoas e medição em PC de referência pendentes na Etapa 3. Produção integral das Etapas 4–7 ainda não iniciada. Evidências e limites: [docs/preproducao/VALIDACAO.md](docs/preproducao/VALIDACAO.md).

Especificação principal: [Prompt_portfolio_Emiliano_Calado.md](Prompt_portfolio_Emiliano_Calado.md), lida integralmente, com 672 linhas e 26 seções. Este plano organiza sua execução e não substitui seus requisitos. Decisões propostas abaixo poderão ser ajustadas durante os protótipos; alterações de escopo precisam ser explicitadas.

## 1. Situação atual e interpretação dos requisitos

O repositório está na pasta `history/`. Inicialmente continha um README mínimo, a especificação e duas referências PNG; o usuário acrescentou o currículo HTML. A primeira entrega agora inclui aplicação Next.js/TypeScript, caderno visual, animatic e protótipo 3D com geometria e áudio provisórios. Os arquivos fornecidos foram preservados.

As duas imagens foram inspecionadas. A identidade existente usa orelhas arredondadas, mecha de cabelo pro alto, rosto claro e uma mão cobrindo a boca; a versão colorida oferece uma referência marrom e creme. Esses traços orientarão Calado. As imagens não definem o corpo, as vistas laterais, o rig ou os outros dois macacos: esse desenvolvimento pertence à pré-produção visual.

O produto reúne duas experiências com necessidades diferentes:

- **Minha História:** oito cenas biográficas, crescimento de Calado e animações reversíveis pelo scroll, com textos curtos em português e inglês.
- **O Templo dos Três:** aventura 3D de aproximadamente 8–15 minutos na primeira conclusão, com troca de personagens, cooperação, três regiões, reconstrução da logo e exploração posterior.
- **Conexão entre as partes:** a identidade ilustrada ganha volume, se rompe e dá lugar ao controle jogável em uma transição contínua. (Ao dar play no jogo o scroll para subir a página deve ser desativado até o usuário apertar esc (sair do modo jogo))

O maior risco de implementação está na combinação entre sustentação de poderes, troca de personagem, navegação dos companheiros e recuperação de falhas. A qualidade artística também depende de uma produção própria de personagens, cenários, animações e sons. Por isso, a primeira entrega executável será um pequeno protótipo das mecânicas.

### Requisitos que orientam todas as etapas

- Mizaru dourado, Kikazaru branco/perolado e Calado marrom/cobre, reconhecíveis também por silhueta, gesto, movimento e efeito.
- Narrativa do jogo comunicada por ações, imagem e som. Nenhum diálogo, narração, título de fase, objetivo escrito, card de projeto ou explicação biográfica dentro do 3D.
- Texto visível no jogo restrito a instruções indispensáveis de controles e mecânicas. Configurações devem servir à operação e acessibilidade da experiência.
- Links, projetos e competências descobertos no mundo; nenhum menu, catálogo ou página paralela para contornar a exploração.
- Companheiros seguem ou sustentam habilidades; não completam o desafio principal pelo visitante.
- Sem adaptação jogável para celular, conforme alteração do usuário: mostrar orientação para usar PC. Permanecem teclado/mouse, redução de movimento, contraste e pistas compreensíveis sem áudio. Esta decisão substitui as menções anteriores a controles de toque.
- Áudio começa desativado e todas as pistas indispensáveis continuam compreensíveis sem som.
- Fatos profissionais, datas, projetos e destinos externos não serão inventados. Placeholders técnicos serão identificados no desenvolvimento e não publicados como conteúdo real. Como o portifólio deve crescer, o projeto deve ser modularizado para incremento.
- Referências GTA VI e Bruno Simon orientam princípios de experiência; os assets e a identidade serão próprios.

## 2. Sequência de implementação e critérios de conclusão

Cada etapa deve gerar uma entrega revisável, registrar as verificações feitas e atualizar as pendências. Não acumular todas as etapas em uma única implementação. A validação exigida na seção 25 da especificação acontece antes da produção integral.

### Etapa 0 — Análise e plano, concluída

Entregas: inventário inicial, interpretação dos requisitos, arquitetura proposta, etapas, critérios de validação e pendências documentados neste arquivo.

Conclusão: especificação lida integralmente e plano registrado. Não inclui instalação de pacotes, código de aplicação ou produção de assets.

### Etapa 1 — Pré-produção visual e narrativa

Entregas:

- Pranchas dos três macacos com proporções, silhuetas, poses, expressões e estudos das pelagens dourada, branca e marrom.
- Evolução de Calado: bebê, criança, universitário e adulto, mantendo continuidade de identidade.
- Storyboard completo das oito cenas: nascimento, escola, Ciência e Tecnologia/UFBA, Engenharia da Computação/UFBA, mão do mercado, mobilidade/UFMG, encontro dos três e ruptura da logo.
- Animatic de baixa fidelidade para escola → UFBA → mercado → UFMG e para a passagem da logo ao jogo. Verificar avanço e retorno pelo scroll.
- Storyboard visual da parte jogável, incluindo prólogo, três regiões, templo e Conexões, sem texto narrativo nos quadros da experiência.
- Mapa compacto com templo como ponto de referência, percurso principal e caminhos de retorno. Progressão inicial proposta: prólogo → Jardim → Cidade → Oficina → Templo → Conexões; depois, regiões revisitáveis.
- Inventário de assets e planejamento de desempenho detalhados a partir das seções 6 e 7 deste plano.

Conclusão: direção visual coerente entre ilustração e 3D, percurso legível, crescimento de Calado reconhecível e transições demonstradas. Registrar a revisão visual antes de investir na arte definitiva.

### Etapa 2 — Fundação técnica e protótipos das mecânicas

Criar a aplicação e uma área experimental pequena, com geometria provisória e sem produzir o mundo completo.

Ordem de implementação:

1. Base Next.js/TypeScript, separação entre página pública e execução 3D no cliente, convenções de assets e comandos de verificação.
2. Movimento, colisões, pulo, câmera em terceira pessoa, teclado e mouse; ponto seguro e reposicionamento.
3. Três personagens provisórios, troca direta/cíclica, companheiros seguindo e estados de habilidade sustentada.
4. Ponte revelada por Mizaru, com colisão dependente da habilidade e permanência conquistada pela construção de Calado.
5. Área silenciada por Kikazaru, controlando um obstáculo e oferecendo feedback visual mesmo com áudio desligado.
6. Construção por Calado, com pré-condições, animação provisória e resultado persistente no estado da sessão.
7. Sequência cooperativa com dois companheiros sustentando poderes enquanto Calado conclui uma construção.
8. Tutorial contextual, indicadores visuais, pausa, áudio opt-in, ajustes iniciais de qualidade e medição de desempenho.

Conclusão: visitante consegue mover, pular, trocar, sustentar, construir e recuperar o grupo. Validar troca com poderes ativos, duas sustentações simultâneas, quedas, perda de foco da aba e companheiro preso. A retomada deve preservar um estado solucionável do desafio.

### Etapa 3 — Validação obrigatória antes da produção integral

Integrar os protótipos em um trecho curto e representativo, com arte suficiente para avaliar a leitura dos personagens e das pistas. Apresentar junto dele os materiais da Etapa 1.

Entregas:

- Sessão de teste com pessoas que não receberam explicação prévia, conforme a seção 25.12 da especificação.
- Registro de como descobriram os controles, perceberam cada poder, sustentaram uma habilidade e combinaram o trio; anotar intervenções necessárias, travamentos e pistas ignoradas.
- Verificação em computador intermediário, com e sem áudio, movimento reduzido e pistas de alto contraste. Em celular, verificar apenas a orientação para PC e a ausência de carregamento 3D.
- Revisão dos controles, mapa, linguagem visual, limites de assets e plano de desempenho com base nos resultados.

Critérios de passagem: todas as 14 entregas obrigatórias da seção 25 apresentadas e validadas; mecânicas principais compreendidas com os tutoriais permitidos; nenhum bloqueio conhecido na cooperação; viabilidade demonstrada nos dispositivos de referência. Registrar ajustes e retestar os problemas encontrados.

Testes automatizados e autoavaliação técnica não substituem o teste com pessoas. Se participantes ainda não estiverem disponíveis, registrar essa pendência e limitar o trabalho às melhorias de pré-produção e prototipagem.

### Etapa 4 — Produção da Parte 1 e transição para o jogo

Implementar em três entregas menores:

1. Cenas 1–2: apresentação, transformação de “Calado”, nascimento e escola, estabelecendo a linguagem do scroll.
2. Cenas 3–6: UFBA, construção de soluções, mão do mercado e UFMG, com amadurecimento gradual e fatos fornecidos.
3. Cenas 7–8: encontro dos três, “Observar. Escutar. Construir.”, identidade final, ruptura da logo e descida da câmera para o prólogo jogável.

Incluir português/inglês, composição responsiva, modo de movimento reduzido e carregamento do jogo próximo ao final da história. Se o carregamento não terminar a tempo, usar uma transição visual com progresso medido.

Conclusão: todas as cenas funcionam ao avançar, retroceder e redimensionar a página; o crescimento é perceptível; a transição libera os controles apenas quando o mundo estiver pronto. Definir o ponto de entrega do scroll ao jogo para evitar que o scroll posterior desfaça acidentalmente o estado jogável.

### Etapa 5 — Produção do prólogo e das três regiões

Produzir e validar uma região por vez, reaproveitando os sistemas comprovados:

1. **Prólogo:** pedestal quebrado, rastros de luz, movimento, pulo e descoberta contextual da primeira ponte.
2. **Jardim das Aparências:** caminhos falsos, estrutura verdadeira, sustentação de Mizaru, ponte permanente construída por Calado, reflexos ilusórios e primeiro fragmento.
3. **Cidade do Ruído:** sensores, ondas e máquinas; três automações com cooperação crescente; redução permanente do ruído e segundo fragmento.
4. **Oficina das Ideias Inacabadas:** fluxo de dados/impacto social, sistema entre três ilhas e organização de acervo; participação complementar do trio e terceiro fragmento.

Conclusão por região: desafio compreensível sem explicações narrativas, transformação persistente do ambiente, pontos seguros funcionais, companheiros estáveis e recursos carregados/liberados corretamente. Avaliar o ritmo acumulado para a duração de 8–15 minutos, sem contar a exploração opcional posterior.

### Etapa 6 — Templo, Conexões e exploração posterior

Entregas:

- Retorno ao templo e desafio com Mizaru e Kikazaru sustentando habilidades simultaneamente enquanto Calado reconstrói os três fragmentos.
- Restauração visual e musical, pose final e saída espontânea dos personagens, sem frase ou tela de vitória.
- Área Conexões com portais de GitHub, LinkedIn, e-mail, currículo e projetos publicados, usando ícones e prévias.
- Novos caminhos, projetos adicionais, símbolos tecnológicos, referências geográficas e pequenas interações após a conclusão.

Conclusão: percurso completo solucionável, regiões revisitáveis e links verdadeiros acessíveis apenas por interação intencional nos portais descobertos. Testar abertura de páginas/documentos em nova aba e definir o comportamento do e-mail conforme o destino fornecido; um endereço `mailto:` depende do aplicativo de e-mail configurado. Nenhum destino será disparado somente por aproximação.

### Etapa 7 — Acabamento, compatibilidade e preparação de publicação

Entregas:

- Substituição de assets provisórios por arte e áudio finais, com autoria/licenças registradas.
- Otimização de modelos, texturas, regiões, sombras, partículas, resolução e áudio.
- Revisão completa de teclado, mouse, remapeamento, contraste, redução de movimento, controles de volume e equivalência de pistas. Gamepad é adicional, condicionado à viabilidade.
- Metadados, Open Graph, imagem social do trio, dados estruturados básicos e conteúdo indexável estritamente necessário com fatos verificados.
- Revisão das traduções da Parte 1 e das instruções, limpeza de placeholders e validação dos destinos externos.
- Verificação de produção, roteiro de teste completo e documentação de execução, assets e limitações conhecidas.

Conclusão: experiência integral verificada nos dispositivos escolhidos, sem bloqueios conhecidos de progressão ou conteúdo fictício. Preparar instruções de implantação; a publicação depende da definição do destino e da autorização correspondente.

## 3. Rastreabilidade da pré-produção obrigatória

Os itens abaixo correspondem à seção 25 da especificação, ajustados para o escopo PC definido pelo usuário. A cobertura implementada e as validações ainda pendentes estão registradas em [VALIDACAO.md](docs/preproducao/VALIDACAO.md); testes com participantes não foram realizados.

| Item | Entrega exigida | Etapa de produção | Validação |
| --- | --- | --- | --- |
| 1 | Conceito visual dos três macacos | 1 | Coerência de espécie, expressividade e identidade |
| 2 | Estudos de cor das três pelagens | 1 | Paletas plausíveis e distinção além da cor |
| 3 | Storyboard da Parte 1 | 1 | Oito cenas, cronologia e crescimento |
| 4 | Animatic das transições acadêmicas/profissionais | 1 | Continuidade e reversibilidade |
| 5 | Storyboard sem texto da Parte 2 | 1 | Leitura da ação sem explicação narrativa |
| 6 | Mapa de Jardim, Cidade, Oficina e Templo | 1 | Percurso compacto e retornos claros |
| 7 | Fluxo de troca de personagens | 2 | Troca direta/cíclica e câmera contínua |
| 8 | Protótipo de sustentação por companheiro | 2 | Poder permanece durante a troca |
| 9 | Protótipo da ponte de Mizaru | 2 | Revelação, travessia e permanência |
| 10 | Protótipo da área de Kikazaru | 2 | Obstáculo alterado e leitura sem áudio |
| 11 | Protótipo de construção por Calado | 2 | Pré-condições e resultado funcional |
| 12 | Teste com pessoas sem explicação prévia | 3 | Observação real, problemas e correções |
| 13 | Plano de otimização desktop | 1–3 | Medição no protótipo e limites ajustados |
| 14 | Lista de modelos, animações, efeitos, sons e ilustrações | 1 | Inventário com dependências de produção |

## 4. Arquitetura proposta

A seleção parte das tecnologias sugeridas na especificação. Versões e compatibilidades serão verificadas ao iniciar a Etapa 2, antes de instalar dependências.

| Responsabilidade | Escolha inicial | Delimitação |
| --- | --- | --- |
| Página pública e idiomas | Next.js + TypeScript | Estrutura pública, textos, metadados e carregamento do cliente |
| História por scroll | GSAP + ScrollTrigger | Progresso reversível, cenas, câmera e transições |
| Mundo 3D | Three.js + React Three Fiber | Renderização, regiões, personagens e efeitos |
| Física | Rapier | Colisões, controlador de personagem e gatilhos |
| Estado compartilhado | Zustand | Progresso, seleção, habilidades, tutorial e preferências |
| Modelos e animações | Blender → GLTF/GLB | Modelagem própria, rig, clipes e exportação |
| Áudio | Web Audio API | Mixagem por categoria, camadas, transições e posição espacial |
| Interface | CSS Modules | Controles, carregamento e ajustes mínimos |

Microinterações simples começam com CSS. Framer Motion ou Howler.js poderão ser incorporados se os protótipos mostrarem uma necessidade concreta; não são dependências obrigatórias do plano.

Organização prevista:

```text
src/
  app/                   página pública, idiomas e metadados
  features/story/        timeline, oito cenas e passagem ao 3D
  features/game/
    world/               ciclo do mundo, regiões e carregamento
    characters/          movimento, troca e animação
    companions/          seguir, sustentar, recuperar e gesticular
    abilities/           revelar, silenciar e construir
    camera/              acompanhamento, troca e transições
    physics/             colisões, gatilhos e pontos seguros
    puzzles/             pré-condições e estados dos desafios
    audio/               ambientes, personagens e cooperação
    tutorial/            instruções contextuais e aprendizado
    ui/                  controles, retratos e configurações
  content/               biografia, traduções e destinos verificados
  state/                 progresso e preferências
  performance/           níveis gráficos e gestão de recursos
public/assets/           ilustrações, modelos, texturas e áudio
docs/                    storyboards, decisões, inventário e validações
```

Essa estrutura orienta a implementação modular iniciada. Pastas são criadas conforme há responsabilidades reais; módulos das regiões finais ainda serão acrescentados. Transformações contínuas de física e animação permanecem no ciclo do jogo; estado compartilhado registra mudanças relevantes, evitando renderizações React a cada frame.

## 5. Decisões que os protótipos precisam resolver

### Sustentação, troca e recuperação

Proposta inicial de estados por personagem: controlado, seguindo, sustentando e recuperando. Seleção ativa e estado da habilidade são tratados separadamente.

- Enquanto controlado, manter o comando da habilidade ativa o poder.
- Trocar com um poder sustentável ativo, em um ponto válido, mantém o personagem naquele ponto; o botão não precisa continuar pressionado depois da troca.
- O personagem recém-selecionado passa ao controle; o terceiro segue, salvo se também estiver sustentando.
- A sustentação termina automaticamente quando o desafio deixa de depender dela e o grupo pode prosseguir com segurança.
- Reselecionar um sustentador deve permitir retomar seu controle sem interromper o poder involuntariamente. Validar a regra de liberação no protótipo e ensiná-la apenas como controle, quando necessário.
- Reposicionamento restaura o grupo e os poderes necessários a um estado seguro, preservando construções já concluídas e fragmentos recuperados.

Há uma ambiguidade entre a troca livre das seções 5/26 e a redação da seção 16 sobre selecionar um personagem em sustentação. A interpretação proposta preserva a troca livre e a sustentação do personagem anterior; seu comportamento será demonstrado na Etapa 2 antes da produção integral.

Usar rotas simples, pontos seguros e conexões de salto para os companheiros. Uma ponte revelada precisa atualizar tanto sua colisão quanto sua disponibilidade de navegação. Personagens sustentando não podem ser removidos pelo descarregamento de uma região ainda necessária ao desafio.

### Controles, acessibilidade e carregamento

- Desktop: WASD/setas, mouse, espaço, E/Enter, 1–3, Q e R, conforme a especificação. Definir o botão de habilidade na Etapa 2 e permitir remapeamento.
- Tutoriais desaparecem após a ação aprendida; nenhum objetivo escrito permanece no mundo.
- Nomes acessíveis para controles e portais podem existir na camada semântica, associados ao elemento disponível naquele contexto. Isso não deve criar uma lista global de links ou revelar destinos antes da descoberta.
- Preferências de operação ficam acessíveis pelos controles mínimos de configuração/pausa, sem oferecer navegação alternativa pelo conteúdo.
- Redução de movimento preserva a sequência da história e as mecânicas, reduzindo parallax, tremor, partículas e movimentos de câmera. Pistas combinam forma, movimento moderado, contraste e som opcional.
- Navegador sem suporte 3D recebe uma indicação operacional de incompatibilidade; não substituir o jogo por um catálogo. Definir os navegadores suportados a partir das medições.
- Progresso de carregamento deve refletir recursos efetivamente carregados ou etapas mensuráveis de preparação, sem temporizador fingindo percentual de download.

## 6. Inventário inicial de produção

| Categoria | Conteúdo necessário | Observação |
| --- | --- | --- |
| Referências existentes | Duas logos PNG fornecidas | Base de identidade, não modelos jogáveis |
| Personagens | Trio adulto e evolução de Calado | Definir reutilização de rig e variações de proporção |
| Animações | Parado, caminhada, corrida se adotada, pulo, queda, recuperação, poses, poderes, sustentação, construção, gestos, reações e final | Silhueta legível durante os gestos |
| História | Escola, ambientes UFBA/UFMG, mão metafórica, objetos de estudo/trabalho e encontro | Produzir por cena, compartilhando linguagem e elementos |
| Mundo | Templo, Jardim, Cidade, Oficina e Conexões | Kits modulares com identidade regional |
| Interações | Pontes, peças, circuitos, máquinas, sensores, fluxos, acervo, fragmentos e portais | Cada objeto precisa de estados visuais claros |
| Efeitos | Wireframes dourados, ilusões, ondas, silêncio, encaixes, dados, ruptura e reconstrução | Ajustar por qualidade no PC |
| Áudio | Temas do trio, motivos combináveis, ambientes, passos, poderes, máquinas e descobertas | Produção/licenciamento pendentes; sem fala |
| Interface | Silhuetas, estados de poder, ícones, comandos de teclado/mouse e progresso | Operação acessível em PT/EN |
| Conteúdo profissional | Links, currículo, miniaturas e prévias de projetos | Depende de materiais e destinos reais |
| Divulgação | Imagem Open Graph com o trio | Derivada da identidade visual validada |

Na Etapa 1, expandir cada item com responsável ou origem, formato, licença, prioridade, estados/animações necessários, limite de tamanho e critério de aceitação. Modelos provisórios validam comportamento; não encerram a entrega artística.

## 7. Desempenho e estratégia de verificação

Metas iniciais de planejamento, a confirmar no protótipo: buscar 60 fps em computador intermediário. Não são resultados já medidos. Escolher dispositivos e navegadores concretos antes da validação da Etapa 3.

- Carregar primeiro a história; iniciar o download do runtime, modelos e áudio do jogo apenas próximo à transição. Evitar que imports ou preloads antecipem o pacote 3D.
- Carregar regiões progressivamente e liberar recursos sem interromper companheiros, habilidades ou desafios ativos.
- Usar modelos de baixa/média densidade, texturas comprimidas, Meshopt ou Draco e instancing nos objetos repetidos.
- Definir níveis baixo/médio/alto com limites de pixel ratio, sombras, partículas e efeitos. Medir custo de GPU, memória, chamadas de desenho, peso transferido e tempo até interação.
- Pausar simulação, animações e áudio ao ocultar a aba; retomar sem saltos de física ou comandos presos.
- Medir em builds de produção, redes limitadas e orientação vertical/horizontal. Os limites numéricos de assets serão fixados após o protótipo representativo.

Verificações previstas: tipos, lint e build; testes direcionados às transições de sustentação, progresso e reposicionamento; ensaios integrados de travessia/construção e transição história–jogo; revisão visual/manual de narrativa, controles e desempenho. Testar especificamente travamentos e perda de progresso. Não criar testes que apenas repitam a implementação de elementos estáticos.

O teste com pessoas deve observar compreensão sem explicações adicionais, necessidade de ajuda, quedas, hesitações e tempo de conclusão. Repeti-lo quando houver mudanças materiais nas pistas ou mecânicas que falharam.

## 8. Pendências e limites de escopo

Nenhuma das pendências abaixo impede iniciar a pré-produção com a especificação disponível. Elas precisam ser resolvidas antes das entregas correspondentes:

| Pendência | Necessária para | Status |
| --- | --- | --- |
| Validar redação biográfica e fornecer datas, caso sejam usadas | Textos finais da Parte 1; preservar a trajetória fornecida | Feito |
| Fornecer GitHub, LinkedIn, e-mail, currículo e URLs de projetos | Portais reais da Etapa 6 | Currículo HTML fornecido; destinos extraídos para src/content/profile.ts, ainda sem portais públicos |
| Selecionar projetos e fornecer imagens/prévias autorizadas | Conteúdo visual de Conexões e exploração posterior | pendente |
| Definir produção e disponibilidade de modelos, animações e sons | Arte e áudio finais; começar com estudos/protótipos | pendente |
| Disponibilizar participantes e dispositivos de referência | Validação obrigatória da Etapa 3 | Referências fornecidas: página GTA 6 e https://bruno-simon.com/. Sessões com pessoas e especificação do PC de referência ainda pendentes; os sites não substituem esses testes |
| Definir domínio e hospedagem | Configuração final de SEO e implantação | Após produção inicial |

Não há requisito de backend, autenticação, CMS, multiplayer, analytics ou persistência entre visitas. O plano inicial usa conteúdo local e progresso da sessão. Checkpoints seguros são necessários; salvar e retomar entre visitas seria uma decisão adicional, sem criar atalhos para conteúdo ainda não descoberto.

Próxima entrega: **Etapa 3 — validar e refinar a pré-produção e o protótipo**, usando o caderno `/estudo`, o animatic e o trecho jogável em `/`. A implementação integral das regiões e da arte final só avança após essa validação. Consulte o README para executar os materiais e o protocolo em `docs/preproducao/VALIDACAO.md`.
