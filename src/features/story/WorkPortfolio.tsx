"use client";

import { useRef, useState } from "react";
import type { Locale } from "@/content/story";
import {
  portfolio,
  TERMINAL77_EMBED,
  TERMINAL77_POST,
} from "@/content/portfolio";
import styles from "./WorkPortfolio.module.css";

const paths = {
  justice: "M16 5v23M9 28h14M5 11h22M7 11l-4 9h8l-4-9Zm18 0-4 9h8l-4-9Z",
  terminal: "M5 9l7 7-7 7M16 24h11",
  study:
    "M16 9c-4-3-9-3-13-2v19c5-1 9 0 13 2m0-19c4-3 9-3 13-2v19c-5-1-9 0-13 2V9Z",
  travel:
    "M5 26c0-8 22-1 22-10S16 9 16 9M16 9c0-8-10-8-10-2 0 4 5 8 5 8s5-4 5-6ZM23 25l4 3 3-5",
  app: "M10 3h12a3 3 0 0 1 3 3v20a3 3 0 0 1-3 3H10a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3ZM13 7h6M14 25h4M11 15l3 3 7-7",
  books: "M4 7h6v21H4ZM12 4h6v24h-6ZM21 8l5-1 4 20-5 1ZM4 23h6M12 23h6",
};

function easedReveal(reveal: number, index = 0) {
  const progress = Math.max(0, Math.min(1, (reveal - index * 0.12) / 0.4));
  return progress * progress * (3 - 2 * progress);
}

function revealStyle(progress: number) {
  return {
    opacity: progress,
    filter: `blur(${(1 - progress) * 7}px)`,
    transform: `translateY(${(1 - progress) * 12}px)`,
  };
}

export default function WorkPortfolio({
  locale,
  reveal,
}: {
  locale: Locale;
  reveal: number;
}) {
  const pt = locale === "pt";
  const dialog = useRef<HTMLDialogElement>(null);
  const [showPost, setShowPost] = useState(false);
  return (
    <section
      className={styles.portfolio}
      aria-label={pt ? "Portfólio de projetos" : "Project portfolio"}
    >
      <div className={styles.heading}>
        <h2 style={revealStyle(easedReveal(reveal))}>
          {pt ? "Projetos selecionados" : "Selected projects"}
        </h2>
      </div>
      <div className={styles.grid}>
        {portfolio.map((project, i) => {
          const cardReveal = easedReveal(reveal, i);
          return (
            <article
              key={project.id}
              className={styles.card}
              style={revealStyle(cardReveal)}
              inert={cardReveal < 0.05}
            >
              <a
                href={project.url}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.projectLink}
              >
                <div className={styles.art}>
                  <svg
                    viewBox="0 0 32 32"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <path d={paths[project.symbol]} />
                  </svg>
                  <span>0{i + 1}</span>
                  <span className={styles.arrow} aria-hidden="true">
                    ↗
                  </span>
                </div>
                <h3>{project.name}</h3>
                <p>{project[locale]}</p>
                <div className={styles.tags}>{project.tags.join(" · ")}</div>
                <span className={styles.visit}>
                  {project.kind === "site"
                    ? pt
                      ? "Visitar site"
                      : "Visit website"
                    : pt
                      ? "Ver no GitHub"
                      : "View on GitHub"}{" "}
                  ↗
                </span>
              </a>
              {project.id === "terminal77" && (
                <button
                  className={styles.postButton}
                  onClick={() => {
                    setShowPost(true);
                    dialog.current?.showModal();
                  }}
                >
                  {pt ? "O relato no LinkedIn" : "The story on LinkedIn"} ↗
                </button>
              )}
            </article>
          );
        })}
      </div>
      <dialog
        ref={dialog}
        className={styles.dialog}
        onClose={() => setShowPost(false)}
        aria-labelledby="terminal77-title"
        onClick={(event) => {
          if (event.target === event.currentTarget) dialog.current?.close();
        }}
      >
        <header>
          <h2 id="terminal77-title">Quiz Inter · Terminal 77</h2>
          <button
            autoFocus
            aria-label={pt ? "Fechar publicação" : "Close post"}
            onClick={() => dialog.current?.close()}
          >
            ×
          </button>
        </header>
        <p>{portfolio[1][locale]}</p>
        {showPost && (
          <iframe
            src={TERMINAL77_EMBED}
            height="668"
            width="504"
            loading="lazy"
            allowFullScreen
            title={
              pt
                ? "Publicação sobre o Quiz Inter Terminal 77"
                : "Post about the Inter Terminal 77 quiz"
            }
          />
        )}
        <a href={TERMINAL77_POST} target="_blank" rel="noopener noreferrer">
          {pt ? "Abrir publicação no LinkedIn" : "Open post on LinkedIn"} ↗
        </a>
      </dialog>
    </section>
  );
}
