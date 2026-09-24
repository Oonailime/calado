import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/content/story";
import { useGame } from "../state/store";
import { TROPHIES, type TrophyId } from "../state/trophies";
import styles from "./Game.module.css";

type PickupKind = "banana" | "wood" | TrophyId;
type Pickup = { id: number; kind: PickupKind };

export const PICKUP_VISIBLE_MS = 5_000;

function collected(items: readonly boolean[]) {
  return items.filter(Boolean).length;
}

function BananaIcon() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path
        d="M7 7.5c1.6 8.8 7.4 14.1 16.4 12.8-3.5 5.5-9.7 7.5-14.5 3.9C4.6 21 3.8 14.1 7 7.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="m6.2 6.1 3-1.4" stroke="currentColor" strokeWidth="3" />
    </svg>
  );
}

function WoodIcon() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path
        d="m7 23 14.8-15 4.2 4.2-15 14.7Z"
        fill="currentColor"
        opacity=".82"
      />
      <path d="m5.6 17.2 3.5-3.5 9.2 9.2-3.5 3.5Z" fill="currentColor" />
      <path d="m22 8 4 4" stroke="#f2d3a1" strokeWidth="1.4" />
    </svg>
  );
}

function ItemIcon({ kind }: { kind: PickupKind }) {
  if (kind === "banana") return <BananaIcon />;
  if (kind === "wood") return <WoodIcon />;
  return <svg viewBox="0 0 32 32" aria-hidden="true">
    <path d="M9 5h14v8c0 6-14 6-14 0Z" fill="currentColor" />
    <path d="M9 8H5v4c0 4 4 5 6 5M23 8h4v4c0 4-4 5-6 5M16 19v6M10 27h12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>;
}

