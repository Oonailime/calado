import type { CSSProperties } from "react";

export function MonkeyGlyph({
  color = "#765039",
  pose = "mouth",
  x = 0,
  y = 0,
  scale = 1,
}: {
  color?: string;
  pose?: "eyes" | "ears" | "mouth";
  x?: number;
  y?: number;
  scale?: number;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path
        d="M30 54 C90 90 100 20 72 28 C52 31 67 56 78 43"
        fill="none"
        stroke={color}
        strokeWidth="12"
        strokeLinecap="round"
      />
      <ellipse cy="40" rx="31" ry="40" fill={color} />
      <ellipse cx="-18" cy="76" rx="18" ry="9" fill={color} />
      <ellipse cx="19" cy="76" rx="18" ry="9" fill={color} />
      <circle cx="-35" cy="-14" r="15" fill={color} />
      <circle cx="35" cy="-14" r="15" fill={color} />
      <circle cx="-35" cy="-14" r="9" fill="#d7bc92" />
      <circle cx="35" cy="-14" r="9" fill="#d7bc92" />
      <circle cy="-16" r="37" fill={color} />
      <path d="M-16-45 L2-69 L8-47 L22-56 L18-38" fill={color} />
      <path d="M0-32 C-35-55-44 15 0 18 C44 15 35-55 0-32" fill="#ead7b5" />
      <path
        d="M-21-14q7 9 13 0 M8-14q7 9 13 0"
        fill="none"
        stroke="#352c22"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      {pose === "mouth" ? (
        <>
          <path
            d="M-25 40Q-38 18 7 0"
            stroke={color}
            strokeWidth="17"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M26 35l5 18"
            stroke={color}
            strokeWidth="13"
            strokeLinecap="round"
          />
        </>
      ) : pose === "eyes" ? (
        <>
          <path
            d="M-23 41Q-46 10-13-17 M23 41Q46 10 13-17"
            stroke={color}
            strokeWidth="16"
            fill="none"
            strokeLinecap="round"
          />
        </>
      ) : (
        <path
          d="M-23 40Q-50 10-38-14 M23 40Q50 10 38-14"
          stroke={color}
          strokeWidth="15"
          fill="none"
          strokeLinecap="round"
        />
      )}
    </g>
  );
}

const colors = [
  "#121f1e",
  "#283e33",
  "#284846",
  "#153936",
  "#353330",
  "#293d41",
  "#1b3430",
  "#172826",
];
const ages = [0.52, 0.63, 0.77, 0.86, 0.92, 1, 1, 1];

