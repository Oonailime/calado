"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { story, gameFrames } from "@/content/story";
import { SceneArt, GameFrame } from "@/features/story/SceneArt";
import SequenceArt from "@/features/story/SequenceArt";
import WorldMap from "./WorldMap";
import styles from "./Studio.module.css";
export default function Studio() {
  const [progress, setProgress] = useState(0.2);
  return (
    <main className={styles.root}>
      <header className={styles.header}>
        <span>EC / Caderno de criação</span>
        <span>Pré-produção · 01</span>
      </header>
      <div className={styles.hero}>
        <div>
          <div className={styles.eyebrow}>O Templo dos Três</div>
          <h1>
            Uma identidade.
            <br />
            Três formas de agir.
          </h1>
        </div>
        <p>
          Material interno para revisar direção de arte, ritmo e cooperação.
          Estudos e protótipos sujeitos à validação; a produção das regiões
          completas ainda não começou.
        </p>
      </div>
      <Link className={styles.link} href="/" prefetch={false}>
        Abrir animatic e protótipo ↗
      </Link>
      <section className={styles.section}>
        <div className={styles.eyebrow}>01 / Personagens & matéria</div>
        <h2>A mesma origem, gestos diferentes.</h2>
        <p>
          Orelhas arredondadas, rosto claro e mecha para cima conectam o trio à
          identidade fornecida. A cor da pelagem pertence ao personagem; a luz
          do poder pertence à ação.
        </p>
        <Image
          className={styles.concept}
          src="/assets/concepts/trio-v1.png"
          alt="Estudo dos macacos Mizaru dourado cobrindo os olhos, Kikazaru branco cobrindo os ouvidos e Calado marrom cobrindo a boca; abaixo, quatro idades de Calado e amostras de pelagem."
          width={1536}
          height={1024}
        />
        <div className={styles.characters}>
          {[
            {
              name: "Mizaru",
              colors: ["#775528", "#BD914E", "#E0BD76"],
              copy: "Silhueta esguia; passos atentos, cabeça inclinada. Olhos cobertos, malha dourada e triângulos revelam estruturas. A pelagem continua natural.",
            },
            {
              name: "Kikazaru",
              colors: ["#868C81", "#D3D4C6", "#F0EEDF"],
              copy: "Centro de gravidade baixo; movimentos redondos e estáveis. Ouvidos cobertos; círculos e ondas se anulam. O branco recebe sombra perolada.",
            },
            {
              name: "Calado",
              colors: ["#473325", "#785237", "#B37B4D"],
              copy: "Tronco firme e mãos expressivas; curioso, toca e monta. Boca coberta; quadrados se encaixam. Marrom terroso com luz cobre.",
            },
          ].map((c) => (
            <article key={c.name}>
              <h3>{c.name}</h3>
              <div className={styles.swatches}>
                {c.colors.map((color) => (
                  <span
                    key={color}
                    style={{ background: color }}
                    title={color}
                  />
                ))}
              </div>
              <p>{c.copy}</p>
            </article>
          ))}
        </div>
      </section>
      <section className={styles.section}>
        <div className={styles.eyebrow}>02 / Storyboard biográfico</div>
        <h2>O tempo contado pelo movimento.</h2>
        <p>
          Oito quadros esquemáticos, editáveis em SVG. A geometria define a
          encenação; ilustrações e modelos definitivos virão após a validação.
        </p>
        <div className={styles.frames}>
          {story.map((scene, i) => (
            <figure className={styles.frame} key={scene.id}>
              <SceneArt scene={i} />
              <figcaption>
                <strong>
                  0{i + 1} / {scene.title}
                </strong>
                {scene.note}
                <br />
                Texto: “{scene.pt}”
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
      <section className={styles.section}>
        <div className={styles.eyebrow}>03 / Animatic reversível</div>
        <h2>Da curiosidade à construção.</h2>
        <p>
          Arraste a linha do tempo nos dois sentidos. A mesma sequência está
          ligada ao scroll na experiência. Os quadros finais estudam a separação
          do trio e dos fragmentos, antes da entrada no protótipo.
        </p>
        <div className={styles.screen}>
          <SequenceArt progress={progress} />
        </div>
        <label className={styles.scrub}>
          Tempo
          <input
            type="range"
            min="0"
            max="1"
            step=".001"
            value={progress}
            onChange={(e) => setProgress(Number(e.target.value))}
            aria-label="Progresso do animatic"
          />
          <output>{Math.round(progress * 100)}%</output>
        </label>
      </section>
      <section className={styles.section}>
        <div className={styles.eyebrow}>04 / Storyboard jogável</div>
        <h2>O gesto explica. O mundo responde.</h2>
        <p>
          Os quadros não contêm texto narrativo. As anotações abaixo são
          orientações de produção e não fazem parte do jogo.
        </p>
        <div className={styles.frames}>
          {gameFrames.map((frame) => (
            <figure className={styles.frame} key={frame.kind}>
              <GameFrame kind={frame.kind} />
              <figcaption>
                <strong>{frame.title}</strong>
                {frame.note}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
      <section className={styles.section}>
        <div className={styles.eyebrow}>05 / Geografia da experiência</div>
        <h2>Sair. Transformar. Voltar.</h2>
        <div className={styles.map}>
          <WorldMap />
        </div>
        <div className={styles.notes}>
          <p>
            <strong>8–15 minutos</strong>
            <br />
            Meta para a primeira conclusão do mundo final. O protótipo atual
            testa apenas dois mecanismos em duas plataformas.
          </p>
          <p>
            <strong>Um ponto de referência</strong>
            <br />O templo orienta o percurso. Os caminhos de retorno devem
            continuar legíveis quando as regiões forem carregadas sob demanda.
          </p>
          <p>
            <strong>Descoberta preservada</strong>
            <br />
            Conexões só abre após a reconstrução. Este caderno interno não será
            disponibilizado na versão pública.
          </p>
        </div>
      </section>
      <section className={styles.section}>
        <div className={styles.eyebrow}>06 / Próxima validação</div>
        <h2>Perceber sem receber uma explicação.</h2>
        <p>
          Validar as poses, o crescimento e o ritmo visual. No protótipo,
          observar se uma pessoa descobre a ponte, mantém um companheiro no
          lugar, troca de personagem e combina duas sustentações. O protocolo e
          as pendências estão em docs/preproducao/VALIDACAO.md.
        </p>
      </section>
    </main>
  );
}