export default function Inventory({ locale }: { locale: Locale }) {
  const bananas = useGame((state) => state.puzzle.bananas);
  const logs = useGame((state) => state.puzzle.logs);
  const bridge = useGame((state) => state.puzzle.bridge);
  const [pickups, setPickups] = useState<Pickup[]>([]);
  const [bananaCounterVisible, setBananaCounterVisible] = useState(false);
  const [woodCounterVisible, setWoodCounterVisible] = useState(false);
  const nextId = useRef(0);
  const pt = locale === "pt";

  useEffect(() => {
    useGame.getState().hydrateChessTrophies();
    useGame.getState().hydrateBananaTrophy();
    let previousTrophies = useGame.getState().chessTrophies;
    let previousBananaTrophy = useGame.getState().bananaTrophy;
    let previous = useGame.getState().puzzle;
    const activeTimers = new Map<number, number>();
    let bananaCounterTimer: number | undefined;
    let woodCounterTimer: number | undefined;
    const unsubscribe = useGame.subscribe((state) => {
      const bananaDelta =
        collected(state.puzzle.bananas) - collected(previous.bananas);
      const woodDelta = collected(state.puzzle.logs) - collected(previous.logs);
      previous = state.puzzle;
      const newTrophies = state.chessTrophies.filter(id => !previousTrophies.includes(id));
      previousTrophies = state.chessTrophies;
      const newBananaTrophy = state.bananaTrophy && !previousBananaTrophy;
      previousBananaTrophy = state.bananaTrophy;

      // The counters themselves only surface around a collect/use event (see
      // PICKUP_VISIBLE_MS) instead of sitting on screen permanently; each new
      // event within that window restarts its own 5s countdown.
      if (bananaDelta !== 0) {
        setBananaCounterVisible(true);
        window.clearTimeout(bananaCounterTimer);
        bananaCounterTimer = window.setTimeout(
          () => setBananaCounterVisible(false),
          PICKUP_VISIBLE_MS,
        );
      }
      if (woodDelta !== 0) {
        setWoodCounterVisible(true);
        window.clearTimeout(woodCounterTimer);
        woodCounterTimer = window.setTimeout(
          () => setWoodCounterVisible(false),
          PICKUP_VISIBLE_MS,
        );
      }
      if (bananaDelta <= 0 && woodDelta <= 0 && !newTrophies.length && !newBananaTrophy) return;

      const additions: Pickup[] = [];
      for (let index = 0; index < bananaDelta; index += 1)
        additions.push({ id: nextId.current++, kind: "banana" });
      for (let index = 0; index < woodDelta; index += 1)
        additions.push({ id: nextId.current++, kind: "wood" });
      for (const kind of newTrophies) additions.push({ id: nextId.current++, kind });
      if (newBananaTrophy) additions.push({ id: nextId.current++, kind: "all-bananas" });
      setPickups((current) => [...current, ...additions]);

      additions.forEach((pickup) => {
        const timer = window.setTimeout(() => {
          activeTimers.delete(pickup.id);
          setPickups((current) =>
            current.filter((item) => item.id !== pickup.id),
          );
        }, PICKUP_VISIBLE_MS);
        activeTimers.set(pickup.id, timer);
      });
    });

    return () => {
      unsubscribe();
      activeTimers.forEach((timer) => window.clearTimeout(timer));
      activeTimers.clear();
      window.clearTimeout(bananaCounterTimer);
      window.clearTimeout(woodCounterTimer);
    };
  }, []);

  const bananaCount = collected(bananas);
  const woodCount = collected(logs);
  return (
    <>
      <div
        className={styles.inventory}
        role="group"
        aria-label={pt ? "Inventário" : "Inventory"}
      >
        {bananaCounterVisible && (
          <div
            className={`${styles.inventoryItem} ${styles.inventoryBanana}`}
            data-item="banana"
          >
            <BananaIcon />
            <span>Bananas</span>
            <strong>
              {bananaCount}/{bananas.length}
            </strong>
          </div>
        )}
        {!bridge && woodCounterVisible && (
          <div
            className={`${styles.inventoryItem} ${styles.inventoryWood}`}
            data-item="wood"
          >
            <WoodIcon />
            <span>{pt ? "Madeiras" : "Timber"}</span>
            <strong>
              {woodCount}/{logs.length}
            </strong>
          </div>
        )}
      </div>
      <div className={styles.pickupFeed} aria-live="polite">
        {pickups
          .filter((pickup) => !bridge || pickup.kind !== "wood")
          .map((pickup) => (
            <div
              key={pickup.id}
              data-pickup={pickup.kind}
              className={`${styles.pickup} ${
                pickup.kind === "banana"
                  ? styles.inventoryBanana
                  : pickup.kind === "wood" ? styles.inventoryWood : styles.inventoryTrophy
              }`}
              style={{ color: TROPHIES.find(trophy => trophy.id === pickup.kind)?.color }}
            >
              <ItemIcon kind={pickup.kind} />
              <span aria-hidden="true">
                {pickup.kind === "banana" ? "+1 banana" : pickup.kind === "wood" ? (pt ? "+1 madeira" : "+1 timber") :
                  `${pt ? "Troféu" : "Trophy"}: ${pickup.kind === "all-bananas" && !pt ? "All bananas" : TROPHIES.find(trophy => trophy.id === pickup.kind)?.name}`}
              </span>
              <span className={styles.visuallyHidden}>
                {pickup.kind === "banana"
                  ? pt
                    ? "Banana coletada"
                    : "Banana collected"
                  : pickup.kind === "wood"
                    ? pt ? "Madeira coletada" : "Timber collected"
                    : `${pt ? "Troféu conquistado" : "Trophy earned"}: ${pickup.kind === "all-bananas" && !pt ? "All bananas" : TROPHIES.find(trophy => trophy.id === pickup.kind)?.name}`}
              </span>
            </div>
          ))}
      </div>
    </>
  );
}

export function TrophyCollection({ locale }: { locale: Locale }) {
  const trophies = useGame(state => state.chessTrophies);
  const bananaTrophy = useGame(state => state.bananaTrophy);
  const pt = locale === "pt";
  return (
    <section className={styles.trophyCollection} aria-label={pt ? "Troféus" : "Trophies"}>
      <h3>{pt ? "Troféus conquistados" : "Earned trophies"}</h3>
      <ul>
        {TROPHIES.map(trophy => {
          const earned = trophy.id === "all-bananas" ? bananaTrophy : trophies.includes(trophy.id);
          const label = trophy.id === "all-bananas"
            ? pt ? "Todas as bananas" : "All bananas"
            : `${pt ? "Xadrez" : "Chess"} · ${trophy.name}`;
          return <li key={trophy.id} data-trophy={trophy.id} data-earned={earned}
            style={{ color: earned ? trophy.color : undefined }}>
            <ItemIcon kind={trophy.id} />
            <span>{label}</span>
            <strong>{earned ? pt ? "Conquistado" : "Earned" : pt ? "Pendente" : "Missing"}</strong>
          </li>;
        })}
      </ul>
    </section>
  );
}
