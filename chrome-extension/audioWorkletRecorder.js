class AudioRecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input && input[0]) {
      // Make a copy of the samples from the first channel.
      const channelData = new Float32Array(input[0]);
      this.port.postMessage(channelData);
    }
    return true;
  }
}

registerProcessor('audio-recorder-processor', AudioRecorderProcessor);