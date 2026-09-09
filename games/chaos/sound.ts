import { SiteAudio } from '../../shared/audio/construction/player';
import { ChaosAudioDirector } from './audio-director';
export class GameAudio extends SiteAudio {
  readonly director = new ChaosAudioDirector(this);
  constructor() {
    super('chaos');
  }
}
