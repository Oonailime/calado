import { useEffect, useRef } from "react";
import { runtime, useGame } from "../state/store";
import { LOCK_CODE } from "../state/rules";
import {
  binarySequenceFrame,
  buildDigitBits,
  type BinaryDigit,
} from "../world/soundCode";

const MUSIC_TRACKS = [
  "/assets/audio/music/we-trust.mp3",
  "/assets/audio/music/eye-of-the-storm.mp3",
  "/assets/audio/music/godsend.mp3",
  "/assets/audio/music/making-a-wish.mp3",
];
const FOOTSTEPS_URL = "/assets/audio/footsteps/monkey-gravel.wav";
const BINARY_AUDIO_URLS = {
  0: "/assets/audio/pulses/um-aum.mp3",
  1: "/assets/audio/pulses/a-aum.wav",
} as const satisfies Record<BinaryDigit, string>;

const MUSIC_SCALE = 0.6;
const EFFECTS_SCALE = 0.6;
const FOOTSTEP_SCALE = 0.8;
const VOLUME_TIME_CONSTANT = 0.3;
const FOOTSTEP_TIME_CONSTANT = 0.15;
const FOOTSTEP_SPEED_THRESHOLD = 0.3;
const MUSIC_MUTE_TIME_CONSTANT = 0.12;
// Mizaru still hears the score outside the code-reading mission — it only
// dips this low, relative to the normal music volume, while he's actively
// reading the wave sequence, so the binary "voice" reads clearly over it.
const MIZARU_MISSION_MUSIC_FACTOR = 0.18;
// Kikazaru's hearing is permanently dulled while he's the one selected, not
// just during a mission — quieter and low-pass filtered the whole time.
const KIKAZARU_MUSIC_FACTOR = 0.32;
const MUSIC_FILTER_NORMAL_HZ = 18000;
const MUSIC_FILTER_MUFFLED_HZ = 700;
const MUSIC_FILTER_TIME_CONSTANT = 0.25;
const BINARY_SOUND_MAX_SECONDS = 2.75;
const BINARY_SOUND_FADE_IN_SECONDS = 0.03;
const BINARY_SOUND_FADE_OUT_SECONDS = 0.25;

const ARPEGGIO_NOTES = [880, 1108.73, 1318.51];
const ARPEGGIO_PEAK = 0.12;
const ARPEGGIO_STEP = 0.09;
const ARPEGGIO_DECAY = 0.4;

const CHIME_FREQUENCY = 392;
const CHIME_FILTER_FREQUENCY = 900;
const CHIME_PEAK = 0.1;
const CHIME_DECAY = 1.1;

const CLUNK_START_FREQUENCY = 180;
const CLUNK_END_FREQUENCY = 55;
const CLUNK_PEAK = 0.2;
const CLUNK_DECAY = 0.18;

const CLICK_PEAK = 0.25;
const CLICK_DURATION = 0.07;

type PersistentAudio = {
  context: AudioContext;
  masterGain: GainNode;
  musicGain: GainNode;
  musicFilter: BiquadFilterNode;
  effectsGain: GainNode;
  footstepGain: GainNode;
  musicElement: HTMLAudioElement;
  musicIndex: number;
  footstepSource: AudioBufferSourceNode | null;
  binaryBuffers: Partial<Record<BinaryDigit, AudioBuffer>>;
};

