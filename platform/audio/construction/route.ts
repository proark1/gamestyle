import { getBinding } from '@/db/index';
import { isGameId } from '@/shared/audio/construction/types';
import { library, manifest, updateAudio } from './service';
import * as storage from '@/shared/audio/construction/storage';
import { createAudioRoutes } from '@/shared/audio/http';

const routes = createAudioRoutes({
  isGame: isGameId,
  library: (game) => library(getBinding(), game),
  manifest,
  update: (game, body) => updateAudio(getBinding(), game, body, storage),
});
export const GET = routes.GET;
export const POST = routes.POST;
