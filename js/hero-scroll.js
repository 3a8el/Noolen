const heroCanvas = document.getElementById('heroCanvas');
const scrollFilm = document.querySelector('.scroll-film');

// Frames are generated from assets/video/noolen-video.mp4 by scripts/extract_hero_frames.py
const FRAME_COUNT = 233;
const frameSet = window.matchMedia('(max-width: 720px)').matches ? 'mobile' : 'desktop';
const frameSrc = (index) => `assets/frames/${frameSet}/frame_${String(index + 1).padStart(4, '0')}.webp`;

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
  void main() {
    vec2 uv = (vUv - 0.5) * uCover + 0.5;
    gl_FragColor = mix(texture2D(uBase, uv), texture2D(uNext, uv), uBlend);
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
    draw: (frames, base, next, blend) => {
      const baseSlot = slots.find((slot) => slot.frame === base)
        || slots.find((slot) => slot.frame !== next)
        || slots[0];
      const nextSlot = baseSlot === slots[0] ? slots[1] : slots[0];

      if (baseSlot.frame !== base) upload(baseSlot, base, frames[base]);
      if (blend > 0 && nextSlot.frame !== next) upload(nextSlot, next, frames[next]);

      const image = frames[base];
      const canvasAspect = canvas.width / canvas.height;
      const imageAspect = image.width / image.height;
      if (canvasAspect > imageAspect) {
        gl.uniform2f(uCover, 1, imageAspect / canvasAspect);
      } else {
        gl.uniform2f(uCover, canvasAspect / imageAspect, 1);
      }

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
    draw: (frames, base, next, blend) => {
      const image = frames[blend < 0.5 ? base : next];
      const { width, height } = canvas;
      const scale = Math.max(width / image.width, height / image.height);
      const drawWidth = image.width * scale;
      const drawHeight = image.height * scale;

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

    renderer.draw(frames, base, next, blend);
    drawnPosition = position;
  };

  const resize = () => {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    heroCanvas.width = Math.round(heroCanvas.clientWidth * ratio);
    heroCanvas.height = Math.round(heroCanvas.clientHeight * ratio);
    renderer.resize();
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

  gsap.to(state, {
    frame: FRAME_COUNT - 1,
    ease: 'none',
    onUpdate: render,
    scrollTrigger: {
      trigger: scrollFilm,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 0.5
    }
  });
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', wireHeroScroll, { once: true });
} else {
  wireHeroScroll();
}
