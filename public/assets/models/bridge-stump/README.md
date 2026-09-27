# Toco de construção

Modelo fornecido pelo usuário em `assets_referencia/toco_construção/toco_martelo_talhado.glb`.
Inclui o toco e o martelo talhado da nova referência, com a geometria, UVs e materiais PBR originais.

`scripts/prepare-bridge-stump.py` exporta `carved-stump.glb` com texturas de até 2048 px,
largura de 1,16 m, centro horizontal na origem e base no chão (Y = 0).
O GLB original é preservado. Cor e normal redimensionadas são exportadas em PNG;
o mapa de rugosidade/metálico de 2048 px é preservado sem nova compressão JPEG.
O sampler da cor usa filtragem linear sem mipmaps: os mipmaps desse atlas misturavam
as bordas das ilhas UV e produziam riscos claros sobre a casca. Os demais mapas e
as sombras continuam ativos.

Usado à direita da ponte da primeira ilha, no ponto de construção de Iwazaru.
No jogo, o conjunto e sua colisão usam escala de 50% (largura visual de 0,58 m).

Posição mundial: `(2.54, 1.2, -3.88)`, com a base apoiada no solo da ilha. Rotação: 90° no sentido horário,
visto de cima (`Y = -π/2`). O ponto de interação acompanha essa posição.
