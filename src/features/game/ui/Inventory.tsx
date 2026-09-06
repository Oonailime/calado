import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/content/story";
import { useGame } from "../state/store";
import styles from "./Game.module.css";

type PickupKind = "banana" | "wood";
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
  return kind === "banana" ? <BananaIcon /> : <WoodIcon />;
}

export default function Inventory({ locale }: { locale: Locale }) {
  const bananas = useGame((state) => state.puzzle.bananas);
  const logs = useGame((state) => state.puzzle.logs);
  const bridge = useGame((state) => state.puzzle.bridge);
  const [pickups, setPickups] = useState<Pickup[]>([]);
  const nextId = useRef(0);
  const pt = locale === "pt";

  useEffect(() => {
    let previous = useGame.getState().puzzle;
    const activeTimers = new Map<number, number>();
    const unsubscribe = useGame.subscribe((state) => {
      const bananaDelta =
        collected(state.puzzle.bananas) - collected(previous.bananas);
      const woodDelta = collected(state.puzzle.logs) - collected(previous.logs);
      previous = state.puzzle;
      if (bananaDelta <= 0 && woodDelta <= 0) return;

      const additions: Pickup[] = [];
      for (let index = 0; index < bananaDelta; index += 1)
        additions.push({ id: nextId.current++, kind: "banana" });
      for (let index = 0; index < woodDelta; index += 1)
        additions.push({ id: nextId.current++, kind: "wood" });
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
        {!bridge && (
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
                  : styles.inventoryWood
              }`}
            >
              <ItemIcon kind={pickup.kind} />
              <span aria-hidden="true">+1</span>
              <span className={styles.visuallyHidden}>
                {pickup.kind === "banana"
                  ? pt
                    ? "Banana coletada"
                    : "Banana collected"
                  : pt
                    ? "Madeira coletada"
                    : "Timber collected"}
              </span>
            </div>
          ))}
      </div>
    </>
  );
}
