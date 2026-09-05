export type Locale = "pt" | "en";
export const story = [
  {
    id: "birth",
    title: "Nascimento",
    pt: "Meu nome é Emiliano Calado.",
    en: "My name is Emiliano Calado.",
    note: "Escuro → palavra → silhueta. A mão encontra a boca pela primeira vez.",
    growth: 0.52,
  },
  {
    id: "school",
    title: "Escola",
    pt: "Tudo começou com curiosidade.",
    en: "It all began with curiosity.",
    note: "Lápis e cadernos formam caminhos. O bebê explora, erra e se torna criança.",
    growth: 0.63,
  },
  {
    id: "science",
    title: "Ciência e Tecnologia · UFBA",
    pt: "Na UFBA, descobri como os conhecimentos se conectam.",
    en: "At UFBA, I discovered how knowledge connects.",
    note: "Formas escolares viram órbitas e estruturas. Bacharelado Interdisciplinar, 2020–2024.",
    growth: 0.77,
  },
  {
    id: "engineering",
    title: "Engenharia da Computação · UFBA",
    pt: "E comecei a construir minhas próprias respostas.",
    en: "And I began building my own answers.",
    note: "Órbitas se tornam circuitos. Graduação em andamento; não representar diploma concluído.",
    growth: 0.86,
  },
  {
    id: "work",
    title: "O mercado de trabalho",
    pt: "As ideias encontraram problemas reais.",
    en: "Ideas met real-world problems.",
    note: "Mão acolhedora transporta Calado entre automações, sistemas e colaboração. Não atribuir datas não fornecidas.",
    growth: 0.92,
  },
  {
    id: "mobility",
    title: "Ciência da Computação · UFMG",
    pt: "Novos horizontes. Mais caminhos para aprender.",
    en: "New horizons. More paths to learn.",
    note: "Mobilidade acadêmica em 2026.2. Montanhas e circuitos partilham o horizonte.",
    growth: 1,
  },
  {
    id: "trio",
    title: "O encontro",
    pt: "Observar. Escutar. Construir.",
    en: "Observe. Listen. Build.",
    note: "Trio ocupa a composição clássica. Não apresentar seus poderes na biografia.",
    growth: 1,
  },
  {
    id: "rupture",
    title: "A ruptura",
    pt: "Emiliano Calado",
    en: "Emiliano Calado",
    note: "Composição ganha profundidade, perde cor e se fragmenta. Câmera desce; o visitante assume o trio.",
    growth: 1,
  },
] as const;

export const gameFrames = [
  {
    title: "Prólogo",
    kind: 0,
    note: "Pedestal rompido; o trio observa rastros. Pequeno desnível convida ao primeiro salto.",
  },
  {
    title: "Jardim",
    kind: 1,
    note: "Olhos cobertos → estrutura dourada → Calado atravessa e torna a ponte permanente.",
  },
  {
    title: "Cidade",
    kind: 2,
    note: "Ouvidos cobertos → ondas dissipadas → máquina estabilizada e automatizada.",
  },
  {
    title: "Oficina",
    kind: 3,
    note: "Conexões reveladas + fluxo estabilizado → peças organizadas por Calado.",
  },
  {
    title: "Templo",
    kind: 4,
    note: "Duas sustentações simultâneas → três fragmentos reconstruídos → cor retorna.",
  },
  {
    title: "Conexões",
    kind: 5,
    note: "Trio caminha até portais simbólicos. Aproximar revela prévia; interagir abre o destino.",
  },
] as const;
