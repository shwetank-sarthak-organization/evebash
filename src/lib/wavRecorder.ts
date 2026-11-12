// Voice notes as WAV for browsers that can't record AAC (Firefox records only WebM/Opus, which iPhones can't play,
// issue #107). Raw microphone audio is captured with the Web Audio API and packed as 16 kHz mono 16-bit PCM:
// clear for speech, about 1.9 MB a minute, and plays on every phone and browser.

export const WAV_SAMPLE_RATE = 16_000;

/** Averages the input down to `outputRate` (speech needs nothing above 8 kHz) and writes a 16-bit mono WAV file. */
export function encodeWav(chunks: Float32Array[], inputRate: number, outputRate = WAV_SAMPLE_RATE): ArrayBuffer {
    const inputLength = chunks.reduce((n, c) => n + c.length, 0);
    const input = new Float32Array(inputLength);
    let offset = 0;
    for (const chunk of chunks) {
        input.set(chunk, offset);
        offset += chunk.length;
    }

    const ratio = Math.max(1, inputRate / outputRate);
    const rate = Math.round(inputRate / ratio);
    const outputLength = Math.floor(inputLength / ratio);
    const buffer = new ArrayBuffer(44 + outputLength * 2);
    const view = new DataView(buffer);
    const text = (at: number, value: string) => { for (let i = 0; i < value.length; i++) view.setUint8(at + i, value.charCodeAt(i)); };

    text(0, "RIFF");
    view.setUint32(4, 36 + outputLength * 2, true);
    text(8, "WAVE");
    text(12, "fmt ");
    view.setUint32(16, 16, true);       // fmt chunk size
    view.setUint16(20, 1, true);        // PCM
    view.setUint16(22, 1, true);        // mono
    view.setUint32(24, rate, true);
    view.setUint32(28, rate * 2, true); // bytes per second
    view.setUint16(32, 2, true);        // bytes per sample frame
    view.setUint16(34, 16, true);       // bits per sample
    text(36, "data");
    view.setUint32(40, outputLength * 2, true);

    for (let i = 0; i < outputLength; i++) {
        const start = Math.floor(i * ratio);
        const end = Math.min(inputLength, Math.floor((i + 1) * ratio));
        let sum = 0;
        for (let j = start; j < end; j++) sum += input[j];
        const sample = Math.max(-1, Math.min(1, sum / Math.max(1, end - start)));
        view.setInt16(44 + i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    }
    return buffer;
}

// Copies each block of microphone samples to the page (an AudioWorklet runs off the main thread)
const CAPTURE_WORKLET = `
class EvebashCapture extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel) this.port.postMessage(channel.slice(0));
    return true;
  }
}
registerProcessor("evebash-capture", EvebashCapture);
`;

export type WavRecording = { stop: () => Promise<Blob>; cancel: () => void };

/** Starts capturing the stream; stop() returns the WAV file and releases the microphone. */
export async function startWavRecording(stream: MediaStream): Promise<WavRecording> {
    const context = new AudioContext();
    const source = context.createMediaStreamSource(stream);
    const chunks: Float32Array[] = [];
    let node: AudioNode;
    let moduleUrl: string | null = null;

    if (context.audioWorklet) {
        moduleUrl = URL.createObjectURL(new Blob([CAPTURE_WORKLET], { type: "application/javascript" }));
        await context.audioWorklet.addModule(moduleUrl);
        const worklet = new AudioWorkletNode(context, "evebash-capture");
        worklet.port.onmessage = (event: MessageEvent<Float32Array>) => { chunks.push(event.data); };
        node = worklet;
    } else {
        // Older browsers without AudioWorklet
        const processor = context.createScriptProcessor(4096, 1, 1);
        processor.onaudioprocess = (event) => { chunks.push(event.inputBuffer.getChannelData(0).slice(0)); };
        node = processor;
    }
    // Connected through a muted gain so the browser keeps processing without playing the voice back
    const mute = context.createGain();
    mute.gain.value = 0;
    source.connect(node);
    node.connect(mute);
    mute.connect(context.destination);

    const release = () => {
        source.disconnect();
        node.disconnect();
        stream.getTracks().forEach((track) => track.stop());
        if (moduleUrl) URL.revokeObjectURL(moduleUrl);
        void context.close();
    };

    return {
        async stop() {
            const rate = context.sampleRate;
            release();
            return new Blob([encodeWav(chunks, rate)], { type: "audio/wav" });
        },
        cancel: release,
    };
}
