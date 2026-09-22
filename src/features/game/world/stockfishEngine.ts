export type StockfishElo = 800 | 1600 | 2000;

export class StockfishEngine {
  private worker: Worker | null = null;
  private ready: Promise<void> | null = null;
  private elo: StockfishElo = 800;
  private range = { min: 1320, max: 3190 };
  private waiters = new Set<{
    accept: (line: string) => boolean;
    resolve: (line: string) => void;
    reject: (error: Error) => void;
  }>();
  private searching = false;
  get effectiveElo() {
    return Math.max(this.range.min, Math.min(this.range.max, this.elo));
  }
  private wait(accept: (line: string) => boolean) {
    return new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.waiters.delete(waiter);
        reject(new Error("Stockfish não respondeu a tempo."));
      }, 30000);
      const waiter = {
        accept,
        resolve: (line: string) => {
          clearTimeout(timeout);
          resolve(line);
        },
        reject: (error: Error) => {
          clearTimeout(timeout);
          reject(error);
        },
      };
      this.waiters.add(waiter);
    });
  }
  initialize(): Promise<void> {
    if (this.ready) return this.ready;
    this.worker = new Worker("/assets/stockfish/stockfish-19-lite-single.js");
    this.worker.onmessage = ({ data }: MessageEvent<string>) => {
      if (typeof data !== "string") return;
      for (const line of data.split("\n")) {
        const range = line.match(/option name UCI_Elo .*min (\d+) max (\d+)/);
        if (range)
          this.range = { min: Number(range[1]), max: Number(range[2]) };
        for (const waiter of this.waiters)
          if (waiter.accept(line)) {
            this.waiters.delete(waiter);
            waiter.resolve(line);
          }
      }
    };
    this.worker.onerror = () => this.dispose();
    this.ready = (async () => {
      const uci = this.wait((line) => line === "uciok");
      this.worker!.postMessage("uci");
      await uci;
      this.setElo(this.elo);
      const ready = this.wait((line) => line === "readyok");
      this.worker!.postMessage("isready");
      await ready;
    })();
    return this.ready;
  }
  setElo(elo: StockfishElo) {
    this.elo = elo;
    this.worker?.postMessage("setoption name UCI_LimitStrength value true");
    this.worker?.postMessage(
      `setoption name UCI_Elo value ${this.effectiveElo}`,
    );
  }
  async getBestMove(fen: string) {
    if (this.searching) throw new Error("Já existe uma busca ativa.");
    this.searching = true;
    try {
      await this.initialize();
      const reply = this.wait((line) => line.startsWith("bestmove "));
      this.worker!.postMessage(`position fen ${fen}`);
      this.worker!.postMessage("go movetime 700");
      return (await reply).split(/\s+/)[1];
    } finally {
      this.searching = false;
    }
  }
  stop() {
    this.dispose();
  }
  dispose() {
    this.worker?.postMessage("stop");
    this.worker?.terminate();
    this.worker = null;
    this.ready = null;
    for (const waiter of this.waiters)
      waiter.reject(new Error("Partida encerrada."));
    this.waiters.clear();
  }
}