// Desenhos esquemáticos em SVG: fonte editável do storyboard/animatic, não arte final.
export function SceneArt({
  scene,
  progress = 0.5,
  reduced = false,
}: {
  scene: number;
  progress?: number;
  reduced?: boolean;
}) {
  const shift = reduced ? 0 : (progress - 0.5) * 45;
  return (
    <svg
      viewBox="0 0 1200 720"
      fill="none"
      aria-hidden="true"
      style={{ background: colors[scene] } as CSSProperties}
    >
      <circle
        cx={810 + shift}
        cy="260"
        r={scene === 0 ? 140 : 190}
        fill="#e1bc79"
        opacity={scene === 0 ? 0.045 : 0.11}
      />
      <circle
        cx={810 + shift}
        cy="260"
        r="230"
        stroke="#d8be8a"
        opacity=".12"
      />
      <g opacity=".16" stroke="#d3c6a6">
        {Array.from({ length: 15 }, (_, i) => (
          <path key={i} d={`M${i * 90} 570L${600 + (i - 7) * 20} 380`} />
        ))}
        {[430, 460, 505, 570, 665].map((y) => (
          <path key={y} d={`M0 ${y}H1200`} />
        ))}
      </g>
      <g transform={`translate(${shift} 0)`}>
        {scene === 1 && (
          <g stroke="#c0a678" strokeWidth="3">
            <path
              d="M560 448V290L650 270L740 290V448L650 425Z"
              fill="#b9a681"
              opacity=".75"
            />
            <path d="M650 270V425 M580 318l46-12 M675 315l44 11 M580 346l46-12 M675 343l44 11" />
            <path d="M850 460l52-209 17 4-52 209-16 24Z" fill="#ad864a" />
            <rect
              x="966"
              y="361"
              width="86"
              height="86"
              rx="8"
              transform="rotate(13 966 361)"
            />
            <circle cx="510" cy="286" r="28" />
            <path d="M1010 230l35 60h-70Z" />
          </g>
        )}
        {(scene === 2 || scene === 3) && (
          <g stroke={scene === 2 ? "#b6c5ab" : "#76cdb3"} strokeWidth="2.5">
            <path
              d="M480 452H1090M500 426H1070M535 416V300H1015V416M520 297L775 222L1030 297Z"
              opacity=".6"
            />
            {[570, 660, 750, 840, 930].map((x) => (
              <path key={x} d={`M${x} 319v96m18-96v96`} />
            ))}
            {scene === 2 ? (
              <g transform="translate(780 220)">
                <ellipse rx="155" ry="45" />
                <ellipse rx="155" ry="45" transform="rotate(60)" />
                <ellipse rx="155" ry="45" transform="rotate(120)" />
                <circle r="13" fill="#e1bc79" />
              </g>
            ) : (
              <>
                <path d="M500 335H640V210H880V352H1080 M650 455V380H980V280 M755 270V160H1010" />
                {[640, 755, 880, 980, 1010].map((x, i) => (
                  <rect
                    key={x}
                    x={x - 13}
                    y={180 + i * 25}
                    width="26"
                    height="26"
                    fill="#1c3b34"
                  />
                ))}
              </>
            )}
          </g>
        )}
        {scene === 4 && (
          <>
            <g stroke="#bfad88" strokeWidth="2" opacity=".7">
              {Array.from({ length: 8 }, (_, i) => (
                <g
                  key={i}
                  transform={`translate(${470 + i * 77} ${220 + (i % 3) * 80}) rotate(-16)`}
                >
                  <rect width="56" height="45" rx="5" />
                  <path d="M8 15H44M8 24H30" />
                </g>
              ))}
            </g>
            <path
              d="M1200 298C1060 275 1040 300 949 362L852 415Q823 426 840 440L977 409Q962 445 858 470Q835 488 865 491L985 476Q1030 472 1080 417L1200 408"
              fill="#b3926b"
            />
            <path
              d="M790 480Q1040 568 1200 427 M810 500Q1040 588 1200 447"
              stroke="#c89d5d"
              strokeDasharray="6 14"
              opacity=".45"
            />
          </>
        )}
        {scene === 5 && (
          <>
            <path
              d="M390 465L580 255L735 399L850 199L1080 438L1200 326V600H390Z"
              fill="#6d8976"
              opacity=".4"
            />
            <path
              d="M390 465L580 255L735 399L850 199L1080 438L1200 326"
              stroke="#d5d1aa"
              opacity=".5"
            />
            <path
              d="M500 442H1060M610 442V345H960V442M640 345V290H926V345 M720 290v-30h127v30"
              stroke="#d2c8a4"
              strokeWidth="3"
            />
            <path
              d="M530 380Q770 100 1020 370"
              stroke="#dfbd7e"
              strokeDasharray="4 10"
            />
          </>
        )}
        {(scene === 6 || scene === 7) && (
          <>
            <ellipse cx="800" cy="514" rx="225" ry="54" fill="#44564a" />
            <path d="M575 510v39q225 105 450 0v-39" fill="#34483e" />
            <MonkeyGlyph
              x={670 - (scene === 7 ? progress * 40 : 0)}
              y={430 - (scene === 7 ? progress * 50 : 0)}
              color="#b98d46"
              pose="eyes"
              scale={0.86}
            />
            <MonkeyGlyph
              x={803}
              y={430 - (scene === 7 ? progress * 80 : 0)}
              color="#c2c5b8"
              pose="ears"
              scale={0.86}
            />
            <MonkeyGlyph
              x={938 + (scene === 7 ? progress * 40 : 0)}
              y={430 - (scene === 7 ? progress * 50 : 0)}
              scale={0.86}
            />
            {scene === 7 &&
              [0, 1, 2].map((i) => (
                <path
                  key={i}
                  transform={`translate(${670 + i * 132} ${240 - progress * 60}) rotate(${i * 120 + progress * 35})`}
                  d="M0-23L20 14L-20 14Z"
                  fill={["#d7b16a", "#e0e4d6", "#b78255"][i]}
                  opacity={progress}
                />
              ))}
          </>
        )}
      </g>
      {scene < 6 && (
        <g
          transform={`translate(${scene === 0 ? 780 : 770 + shift} ${scene === 4 ? 405 : 460})`}
        >
          <ellipse
            cy="85"
            rx={100 * ages[scene]}
            ry="12"
            fill="#060f10"
            opacity=".35"
          />
          <MonkeyGlyph scale={ages[scene] * (1 + progress * 0.04)} />
        </g>
      )}
      <path
        d="M0 653Q340 602 600 665T1200 653V720H0Z"
        fill="#0d1917"
        opacity=".5"
      />
      {Array.from({ length: 15 }, (_, i) => (
        <circle
          key={i}
          cx={440 + ((i * 73) % 700)}
          cy={160 + ((i * 47) % 380) - shift * (i % 3) * 0.4}
          r={(i % 3) + 1}
          fill="#ead4a4"
          opacity=".25"
        />
      ))}
    </svg>
  );
}

