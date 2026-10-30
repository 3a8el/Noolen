const heroCanvas = document.getElementById('heroCanvas');
const scrollFilm = document.querySelector('.scroll-film');

// Frames are generated from assets/video/noolen-video.mp4 by scripts/extract_hero_frames.py
const FRAME_COUNT = 233;
const frameSet = window.matchMedia('(max-width: 720px)').matches ? 'mobile' : 'desktop';
const frameSrc = (index) => `assets/frames/${frameSet}/frame_${String(index + 1).padStart(4, '0')}.webp`;

const FRAME_ASPECT = 16 / 9;

// The opening logo is wider than a phone screen, so it is shown whole (contain) and then eases
// to full-bleed (cover) as the camera pushes into the letters. These frames bracket that push:
// before ZOOM_END every frame still has a plain cream border, so the letterbox blends into the page.
const ZOOM_START = 8;
const ZOOM_END = 48;

// At the end the film draws back to the polo, which must fit a phone screen before it becomes
// the first product slide. From ZOOM_OUT_START the frame borders are plain cream again.
const ZOOM_OUT_START = 213;
const POLO_WIDTH = 0.272; // the polo's share of the last frame's width
const POLO_MAX_SCREEN_WIDTH = 0.76;

const smoothstep = (from, to, value) => {
  const t = Math.min(Math.max((value - from) / (to - from), 0), 1);
  return t * t * (3 - 2 * t);
};

// Frame heights for a viewport, in the viewport's own units.
const frameFits = (width, height) => {
  const contain = Math.min(height, width / FRAME_ASPECT);
  const cover = Math.max(height, width / FRAME_ASPECT);
  const poloFits = (width * POLO_MAX_SCREEN_WIDTH) / POLO_WIDTH / FRAME_ASPECT;
  return { contain, cover, end: Math.min(cover, Math.max(contain, poloFits)) };
};

// Height to draw the frame at for a scroll position: contain, then cover, then the polo's fit.
const frameHeight = (position, width, height) => {
  const fits = frameFits(width, height);
  const zoomIn = fits.contain + (fits.cover - fits.contain) * smoothstep(ZOOM_START, ZOOM_END, position);
  return zoomIn + (fits.end - zoomIn) * smoothstep(ZOOM_OUT_START, FRAME_COUNT - 1, position);
};

const VERTEX_SHADER = `
  attribute vec2 aPosition;
  varying vec2 vUv;
  void main() {
    vUv = vec2(aPosition.x * 0.5 + 0.5, 0.5 - aPosition.y * 0.5);
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  precision mediump float;
  uniform sampler2D uBase;
  uniform sampler2D uNext;
  uniform float uBlend;
  uniform vec2 uCover;
  varying vec2 vUv;
  // Cream behind the opening frames; the letterbox fades to it so edge pixels are not smeared.
  const vec4 FILL = vec4(250.0, 248.0, 216.0, 255.0) / 255.0;
  void main() {
    vec2 uv = (vUv - 0.5) * uCover + 0.5;
    vec4 color = mix(texture2D(uBase, uv), texture2D(uNext, uv), uBlend);
    vec2 outside = max(-uv, uv - 1.0);
    gl_FragColor = mix(color, FILL, smoothstep(0.0, 0.03, max(outside.x, outside.y)));
  }
`;

