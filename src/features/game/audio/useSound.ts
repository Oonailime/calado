import { useEffect, useRef } from "react";
import { runtime, useGame } from "../state/store";

const MUSIC_TRACKS = [
  "/assets/audio/music/we-trust.mp3",
  "/assets/audio/music/eye-of-the-storm.mp3",
  "/assets/audio/music/godsend.mp3",
  "/assets/audio/music/making-a-wish.mp3",
];
const FOOTSTEPS_URL = "/assets/audio/footsteps/monkey-gravel.wav";

const MUSIC_SCALE = 0.6;
const EFFECTS_SCALE = 0.6;
const FOOTSTEP_SCALE = 0.8;
const VOLUME_TIME_CONSTANT = 0.3;
const FOOTSTEP_TIME_CONSTANT = 0.15;
const FOOTSTEP_SPEED_THRESHOLD = 0.3;
const MUSIC_DUCK_FACTOR = 0.45;
const MUSIC_DUCK_TIME_CONSTANT = 0.6;

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
  effectsGain: GainNode;
  footstepGain: GainNode;
  musicElement: HTMLAudioElement;
  musicIndex: number;
  footstepSource: AudioBufferSourceNode | null;
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

  const effectsGain = context.createGain();
  effectsGain.gain.value = 0;
  effectsGain.connect(masterGain);

  const footstepGain = context.createGain();
  footstepGain.gain.value = 0;
  footstepGain.connect(effectsGain);

  const musicElement = new Audio();
  musicElement.preload = "auto";
  const musicSource = context.createMediaElementSource(musicElement);
  musicSource.connect(musicGain);

  const state: PersistentAudio = {
    context,
    masterGain,
    musicGain,
    effectsGain,
    footstepGain,
    musicElement,
    musicIndex: -1,
    footstepSource: null,
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
function playMizaruArpeggio(context: AudioContext, destination: GainNode) {
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
function playCaladoClunk(context: AudioContext, destination: GainNode) {
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
    const silenced = puzzle.powers[1];
    state.musicGain.gain.setTargetAtTime(
      ambient * MUSIC_SCALE * (silenced ? MUSIC_DUCK_FACTOR : 1),
      now,
      silenced ? MUSIC_DUCK_TIME_CONSTANT : VOLUME_TIME_CONSTANT,
    );
    state.effectsGain.gain.setTargetAtTime(
      effects * EFFECTS_SCALE,
      now,
      VOLUME_TIME_CONSTANT,
    );
  }, [running, muted, ambient, effects, puzzle.powers]);

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
      playMizaruArpeggio(state.context, state.effectsGain);
    if (puzzle.built && !prev.built)
      playCaladoClunk(state.context, state.effectsGain);
    if (puzzle.powers[1] && !prev.silence)
      playKikazaruChime(state.context, state.effectsGain);
    if (puzzle.unlocked && !prev.unlocked)
      playCaladoClunk(state.context, state.effectsGain);
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
