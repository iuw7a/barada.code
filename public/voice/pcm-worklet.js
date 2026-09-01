// pcm-worklet.js — Barada voice capture worklet.
// Converts mic Float32 samples to PCM16 and posts them to the main thread.
// Safari ignores AudioContext({ sampleRate: 24000 }), so the target rate is
// passed in via processorOptions and we resample linearly here.
class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const opts = (options && options.processorOptions) || {};
    this.inputRate = opts.inputSampleRate || sampleRate; // hardware rate
    this.targetRate = opts.targetSampleRate || 24000;
    this.ratio = this.inputRate / this.targetRate;
  }

  process(inputs) {
    const input = inputs[0] && inputs[0][0];
    if (!input) return true;

    const outLength = Math.floor(input.length / this.ratio);
    const pcm16 = new Int16Array(outLength);
    for (let i = 0; i < outLength; i++) {
      const sample = input[Math.floor(i * this.ratio)] || 0;
      pcm16[i] = Math.max(-32768, Math.min(32767, Math.round(sample * 32767)));
    }
    this.port.postMessage(pcm16.buffer, [pcm16.buffer]);
    return true;
  }
}

registerProcessor("barada-pcm-capture", PcmCaptureProcessor);