// Blends two frames in one draw on the GPU. Each frame step uploads at most one new texture,
// because whichever texture already holds a needed frame is reused.
const createWebGLRenderer = (canvas) => {
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, premultipliedAlpha: false });
  if (!gl) return null;

  const compile = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
  };

  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX_SHADER));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const aPosition = gl.getAttribLocation(program, 'aPosition');
  gl.enableVertexAttribArray(aPosition);
  gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

  const uBase = gl.getUniformLocation(program, 'uBase');
  const uNext = gl.getUniformLocation(program, 'uNext');
  const uBlend = gl.getUniformLocation(program, 'uBlend');
  const uCover = gl.getUniformLocation(program, 'uCover');

  const slots = [0, 1].map((unit) => {
    const texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return { unit, frame: -1, width: 0, height: 0 };
  });

  const upload = (slot, index, image) => {
    gl.activeTexture(gl.TEXTURE0 + slot.unit);
    // Reuse the texture's storage once allocated; reallocating on every frame step is slower.
    if (slot.width === image.width && slot.height === image.height) {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, image);
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      slot.width = image.width;
      slot.height = image.height;
    }
    slot.frame = index;
  };

  return {
    resize: () => {
      gl.viewport(0, 0, canvas.width, canvas.height);
    },
    draw: (frames, base, next, blend, scale) => {
      const baseSlot = slots.find((slot) => slot.frame === base)
        || slots.find((slot) => slot.frame !== next)
        || slots[0];
      const nextSlot = baseSlot === slots[0] ? slots[1] : slots[0];

      if (baseSlot.frame !== base) upload(baseSlot, base, frames[base]);
      if (blend > 0 && nextSlot.frame !== next) upload(nextSlot, next, frames[next]);

      const image = frames[base];
      gl.uniform2f(uCover, canvas.width / (image.width * scale), canvas.height / (image.height * scale));

      gl.uniform1i(uBase, baseSlot.unit);
      gl.uniform1i(uNext, nextSlot.unit);
      gl.uniform1f(uBlend, blend > 0 ? blend : 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
  };
};

// Fallback without WebGL: draw the nearest whole frame.
const create2DRenderer = (canvas) => {
  const context = canvas.getContext('2d');

  return {
    resize: () => {
      context.imageSmoothingQuality = 'high';
    },
    draw: (frames, base, next, blend, scale) => {
      const image = frames[blend < 0.5 ? base : next];
      const { width, height } = canvas;
      const drawWidth = image.width * scale;
      const drawHeight = image.height * scale;

      context.clearRect(0, 0, width, height);
      context.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
    }
  };
};

const wireHeroScroll = () => {
  if (!heroCanvas || !scrollFilm || !window.gsap || !window.ScrollTrigger || !window.createImageBitmap) return;

  gsap.registerPlugin(ScrollTrigger);

  const renderer = createWebGLRenderer(heroCanvas) || create2DRenderer(heroCanvas);
  const files = new Array(FRAME_COUNT);
  // Decoded frames are only kept near the scroll position: all of them would need ~2GB of memory.
  const frames = new Array(FRAME_COUNT);
  const decoding = new Set();
  const DECODE_BEHIND = 8;
  const DECODE_AHEAD = 12;
  const state = { frame: 0 };
  let drawnPosition = -1;
  let lastBase = 0;
  let direction = 1;

  const nearestDecoded = (index) => {
    for (let offset = 0; offset < FRAME_COUNT; offset += 1) {
      if (frames[index - offset]) return index - offset;
      if (frames[index + offset]) return index + offset;
    }
    return -1;
  };

  // createImageBitmap decodes off the main thread, so scrubbing never waits on a WebP decode.
  const decodeFrame = (index) => {
    if (frames[index] || decoding.has(index) || !files[index]) return;
    decoding.add(index);
    createImageBitmap(files[index])
      .then((bitmap) => {
        decoding.delete(index);
        const { start, end } = decodeWindow();
        if (index < start || index > end) {
          bitmap.close();
          return;
        }
        frames[index] = bitmap;
        render(true);
      })
      .catch(() => decoding.delete(index));
  };

  const decodeWindow = () => {
    const behind = direction > 0 ? DECODE_BEHIND : DECODE_AHEAD;
    const ahead = direction > 0 ? DECODE_AHEAD : DECODE_BEHIND;
    return { start: Math.max(0, lastBase - behind), end: Math.min(FRAME_COUNT - 1, lastBase + ahead) };
  };

  const updateDecodeWindow = () => {
    const { start, end } = decodeWindow();
    frames.forEach((bitmap, index) => {
      if (bitmap && (index < start || index > end)) {
        bitmap.close();
        frames[index] = undefined;
      }
    });
    // Closest frames first, leaning in the scroll direction.
    for (let offset = 0; offset <= end - start; offset += 1) {
      const forward = lastBase + offset * direction;
      const backward = lastBase - offset * direction;
      if (forward >= start && forward <= end) decodeFrame(forward);
      if (backward >= start && backward <= end) decodeFrame(backward);
    }
  };

  // The source is 24fps, so fade each frame into the next by the fractional position.
  // Without this, slow scrolling holds one image for several refreshes and visibly steps.
  const render = (force = false) => {
    const position = Math.round(state.frame * 1000) / 1000;
    if (position === drawnPosition && !force) return;

    let base = Math.floor(position);
    let next = Math.min(base + 1, FRAME_COUNT - 1);
    // Fast scrolling moves several frames per refresh, where blending is invisible but would
    // cost a second texture upload, so only blend while moving under a frame per refresh.
    let blend = Math.abs(position - drawnPosition) < 1 ? position - base : 0;

    if (base !== lastBase) {
      direction = base > lastBase ? 1 : -1;
      lastBase = base;
      updateDecodeWindow();
    }

    if (!frames[base] || !frames[next]) {
      base = nearestDecoded(Math.round(position));
      if (base < 0) return;
      next = base;
      blend = 0;
    }

    const scale = frameHeight(position, heroCanvas.width, heroCanvas.height) / frames[base].height;
    renderer.draw(frames, base, next, blend, scale);
    drawnPosition = position;
  };

  const resize = () => {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    heroCanvas.width = Math.round(heroCanvas.clientWidth * ratio);
    heroCanvas.height = Math.round(heroCanvas.clientHeight * ratio);
    renderer.resize();
    // The product slides size their garments from the film's final frame.
    const endHeight = frameFits(heroCanvas.clientWidth, heroCanvas.clientHeight).end;
    scrollFilm.style.setProperty('--end-frame-height', `${endHeight}px`);
    render(true);
  };

  const loadFile = (index) => fetch(frameSrc(index))
    .then((response) => response.blob())
    .then((blob) => {
      files[index] = blob;
      const { start, end } = decodeWindow();
      if (index >= start && index <= end) decodeFrame(index);
    })
    .catch(() => {});

  // First frame goes out alone so the hero paints immediately, then the rest stream in.
  loadFile(0).then(() => {
    for (let index = 1; index < FRAME_COUNT; index += 1) loadFile(index);
  });

  resize();
  window.addEventListener('resize', resize);

  // One scrubbed timeline: the film plays, the polo's caption fades in, then the track slides
  // through the products. Durations are relative; the section's height sets the overall pace.
  const track = scrollFilm.querySelector('.film-track');
  const slides = track ? track.children.length : 1;
  const firstCaption = scrollFilm.querySelector('.film-frame .slide-caption');
  const FILM = 6;
  const MOVE = 1.5;
  const HOLD = 1;

  const timeline = gsap.timeline({ defaults: { ease: 'none' } })
    .to(state, { frame: FRAME_COUNT - 1, duration: FILM, onUpdate: render });

  if (firstCaption) {
    timeline.from(firstCaption, { opacity: 0, y: 24, duration: 0.6, ease: 'power2.out' });
  }
  timeline.addLabel('slide0').to({}, { duration: HOLD });

  for (let index = 1; index < slides; index += 1) {
    timeline
      .to(track, { xPercent: -100 * index, duration: MOVE, ease: 'power1.inOut' })
      .addLabel(`slide${index}`)
      .to({}, { duration: HOLD });
  }

  // Between the end of the film and the last product, settle on whichever product is closest
  // instead of stopping between two. Before and after that range, scrolling stays free.
  const slideStops = Array.from({ length: slides }, (_, index) => timeline.labels[`slide${index}`] / timeline.duration());
  const snapToSlide = (progress) => {
    if (progress < slideStops[0] - 0.02 || progress > slideStops[slides - 1]) return progress;
    return slideStops.reduce((closest, stop) => (Math.abs(stop - progress) < Math.abs(closest - progress) ? stop : closest));
  };

  const filmTrigger = ScrollTrigger.create({
    trigger: scrollFilm,
    start: 'top top',
    end: 'bottom bottom',
    animation: timeline,
    scrub: 0.5,
    // ScrollTrigger's own snap fights Lenis's smoothing, so with Lenis the snap goes through it.
    snap: window.lenis ? undefined : { snapTo: snapToSlide, duration: { min: 0.3, max: 0.8 }, delay: 0.1, ease: 'power2.inOut' }
  });

  if (window.lenis) {
    ScrollTrigger.addEventListener('scrollEnd', () => {
      if (!filmTrigger.isActive) return;
      const target = filmTrigger.start + snapToSlide(filmTrigger.progress) * (filmTrigger.end - filmTrigger.start);
      if (Math.abs(target - window.scrollY) > 2) {
        window.lenis.scrollTo(target, { duration: 0.9, easing: (t) => 1 - Math.pow(1 - t, 3) });
      }
    });
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', wireHeroScroll, { once: true });
} else {
  wireHeroScroll();
}
