document.getElementById('listenBtn').addEventListener('click', async () => {
  const statusDiv = document.getElementById('status');
  statusDiv.textContent = "Requesting microphone access...";

  try {
    // 1. Request microphone access.
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    statusDiv.textContent = "Microphone access granted. Recording audio...";

    // 2. Create an AudioContext and load the AudioWorklet module.
    const audioContext = new AudioContext();
    await audioContext.audioWorklet.addModule('audioWorkletRecorder.js');

    // 3. Create an AudioWorkletNode for our recorder processor.
    const recorderNode = new AudioWorkletNode(audioContext, 'audio-recorder-processor');
    let audioChunks = [];
    recorderNode.port.onmessage = (event) => {
      audioChunks.push(event.data); // event.data is a Float32Array
    };

    // Connect the microphone stream to the recorder.
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(recorderNode);
    // (We don't need to connect recorderNode to destination if live playback is not desired.)

    // 4. Record for 5 seconds.
    setTimeout(async () => {
      statusDiv.textContent = "Recording stopped. Preparing WAV file...";
      // Disconnect nodes and stop the stream.
      source.disconnect();
      recorderNode.disconnect();
      await audioContext.close();
      stream.getTracks().forEach(track => track.stop());

      // Flatten the collected audio chunks.
      const flatSamples = flattenArray(audioChunks);
      // Use audioContext's sampleRate or set your desired rate (e.g., 44100).
      const sampleRate = 44100;
      const wavBuffer = encodeWAV(flatSamples, sampleRate);
      const wavBlob = new Blob([wavBuffer], { type: "audio/wav" });

      // 5. Get aria descriptions from the active tab via content script.
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        // Filter to ensure we use a non-extension page.
        const normalTabs = tabs.filter(tab => tab.url && !tab.url.startsWith("chrome-extension://"));
        if (normalTabs.length === 0) {
          statusDiv.textContent = "No target webpage found.";
          return;
        }
        const targetTab = normalTabs[0];
        chrome.tabs.sendMessage(targetTab.id, { action: "getAriaDescriptions" }, (response) => {
          if (!response || !response.ariaDescriptions) {
            statusDiv.textContent = "Could not retrieve aria descriptions from target page.";
            return;
          }
          // 6. Prepare a FormData object.
          const formData = new FormData();
          formData.append("audio", wavBlob, "command.wav");
          formData.append("aria_descriptions", JSON.stringify(response.ariaDescriptions));

          statusDiv.textContent = "Uploading data to Lambda...";

          // 7. Call your Lambda endpoint.
          fetch("https://o3vzz2i7riuoc3ipkbvyyf7rki0eviup.lambda-url.us-west-2.on.aws/", {
            method: "POST",
            body: formData
          })
            .then(res => res.json())
            .then(data => {
              statusDiv.textContent = "Lambda response received.";
              // You can now use data.action to automate on the active page.
              chrome.tabs.sendMessage(targetTab.id, { action: "performAction", details: data.action });
            })
            .catch(err => {
              console.error("Error calling Lambda:", err);
              statusDiv.textContent = "Error calling Lambda.";
            });
        });
      });
    }, 5000);
  } catch (error) {
    console.error("Error accessing microphone:", error);
    statusDiv.textContent = `Error: ${error.name} - ${error.message}`;
  }
});

/* Helper function to flatten an array of Float32Arrays into one Float32Array. */
function flattenArray(chunks) {
  let length = chunks.reduce((acc, cur) => acc + cur.length, 0);
  let result = new Float32Array(length);
  let offset = 0;
  for (let chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

/* Encode a Float32Array as a mono, 16-bit PCM WAV file. */
function encodeWAV(samples, sampleRate) {
  const samplesInt16 = floatTo16BitPCM(samples);
  const buffer = new ArrayBuffer(44 + samplesInt16.length * 2);
  const view = new DataView(buffer);

  /* RIFF header */
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + samplesInt16.length * 2, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, samplesInt16.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samplesInt16.length; i++, offset += 2) {
    view.setInt16(offset, samplesInt16[i], true);
  }
  return buffer;
}

/* Convert a Float32Array to a 16-bit PCM Int16Array. */
function floatTo16BitPCM(float32Array) {
  const output = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    let s = Math.max(-1, Math.min(1, float32Array[i]));
    output[i] = s < 0 ? s * 32768 : s * 32767;
  }
  return output;
}

/* Write an ASCII string to a DataView at a given offset. */
function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}