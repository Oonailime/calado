# Validação da pré-produção

Status: materiais de revisão e protótipo disponíveis; validação artística e sessões com participantes ainda não realizadas. Não iniciar a produção integral das regiões antes de fechar esta etapa, conforme a seção 25 da especificação e a Etapa 3 do plano.

## Cobertura das 14 entregas

| Item                       | Evidência disponível                                      | Pendência de validação                               |
| -------------------------- | --------------------------------------------------------- | ---------------------------------------------------- |
| 1. Conceito do trio        | Prancha CON-01 e caderno `/estudo`                        | Revisão de silhuetas/proporções e expressividade     |
| 2. Pelagens                | Prancha e amostras com códigos no caderno                 | Leitura além da cor                                  |
| 3. Storyboard da história  | Oito quadros SVG e notas em `story.ts`                    | Encenação e continuidade biográfica                  |
| 4. Animatic                | Scroll em `/` e controle reversível no caderno            | Ritmo, dissoluções e transição de linguagem          |
| 5. Storyboard do jogo      | Seis quadros sem texto interno                            | Compreensão visual dos acontecimentos                |
| 6. Mapa                    | `WorldMap.tsx`                                            | Percurso, retornos e compactação                     |
| 7. Troca                   | Teclas 1/2/3/Q e retratos                                 | Naturalidade da troca/câmera                         |
| 8. Sustentação             | Máquina de estado, testes e execução 3D                   | Compreensão sem orientação extra                     |
| 9. Ponte                   | Revelação temporária e construção permanente              | Leitura da pista e travessia                         |
| 10. Silêncio               | Campo e obstáculo estabilizado                            | Equivalência com som desligado                       |
| 11. Construção             | Dois mecanismos e resultado persistente                   | Feedback e pré-condições compreensíveis              |
| 12. Pessoas sem explicação | Protocolo abaixo                                          | Participantes ainda não testaram                     |
| 13. Otimização             | `ASSETS.md`, níveis gráficos e telemetria somente leitura | Medição em computador de referência                  |
| 14. Inventário             | `ASSETS.md`                                               | Definir responsáveis/produção de arte e áudio finais |

## Protocolo para participantes

Sugestão: 3–5 pessoas que não conheçam as mecânicas. Registrar navegador, resolução, CPU/GPU, teclado/mouse, preferência de movimento e áudio. Não registrar nome completo ou dados pessoais desnecessários.

1. Abrir `/` no PC, oferecer somente a tarefa “explore esta experiência”. Não explicar o simbolismo nem ensinar controles fora da interface.
2. Observar avanço e retorno na história, entrada no jogo e descoberta de movimento/câmera/pulo.
3. Anotar reação ao símbolo dourado, tentativa de troca e descoberta de sustentar durante a troca.
4. Observar travessia e construção da ponte permanente. Registrar quedas, reposicionamento e companheiros presos.
5. Observar o segundo mecanismo, com Mizaru e Kikazaru sustentando simultaneamente.
6. Verificar Esc e retomada, pausa/configurações e remapeamento da habilidade.
7. Repetir as pistas essenciais com áudio desativado e com movimento reduzido/alto contraste conforme necessidade do participante.
8. Ao final, perguntar o que cada personagem permitiu fazer e quais pistas ajudaram. Não corrigir a interpretação artística como se existisse uma única resposta verbal.

Registrar em uma ficha por sessão:

| Campo                                 | Resultado   |
| ------------------------------------- | ----------- |
| Identificador anônimo / data          | A preencher |
| Dispositivo / navegador / resolução   | A preencher |
| Tempo no trecho e pontos de hesitação | A preencher |
| Movimento, câmera e pulo descobertos  | A preencher |
| Troca e sustentação compreendidas     | A preencher |
| Duas habilidades combinadas           | A preencher |
| Ajuda externa necessária              | A preencher |
| Quedas / recuperação / travamentos    | A preencher |
| Som desligado / acessibilidade        | A preencher |
| Ajustes e necessidade de reteste      | A preencher |

Critério de passagem: materiais revisados; mecânicas descobertas com as instruções operacionais permitidas; nenhum bloqueio de progressão conhecido; viabilidade medida no PC de referência. Registrar os problemas, corrigir e repetir o trecho afetado antes da produção integral.

As referências GTA VI e Bruno Simon mencionadas no plano são referências de experiência, não participantes de teste nem especificações de hardware. Essa validação continua pendente até existir observação real.

## Limitações conhecidas para revisão

- Arte e animações 3D são procedurais e provisórias. Não há modelos Blender/GLB finais.
- Animatic é esquemático; tipografia transformada em personagem e câmera 3D da logo ainda não estão produzidas.
- O áudio sintetizado valida resposta/volume/silêncio; trilha espacial e temas finais ainda não existem.
- A câmera acompanha e orbita por arrasto; o protótipo ainda não implementa uma solução geral de oclusão em ambientes fechados.
- Navegação dos companheiros atende aos dois terrenos de teste; as regiões finais precisarão de pontos e conexões próprios.
- Não há capítulos completos, portais de projetos, mundo revisitado ou persistência entre visitas.
- Remapeamento inicial cobre a habilidade F/G/H. Remapeamento de todas as ações e gamepad continuam fora desta entrega.
