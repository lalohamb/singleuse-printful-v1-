// Module-level singleton — created once, never garbage collected
let _audio: HTMLAudioElement | null = null;

export function getAudio(): HTMLAudioElement {
  if (!_audio) {
    _audio = new Audio();
    _audio.preload = "auto";
  }
  return _audio;
}
