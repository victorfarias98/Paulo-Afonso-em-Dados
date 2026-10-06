# Vídeo — Paulo Afonso em Dados

Apresentação de 60 segundos em português, com narração sintética natural e trilha instrumental original. Duas composições independentes: `Vertical` (1080 × 1920) e `Horizontal` (1920 × 1080), 30 fps. MP4 H.264, áudio AAC stereo e pixels 4:2:0. Os títulos e explicações permanecem na tela para leitura sem som.

O roteiro e a legenda sugerida para Instagram estão em [docs/video-script.md](../docs/video-script.md). A peça apresenta a plataforma no ar, explica a atualização automática e divulga o endereço publicado. Cartões são ilustrações das consultas, sem métricas fictícias nem avaliação de vereadores.

## Reproduzir

Este pacote fica fora do workspace do portal e fora da imagem Docker de produção. Requer Node 22 ou superior, npm e Chrome. O padrão local usa `/opt/google/chrome/chrome`; defina `REMOTION_BROWSER_EXECUTABLE` para outro executável compatível.

```sh
npm --prefix video ci
npm --prefix video test
npm --prefix video run typecheck
npm --prefix video run studio
npm --prefix video run preview
npm --prefix video run render
# Repetir somente um formato:
npm --prefix video run render -- --only=Vertical
```

Saídas em `video/out/`: dois MP4 completos, capas PNG, legendas SRT e quadros para revisão. A pasta de saídas não entra no Git. Preserve os arquivos de entrega ao transferir o projeto. As legendas SRT distribuem os tempos por frase; os textos principais estão incorporados ao vídeo.

As animações usam GSAP através de `@remotion/gsap`, que sincroniza uma timeline pausada com os frames do Remotion. Não há relógio independente, CSS animations ou dependência do banco. Fontes Lato são locais, com licença em `public/Lato-LICENSE.txt`; a ilustração e a marca vêm do próprio portal.

## Áudio

`scripts/generate-music.py` sintetiza uma trilha original de 60 segundos, 96 BPM, stereo PCM16 / 44.1 kHz. Pode ser reproduzido com Python padrão. `public/music.wav` é o master; a mixagem deixa a trilha discreta sob a voz.

`scripts/generate-narration.py` gera oito falas em português brasileiro usando Edge TTS, voz `pt-BR-FranciscaNeural`. Requer `edge-tts`, conexão de rede e FFmpeg/FFprobe para conferir duração. Os áudios gerados ficam no pacote e o render final não precisa consultar o serviço de voz. `public/narration-timing.json` registra textos e durações; cada fala deve caber na cena com margens de entrada e saída.

Antes de compartilhar, confira o vídeo com áudio e a legenda de publicação. A mensagem distingue apresentação de propostas, qualidade do mandato e execução de obras. A consulta parlamentar é datada e não representa todos os trabalhos do vereador.

Referências de implementação: [animações por frame](https://www.remotion.dev/docs/the-fundamentals) e [GSAP sincronizado ao Remotion](https://www.remotion.dev/docs/gsap/use-gsap-timeline).