export function GameFrame({ kind }: { kind: number }) {
  return (
    <svg viewBox="0 0 600 340" aria-hidden="true">
      <rect
        width="600"
        height="340"
        fill={kind === 2 ? "#304244" : "#1a302b"}
      />
      <ellipse cx="300" cy="279" rx="230" ry="38" fill="#43554a" />
      <path d="M70 273l180-65 270 65-210 54Z" fill="#5a6b58" />
      {kind === 0 && (
        <g fill="#ae946c">
          <path d="M270 190l-22 60h40l-7-60Z" />
          <path d="M309 175l25 64 25-17-37-49Z" />
          <path d="M266 180l-34-21 24-28Z" />
        </g>
      )}
      {kind === 1 && (
        <>
          <path
            d="M255 246L470 177l37 18-208 72Z"
            stroke="#e3bc68"
            strokeWidth="3"
            fill="#b89c5444"
          />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <path
              key={i}
              d={`M${270 + i * 36} ${243 - i * 12}l39 18`}
              stroke="#e3bc68"
            />
          ))}
        </>
      )}
      {kind === 2 && (
        <>
          {[0, 1, 2, 3].map((i) => (
            <path
              key={i}
              d={`M${340 + i * 40} 80q${60 - i * 10} 80 0 160`}
              fill="none"
              stroke="#e2e7d8"
              strokeWidth="3"
              opacity={0.7 - i * 0.14}
            />
          ))}
          <rect x="380" y="195" width="80" height="70" fill="#829285" />
          <circle
            cx="420"
            cy="224"
            r="20"
            fill="none"
            stroke="#213b34"
            strokeWidth="7"
          />
        </>
      )}
      {kind === 3 && (
        <g fill="#ba925f" stroke="#e2cf9b">
          {Array.from({ length: 7 }, (_, i) => (
            <rect
              key={i}
              x={275 + i * 28}
              y={207 - (i % 3) * 28}
              width="24"
              height="24"
              transform={`rotate(${i < 3 ? i * 12 : 0} ${287 + i * 28} 220)`}
            />
          ))}
          <path
            d="M280 160H340V130H450V205"
            fill="none"
            stroke="#d1b871"
            strokeWidth="3"
          />
        </g>
      )}
      {kind === 4 && (
        <>
          <circle
            cx="310"
            cy="155"
            r="68"
            fill="none"
            stroke="#d4b879"
            strokeWidth="5"
          />
          <path
            d="M310 90L367 188H253Z"
            fill="none"
            stroke="#e1d5b5"
            strokeWidth="2"
          />
        </>
      )}
      {kind === 5 && (
        <g stroke="#d3bd8d" strokeWidth="3" fill="none">
          {[290, 370, 450].map((x, i) => (
            <g key={x}>
              <path d={`M${x} 248V156a26 26 0 0152 0v92`} />
              {i === 0 ? (
                <path d={`M${x + 20} 177l-10 10 10 10m12-20l10 10-10 10`} />
              ) : i === 1 ? (
                <path d={`M${x + 12} 173h28v25h-28Zm0 0 14 12 14-12`} />
              ) : (
                <path d={`M${x + 16} 172h20v30h-20Zm4 9h12m-12 7h12`} />
              )}
            </g>
          ))}
        </g>
      )}
      <MonkeyGlyph x={160} y={229} scale={0.49} color="#ba914d" pose="eyes" />
      <MonkeyGlyph x={220} y={251} scale={0.49} color="#c7c9bb" pose="ears" />
      <MonkeyGlyph
        x={kind === 1 ? 450 : 280}
        y={kind === 1 ? 206 : 273}
        scale={0.49}
      />
    </svg>
  );
}
