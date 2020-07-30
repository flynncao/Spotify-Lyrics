import { Event, Options } from '../common/consts';
import { sendEvent, events } from '../common/ga';
import { PopupStore } from '../popup/store';

import { renderLyricsWithCanvas, RenderOptions } from './canvas-renderer';
import { renderLyricsWithSVG } from './svg-renderer';
import { coverCanvas, lyricCtx, audioPromise } from './element';
import { sharedData } from './share-data';
import { optionsPromise } from './options';
import { appendStyle } from './utils';
import { localConfig } from './config';

import './pip';
import './observer';

const INTERVAL = 80;

let options: Options;

const update = async () => {
  const audio = await audioPromise;

  const isOnlyCover = options['only-cover'] === 'on';
  const isSmoothScroll = options['lyrics-smooth-scroll'] === 'on';
  const isOpen = !!document.pictureInPictureElement;
  const { width, height } = lyricCtx.canvas;

  const drawCover = () => {
    lyricCtx.canvas.width = width;
    lyricCtx.drawImage(coverCanvas, 0, 0, width, height);
  };

  const renderOptions: RenderOptions = {
    focusLineFontSize: Number(options['font-size']),
    align: options['lyrics-align'],
  };

  if (isOnlyCover) {
    drawCover();
  } else if (isSmoothScroll) {
    drawCover();
    renderLyricsWithCanvas(lyricCtx, sharedData.lyrics, audio.currentTime, renderOptions);
  } else {
    const img = await renderLyricsWithSVG(
      lyricCtx,
      sharedData.lyrics,
      audio.currentTime,
      renderOptions,
    );
    drawCover();
    img && lyricCtx.drawImage(img, 0, 0, width, height);
  }

  if (isSmoothScroll && isOpen && sharedData.lyrics?.length) {
    requestAnimationFrame(update);
  } else {
    setTimeout(update, INTERVAL);
  }
};

optionsPromise.then((opts) => {
  options = opts;
  update();

  sendEvent(opts.cid, events.startUp);

  // https://github.com/w3c/manifest/pull/836
  window.addEventListener('appinstalled', () => {
    sendEvent(opts.cid, events.installAsPWA);
  });
});

window.addEventListener('message', async ({ data }: MessageEvent) => {
  if (!document.pictureInPictureElement) return;
  if (!data?.type) return;

  switch (data.type) {
    case Event.GET_SONGS:
      return sharedData.sendToContentScript();
    case Event.SELECT_SONG:
      return sharedData.chooseLyricsTrack(data.data as PopupStore);
    case Event.CONFIRMED_SONG:
      return sharedData.confirmedMId();
    default:
      return;
  }
});

appendStyle(localConfig.STATIC_STYLE);

if (localConfig.SERVICE_WORKER) {
  navigator.serviceWorker.getRegistration().then((reg) => {
    if (!reg) {
      navigator.serviceWorker.register(localConfig.STATIC_STYLE);
    }
  });
}
