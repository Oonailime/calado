export default function WorldMap() {
  return (
    <svg
      viewBox="0 0 1000 610"
      role="img"
      aria-label="Mapa de produção: do templo ao Jardim, à Cidade, à Oficina e de volta ao Templo; Conexões ao sul após a reconstrução."
    >
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M40 0H0V40" fill="none" stroke="#7c8a7133" />
        </pattern>
        <marker
          id="arrow"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M0 0L10 5 0 10" fill="#69714c" />
        </marker>
      </defs>
      <rect width="1000" height="610" fill="url(#grid)" />
      <path
        d="M425 275Q290 245 235 200 M300 130Q500 25 730 150 M802 222Q900 310 797 370 M675 418Q555 455 516 343"
        fill="none"
        stroke="#6f774f"
        strokeWidth="3"
        markerEnd="url(#arrow)"
      />
      <path
        d="M495 355V490"
        stroke="#6f774f"
        strokeWidth="3"
        strokeDasharray="6 8"
        markerEnd="url(#arrow)"
      />
      <path
        d="M260 205L470 280 M740 220L530 280 M735 390L545 335"
        stroke="#8b8d6a"
        strokeWidth="2"
        strokeDasharray="4 10"
      />
      <ellipse cx="230" cy="153" rx="127" ry="78" fill="#bdab72" />
      <ellipse cx="764" cy="155" rx="125" ry="80" fill="#b6bdad" />
      <ellipse cx="763" cy="401" rx="135" ry="85" fill="#ae9072" />
      <circle cx="495" cy="295" r="90" fill="#8b9a7d" />
      <circle
        cx="495"
        cy="295"
        r="68"
        fill="none"
        stroke="#e6dfbd"
        strokeWidth="2"
      />
      <rect x="415" y="490" width="160" height="62" rx="31" fill="#b7bc8c" />
      <g
        fill="#2b3c2d"
        fontFamily="Georgia, serif"
        fontSize="23"
        textAnchor="middle"
      >
        <text x="230" y="155">
          Jardim
        </text>
        <text x="764" y="157">
          Cidade
        </text>
        <text x="763" y="404">
          Oficina
        </text>
        <text x="495" y="301">
          Templo
        </text>
        <text x="495" y="529" fontSize="20">
          Conexões
        </text>
      </g>
      <g
        fill="#586247"
        fontFamily="Arial, sans-serif"
        fontSize="10"
        letterSpacing="2"
        textAnchor="middle"
      >
        <text x="230" y="181">
          APARÊNCIA → ESTRUTURA
        </text>
        <text x="764" y="184">
          RUÍDO → RITMO
        </text>
        <text x="763" y="433">
          FRAGMENTOS → SISTEMA
        </text>
        <text x="495" y="325">
          PARTIDA / RETORNO
        </text>
      </g>
      <text x="35" y="570" fontSize="11" fontFamily="Arial" fill="#56614c">
        Traço contínuo: primeira conclusão · pontilhado: retornos e abertura
        posterior · escala conceitual
      </text>
    </svg>
  );
}
