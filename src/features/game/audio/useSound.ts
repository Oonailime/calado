import { useEffect, useRef } from "react";
import { useGame } from "../state/store";

const AMBIENT_SCALE = 0.035;
const EFFECTS_SCALE = 0.6;
const VOLUME_TIME_CONSTANT = 0.3;
const ZONE_TIME_CONSTANT = 2.5;
const REACTIVE_TIME_CONSTANT = 0.4;
const SHIMMER_TIME_CONSTANT = 1.2;

const ZONE_TONES = [110, 130, 147, 165];
const PAD_RATIOS = [1, 1.5, 2];
const PAD_DETUNES = [0, 6, -6];
const PAD_TYPES: OscillatorType[] = ["triangle", "sine", "sine"];
const PAD_GAIN = 0.6;

const NOISE_DURATION = 2;
const NOISE_FILTER_BASE = 900;
const NOISE_FILTER_OPEN = 2400;
const NOISE_GAIN_BASE = 0.5;
const NOISE_GAIN_DUCKED = 0.05;

const LFO_FREQUENCY = 0.15;
const LFO_DEPTH = 220;

const SHIMMER_FREQUENCIES = [1760, 1780];
const SHIMMER_GAIN_ACTIVE = 0.18;

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

type NoiseLayer = {
  source: AudioBufferSourceNode;
  filter: BiquadFilterNode;
  gain: GainNode;
};
type PadLayer = { oscillators: OscillatorNode[]; gain: GainNode };
type ShimmerLayer = { oscillators: OscillatorNode[]; gain: GainNode };
type PersistentAudio = {
  context: AudioContext;
  masterGain: GainNode;
  ambientGain: GainNode;
  effectsGain: GainNode;
  noise: NoiseLayer;
  pad: PadLayer;
  lfo: OscillatorNode;
  shimmer: ShimmerLayer;
};

function zoneTone(zone: number): number {
  const index = Math.min(ZONE_TONES.length - 1, Math.max(0, Math.trunc(zone)));
  return ZONE_TONES[index];
}
function createNoiseBuffer(context: AudioContext): AudioBuffer {
  const length = Math.floor(context.sampleRate * NOISE_DURATION);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  return buffer;
}
function buildAudio(context: AudioContext, zone: number): PersistentAudio {
  const masterGain = context.createGain();
  masterGain.gain.value = 1;
  masterGain.connect(context.destination);
  const ambientGain = context.createGain();
  ambientGain.gain.value = 0;
  ambientGain.connect(masterGain);
  const effectsGain = context.createGain();
  effectsGain.gain.value = 0;
  effectsGain.connect(masterGain);

  const noiseSource = context.createBufferSource();
  noiseSource.buffer = createNoiseBuffer(context);
  noiseSource.loop = true;
  const noiseFilter = context.createBiquadFilter();
  noiseFilter.type = "lowpass";
  noiseFilter.frequency.value = NOISE_FILTER_BASE;
  noiseFilter.Q.value = 0.4;
  const noiseGain = context.createGain();
  noiseGain.gain.value = NOISE_GAIN_BASE;
  noiseSource.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(ambientGain);
  noiseSource.start();

  const padGain = context.createGain();
  padGain.gain.value = PAD_GAIN;
  padGain.connect(ambientGain);
  const center = zoneTone(zone);
  const padOscillators = PAD_RATIOS.map((ratio, i) => {
    const osc = context.createOscillator();
    osc.type = PAD_TYPES[i];
    osc.detune.value = PAD_DETUNES[i];
    osc.frequency.value = center * ratio;
    osc.connect(padGain);
    osc.start();
    return osc;
  });

  const lfo = context.createOscillator();
  lfo.type = "sine";
  lfo.frequency.value = LFO_FREQUENCY;
  const lfoDepth = context.createGain();
  lfoDepth.gain.value = LFO_DEPTH;
  lfo.connect(lfoDepth);
  lfoDepth.connect(noiseFilter.frequency);
  lfo.start();

  const shimmerGain = context.createGain();
  shimmerGain.gain.value = 0;
  shimmerGain.connect(ambientGain);
  const shimmerOscillators = SHIMMER_FREQUENCIES.map((frequency) => {
    const osc = context.createOscillator();
    osc.type = "sine";
    osc.frequency.value = frequency;
    osc.connect(shimmerGain);
    osc.start();
    return osc;
  });

  return {
    context,
    masterGain,
    ambientGain,
    effectsGain,
    noise: { source: noiseSource, filter: noiseFilter, gain: noiseGain },
    pad: { oscillators: padOscillators, gain: padGain },
    lfo,
    shimmer: { oscillators: shimmerOscillators, gain: shimmerGain },
  };
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
  const zone = useGame((s) => s.zone);
  const audio = useRef<PersistentAudio | null>(null);
  const previous = useRef({ bridge: false, built: false, silence: false });
  useEffect(() => {
    if (muted || !running) {
      void audio.current?.context.suspend();
      return;
    }
    if (!audio.current) audio.current = buildAudio(new AudioContext(), zone);
    void audio.current.context.resume();
    const state = audio.current;
    const now = state.context.currentTime;
    state.ambientGain.gain.setTargetAtTime(
      ambient * AMBIENT_SCALE,
      now,
      VOLUME_TIME_CONSTANT,
    );
    state.effectsGain.gain.setTargetAtTime(
      effects * EFFECTS_SCALE,
      now,
      VOLUME_TIME_CONSTANT,
    );
    const center = zoneTone(zone);
    state.pad.oscillators.forEach((osc, i) => {
      osc.frequency.setTargetAtTime(
        center * PAD_RATIOS[i],
        now,
        ZONE_TIME_CONSTANT,
      );
    });
    const silenced = puzzle.powers[1];
    state.noise.gain.gain.setTargetAtTime(
      silenced ? NOISE_GAIN_DUCKED : NOISE_GAIN_BASE,
      now,
      REACTIVE_TIME_CONSTANT,
    );
    state.noise.filter.frequency.setTargetAtTime(
      silenced ? NOISE_FILTER_OPEN : NOISE_FILTER_BASE,
      now,
      REACTIVE_TIME_CONSTANT,
    );
    state.shimmer.gain.gain.setTargetAtTime(
      puzzle.powers[0] ? SHIMMER_GAIN_ACTIVE : 0,
      now,
      SHIMMER_TIME_CONSTANT,
    );
  }, [running, muted, ambient, effects, zone, puzzle.powers]);
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
    previous.current = {
      bridge: puzzle.bridge,
      built: puzzle.built,
      silence: puzzle.powers[1],
    };
  }, [puzzle.bridge, puzzle.built, puzzle.powers, muted, running]);
  useEffect(
    () => () => {
      const state = audio.current;
      if (state) {
        state.noise.source.stop();
        state.pad.oscillators.forEach((osc) => osc.stop());
        state.shimmer.oscillators.forEach((osc) => osc.stop());
        state.lfo.stop();
        void state.context.close();
      }
      audio.current = null;
    },
    [],
  );
}
