/**
 * ClaySoundManager - Procedural Web Audio API sound synthesizer
 * Simulates the meditative, soft, grainy friction of sculpting clay, sand, or ceramics.
 */

class ClaySoundManager {
  private audioCtx: AudioContext | null = null;
  private noiseNode: AudioWorkletNode | ScriptProcessorNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  private gainNode: GainNode | null = null;
  private isPlaying: boolean = false;
  private targetGain: number = 0;
  private currentGain: number = 0;
  private enabled: boolean = true;

  constructor() {
    // Sound is lazy-initialized on first interaction
  }

  private initAudio() {
    if (this.audioCtx) return;

    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
      
      // Create a noise source using a ScriptProcessorNode (extremely widely supported for custom synthesis)
      const bufferSize = 4096;
      this.noiseNode = this.audioCtx.createScriptProcessor(bufferSize, 1, 1);
      
      // Fill the buffer with white noise + low frequency rumble
      let lastOut = 0.0;
      this.noiseNode.onaudioprocess = (e) => {
        const output = e.outputBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          // Apply a very basic brown/pink low-pass filter in code to make it deeper
          lastOut = 0.95 * lastOut + 0.05 * white;
          
          // Add minor crackle
          const crackle = Math.random() > 0.995 ? (Math.random() * 0.5 - 0.25) : 0;
          output[i] = lastOut + crackle;
        }
      };

      // Create filter
      this.filterNode = this.audioCtx.createBiquadFilter();
      this.filterNode.type = 'bandpass';
      this.filterNode.frequency.setValueAtTime(350, this.audioCtx.currentTime);
      this.filterNode.Q.setValueAtTime(1.5, this.audioCtx.currentTime);

      // Create gain node
      this.gainNode = this.audioCtx.createGain();
      this.gainNode.gain.setValueAtTime(0, this.audioCtx.currentTime);

      // Connect nodes: Noise -> Filter -> Gain -> Destination
      this.noiseNode.connect(this.filterNode);
      this.filterNode.connect(this.gainNode);
      this.gainNode.connect(this.audioCtx.destination);

      // Start the processor loop
      this.isPlaying = true;
      this.animateGain();
    } catch (e) {
      console.warn("Web Audio API not supported or blocked by browser policies.", e);
    }
  }

  public toggle(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled && this.isPlaying) {
      this.targetGain = 0;
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public start() {
    if (!this.enabled) return;
    this.initAudio();

    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    this.targetGain = 0.15; // Soft volume base
    if (this.filterNode && this.audioCtx) {
      this.filterNode.frequency.setTargetAtTime(250, this.audioCtx.currentTime, 0.1);
    }
  }

  public updateSpeed(speed: number) {
    if (!this.enabled || !this.audioCtx || !this.gainNode || !this.filterNode) return;

    // Map speed to sound volume and frequency
    const clampedSpeed = Math.min(Math.max(speed, 0), 10);
    const speedRatio = clampedSpeed / 10;

    // Map speed to bandpass frequency (faster movement = slightly higher pitch)
    const targetFreq = 200 + speedRatio * 500;
    this.filterNode.frequency.setTargetAtTime(targetFreq, this.audioCtx.currentTime, 0.05);

    // Map speed to gain (faster movement = more noise)
    this.targetGain = 0.05 + speedRatio * 0.25;
  }

  public stop() {
    this.targetGain = 0;
  }

  private animateGain() {
    if (!this.isPlaying) return;

    const step = () => {
      if (!this.isPlaying) return;

      // Smooth interpolation for gain to avoid audio popping
      const diff = this.targetGain - this.currentGain;
      if (Math.abs(diff) > 0.005) {
        this.currentGain += diff * 0.15;
        if (this.gainNode) {
          this.gainNode.gain.setValueAtTime(this.currentGain, this.audioCtx?.currentTime || 0);
        }
      } else if (this.currentGain !== this.targetGain) {
        this.currentGain = this.targetGain;
        if (this.gainNode) {
          this.gainNode.gain.setValueAtTime(this.currentGain, this.audioCtx?.currentTime || 0);
        }
      }

      requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
  }
}

export const claySoundManager = new ClaySoundManager();