function nextTrack(state: PersistentAudio) {
  state.musicIndex = (state.musicIndex + 1) % MUSIC_TRACKS.length;
  state.musicElement.src = MUSIC_TRACKS[state.musicIndex];
  void state.musicElement.play().catch(() => {});
}
function buildAudio(context: AudioContext): PersistentAudio {
  const masterGain = context.createGain();
  masterGain.gain.value = 1;
  masterGain.connect(context.destination);

  const musicGain = context.createGain();
  musicGain.gain.value = 0;
  musicGain.connect(masterGain);

  // Kikazaru's dulled hearing runs the score through a lowpass filter
  // instead of just turning it down, so it reads as muffled, not merely quiet.
  const musicFilter = context.createBiquadFilter();
  musicFilter.type = "lowpass";
  musicFilter.frequency.value = MUSIC_FILTER_NORMAL_HZ;
  musicFilter.connect(musicGain);

  const effectsGain = context.createGain();
  effectsGain.gain.value = 0;
  effectsGain.connect(masterGain);

  const footstepGain = context.createGain();
  footstepGain.gain.value = 0;
  footstepGain.connect(effectsGain);

  const musicElement = new Audio();
  musicElement.preload = "auto";
  const musicSource = context.createMediaElementSource(musicElement);
  musicSource.connect(musicFilter);

  const binaryBuffers: Partial<Record<BinaryDigit, AudioBuffer>> = {};
  void Promise.all(
    (Object.entries(BINARY_AUDIO_URLS) as [string, string][]).map(
      async ([rawBit, url]) => {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Could not load ${url}`);
        const buffer = await response.arrayBuffer();
        binaryBuffers[Number(rawBit) as BinaryDigit] =
          await context.decodeAudioData(buffer);
      },
    ),
  ).catch(() => undefined);

  const state: PersistentAudio = {
    context,
    masterGain,
    musicGain,
    musicFilter,
    effectsGain,
    footstepGain,
    musicElement,
    musicIndex: -1,
    footstepSource: null,
    binaryBuffers,
  };
  musicElement.addEventListener("ended", () => nextTrack(state));
  nextTrack(state);

  // Loops for the whole session; volume alone gates it on/off each frame,
  // since an AudioBufferSourceNode can only be started/stopped once.
  fetch(FOOTSTEPS_URL)
    .then((response) => response.arrayBuffer())
    .then((buffer) => context.decodeAudioData(buffer))
    .then((decoded) => {
      const source = context.createBufferSource();
      source.buffer = decoded;
      source.loop = true;
      source.connect(footstepGain);
      source.start();
      state.footstepSource = source;
    })
    .catch(() => {});

  return state;
}
function playBridgeArpeggio(context: AudioContext, destination: GainNode) {
  ARPEGGIO_NOTES.forEach((frequency, i) => {
    const start = context.currentTime + i * ARPEGGIO_STEP;
    const stop = start + ARPEGGIO_DECAY;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = "triangle";
    osc.frequency.value = frequency;
    osc.connect(gain);
    gain.connect(destination);
    gain.gain.setValueAtTime(ARPEGGIO_PEAK, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, stop);
    osc.start(start);
    osc.stop(stop + 0.05);
  });
}
function playKikazaruChime(context: AudioContext, destination: GainNode) {
  const start = context.currentTime;
  const stop = start + CHIME_DECAY;
  const osc = context.createOscillator();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  osc.type = "sine";
  osc.frequency.value = CHIME_FREQUENCY;
  filter.type = "lowpass";
  filter.frequency.value = CHIME_FILTER_FREQUENCY;
  filter.Q.value = 0.6;
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(destination);
  gain.gain.setValueAtTime(CHIME_PEAK, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, stop);
  osc.start(start);
  osc.stop(stop + 0.05);
}
function playIwazaruClunk(context: AudioContext, destination: GainNode) {
  const start = context.currentTime;
  const oscStop = start + CLUNK_DECAY;
  const osc = context.createOscillator();
  const oscGain = context.createGain();
  osc.type = "square";
  osc.frequency.setValueAtTime(CLUNK_START_FREQUENCY, start);
  osc.frequency.exponentialRampToValueAtTime(CLUNK_END_FREQUENCY, oscStop);
  osc.connect(oscGain);
  oscGain.connect(destination);
  oscGain.gain.setValueAtTime(CLUNK_PEAK, start);
  oscGain.gain.exponentialRampToValueAtTime(0.0001, oscStop);
  osc.start(start);
  osc.stop(oscStop + 0.05);

  const clickStop = start + CLICK_DURATION;
  const clickBuffer = context.createBuffer(
    1,
    Math.floor(context.sampleRate * CLICK_DURATION),
    context.sampleRate,
  );
  const data = clickBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1)
    data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const click = context.createBufferSource();
  const clickGain = context.createGain();
  click.buffer = clickBuffer;
  click.connect(clickGain);
  clickGain.connect(destination);
  clickGain.gain.setValueAtTime(CLICK_PEAK, start);
  clickGain.gain.exponentialRampToValueAtTime(0.0001, clickStop);
  click.start(start);
  click.stop(clickStop + 0.02);
}

function playBinaryPulse(
  state: PersistentAudio,
  bit: BinaryDigit,
  expectedProgress: number,
) {
  const current = useGame.getState();
  const puzzle = current.puzzle;
  const buffer = state.binaryBuffers[bit];
  if (
    !buffer ||
    state.context.state === "closed" ||
    current.muted ||
    current.paused ||
    puzzle.selected !== 0 ||
    !puzzle.powers[0] ||
    !puzzle.powers[1] ||
    puzzle.codeProgress !== expectedProgress ||
    puzzle.unlocked
  )
    return;

  const context = state.context;
  const start = context.currentTime;
  const source = context.createBufferSource();
  source.buffer = buffer;
  const duration = Math.min(buffer.duration, BINARY_SOUND_MAX_SECONDS);
  const stop = start + duration;
  const fadeOut = Math.min(BINARY_SOUND_FADE_OUT_SECONDS, duration / 3);
  const gain = context.createGain();

  // Preserve the new Aum recordings' timbre, but cap every utterance inside
  // its three-second bit window and soften the crop on the long “A” sample.
  source.connect(gain);
  gain.connect(state.effectsGain);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(
    1,
    start + Math.min(BINARY_SOUND_FADE_IN_SECONDS, duration / 4),
  );
  gain.gain.setValueAtTime(1, stop - fadeOut);
  gain.gain.exponentialRampToValueAtTime(0.0001, stop);
  source.start(start, 0, duration);
  source.stop(stop + 0.04);
}

export function useSound(running: boolean): void {
  const muted = useGame((s) => s.muted);
  const ambient = useGame((s) => s.ambientVolume);
  const effects = useGame((s) => s.effectsVolume);
  const puzzle = useGame((s) => s.puzzle);
  const audio = useRef<PersistentAudio | null>(null);
  const previous = useRef({
    bridge: false,
    built: false,
    silence: false,
    unlocked: false,
  });

  useEffect(() => {
    if (muted || !running) {
      audio.current?.musicElement.pause();
      void audio.current?.context.suspend();
      return;
    }
    if (!audio.current) audio.current = buildAudio(new AudioContext());
    void audio.current.context.resume();
    void audio.current.musicElement.play().catch(() => {});
    const state = audio.current;
    const now = state.context.currentTime;
    const mizaruSelected = puzzle.selected === 0;
    const kikazaruSelected = puzzle.selected === 1;
    // Only while Mizaru is actively reading the wave sequence — outside that
    // mission he hears the score like anyone else.
    const mizaruMissionActive =
      mizaruSelected &&
      puzzle.powers[0] &&
      puzzle.powers[1] &&
      !puzzle.unlocked;
    // Activating his own power is him covering his ears further: it silences
    // everything, not just the score.
    const kikazaruPowerActive = kikazaruSelected && puzzle.powers[1];

    const musicScale = mizaruMissionActive
      ? MUSIC_SCALE * MIZARU_MISSION_MUSIC_FACTOR
      : kikazaruSelected
        ? MUSIC_SCALE * KIKAZARU_MUSIC_FACTOR
        : MUSIC_SCALE;
    const attenuated = mizaruMissionActive || kikazaruSelected;
    state.musicGain.gain.setTargetAtTime(
      kikazaruPowerActive ? 0 : ambient * musicScale,
      now,
      attenuated || kikazaruPowerActive
        ? MUSIC_MUTE_TIME_CONSTANT
        : VOLUME_TIME_CONSTANT,
    );
    state.musicFilter.frequency.setTargetAtTime(
      kikazaruSelected ? MUSIC_FILTER_MUFFLED_HZ : MUSIC_FILTER_NORMAL_HZ,
      now,
      MUSIC_FILTER_TIME_CONSTANT,
    );
    state.effectsGain.gain.setTargetAtTime(
      kikazaruPowerActive ? 0 : effects * EFFECTS_SCALE,
      now,
      kikazaruPowerActive ? MUSIC_MUTE_TIME_CONSTANT : VOLUME_TIME_CONSTANT,
    );
  }, [
    running,
    muted,
    ambient,
    effects,
    puzzle.powers,
    puzzle.selected,
    puzzle.unlocked,
  ]);

  // Footstep volume is gated every animation frame, since movement updates
  // on the physics loop rather than through React state.
  useEffect(() => {
    if (muted || !running) return;
    let frame: number;
    const tick = () => {
      const state = audio.current;
      if (state) {
        const selected = useGame.getState().puzzle.selected;
        const moving =
          runtime.grounded[selected] &&
          runtime.speeds[selected] > FOOTSTEP_SPEED_THRESHOLD;
        state.footstepGain.gain.setTargetAtTime(
          moving ? effects * FOOTSTEP_SCALE : 0,
          state.context.currentTime,
          FOOTSTEP_TIME_CONSTANT,
        );
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [muted, running, effects]);

  useEffect(() => {
    const state = audio.current;
    if (!state || muted || !running) return;
    const prev = previous.current;
    if (puzzle.bridge && !prev.bridge)
      playBridgeArpeggio(state.context, state.effectsGain);
    if (puzzle.built && !prev.built)
      playIwazaruClunk(state.context, state.effectsGain);
    if (puzzle.powers[1] && !prev.silence)
      playKikazaruChime(state.context, state.effectsGain);
    if (puzzle.unlocked && !prev.unlocked)
      playIwazaruClunk(state.context, state.effectsGain);
    previous.current = {
      bridge: puzzle.bridge,
      built: puzzle.built,
      silence: puzzle.powers[1],
      unlocked: puzzle.unlocked,
    };
  }, [
    puzzle.bridge,
    puzzle.built,
    puzzle.powers,
    puzzle.unlocked,
    muted,
    running,
  ]);

  // The binary voice follows the same four-bit loop as the visible waves.
  // It only plays during Mizaru's own mission, once his music has already
  // been ducked way down (see the volume effect above) so the Aum recordings
  // for A (1) and Um (0) remain intelligible over it.
  useEffect(() => {
    const state = audio.current;
    const binaryActive =
      puzzle.powers[0] &&
      puzzle.powers[1] &&
      puzzle.selected === 0 &&
      !puzzle.unlocked;
    if (!state || muted || !running || !binaryActive) return;
    const digit = LOCK_CODE[puzzle.codeProgress];
    if (digit === undefined) return;
    const bits = buildDigitBits(digit);
    let animationFrame = 0;
    let previousFrame = "";
    let initialized = false;
    const tick = () => {
      const frame = binarySequenceFrame(
        runtime.binarySequenceElapsed(puzzle.codeProgress),
      );
      const frameKey = `${frame.cycle}:${frame.bitIndex ?? "pause"}`;
      if (!initialized) {
        initialized = true;
        previousFrame = frameKey;
        // Joining in the middle of a wave must not produce a late, misleading
        // sound. A fresh sequence starts near phase zero and may play at once.
        if (frame.bitIndex !== null && frame.phase < 0.08)
          playBinaryPulse(state, bits[frame.bitIndex], puzzle.codeProgress);
      } else if (frameKey !== previousFrame) {
        previousFrame = frameKey;
        if (frame.bitIndex !== null && frame.phase < 0.08)
          playBinaryPulse(state, bits[frame.bitIndex], puzzle.codeProgress);
      }
      animationFrame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(animationFrame);
  }, [
    muted,
    puzzle.codeProgress,
    puzzle.powers,
    puzzle.selected,
    puzzle.unlocked,
    running,
  ]);
  useEffect(
    () => () => {
      const state = audio.current;
      if (state) {
        state.musicElement.pause();
        state.musicElement.removeAttribute("src");
        state.footstepSource?.stop();
        void state.context.close();
      }
      audio.current = null;
    },
    [],
  );
}
