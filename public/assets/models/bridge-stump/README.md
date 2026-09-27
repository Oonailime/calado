# Toco de construção

Modelo fornecido pelo usuário em `assets_referencia/toco_construção/toco_martelo_talhado.glb`
(148 mil triângulos, texturas de 4096 px, 15 MB). O original nunca é alterado.

`scripts/prepare-bridge-stump.py` exporta uma versão por faixa de qualidade gráfica, para
que as qualidades menores também baixem e desenhem menos:

| Qualidade      | Arquivo                  | Triângulos | Texturas |
| -------------- | ------------------------ | ---------- | -------- |
| Ultra          | `carved-stump-ultra.glb` | 40 mil     | 2048 px  |
| Alta e média   | `carved-stump-high.glb`  | 20 mil     | 1024 px  |
| Baixa          | `carved-stump-low.glb`   | 10 mil     | 512 px   |

Cada versão tem 1,16 m de largura, centro horizontal na origem e base no chão (Y = 0).
A malha é reduzida, recebe UVs novas e tem cor, relevo (geometria e mapa normal do original)
e rugosidade/metal gravados a partir do original, em JPEG. A margem da gravação estende cada
ilha de UV, então as texturas usam mipmaps sem os riscos claros que o atlas original produzia.

Recriar:
`"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --python scripts/prepare-bridge-stump.py`
(renders de revisão em `test-results/stump-*.png`).

Usado à direita da ponte da primeira ilha, no ponto de construção de Iwazaru.
No jogo, o conjunto e sua colisão usam escala de 50% (largura visual de 0,58 m).
Ao mudar a qualidade durante o jogo, o toco atual continua visível até a outra versão carregar.

Posição mundial: `(2.54, 1.2, -3.88)`, com a base apoiada no solo da ilha. Rotação: 90° no sentido horário,
visto de cima (`Y = -π/2`). O ponto de interação acompanha essa posição.
