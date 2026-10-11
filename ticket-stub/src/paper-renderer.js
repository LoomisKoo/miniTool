/**
 * 票根「纸感 3D」：DOM 光栅化纹理 + WebGL 光照/纸纹着色（预览与导出同源）
 */
(function (global) {
  const PRESETS = {
    matte: { label: '哑光纸', grain: 0.42, warmth: 0.1, specular: 0.22, curl: 0.12 },
    vintage: { label: '复古纸', grain: 0.68, warmth: 0.2, specular: 0.12, curl: 0.18 },
    card: { label: '卡纸', grain: 0.28, warmth: 0.06, specular: 0.42, curl: 0.08 },
  };

  const VERT = `
    varying vec2 vUv;
    uniform float uCurl;
    void main() {
      vUv = uv;
      vec3 pos = position;
      float edge = 1.0 - abs(uv.y - 0.5) * 2.0;
      pos.z += uCurl * sin(uv.x * 3.14159265) * edge * 0.12;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `;

  const FRAG = `
    precision mediump float;
    varying vec2 vUv;
    uniform sampler2D uMap;
    uniform vec3 uLightDir;
    uniform float uGrain;
    uniform float uWarmth;
    uniform float uSpecular;
    uniform vec2 uTexel;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    void main() {
      vec4 base = texture2D(uMap, vUv);
      if (base.a < 0.02) discard;

      float g = (hash(vUv * 900.0 + uTexel * 12.0) - 0.5) * uGrain * 0.11;
      vec3 col = base.rgb + g;
      col = mix(col, col * vec3(1.06, 1.02, 0.92), uWarmth);

      vec3 n = normalize(vec3(
        (hash(vUv * 1200.0) - 0.5) * uGrain * 0.35,
        (hash(vUv * 1200.0 + 1.7) - 0.5) * uGrain * 0.35,
        1.0
      ));
      vec3 l = normalize(uLightDir);
      float diff = clamp(dot(n, l), 0.0, 1.0) * 0.38 + 0.62;
      vec3 v = vec3(0.0, 0.0, 1.0);
      vec3 h = normalize(l + v);
      float spec = pow(clamp(dot(n, h), 0.0, 1.0), 48.0) * uSpecular;

      col *= diff;
      col += spec * vec3(1.0, 0.98, 0.94);

      float vig = smoothstep(0.92, 0.38, length(vUv - 0.5) * 1.25);
      col *= mix(0.86, 1.0, vig);

      gl_FragColor = vec4(col, base.a);
    }
  `;

  function presetParams(id) {
    return PRESETS[id] || PRESETS.matte;
  }

  function attach(hostEl) {
    if (!global.THREE || !hostEl) return null;

    const wrap = hostEl.querySelector('.paper-gl-wrap');
    const canvas = hostEl.querySelector('.paper-gl-canvas');
    const busyEl = hostEl.querySelector('.paper-gl-busy');
    if (!wrap || !canvas) return null;

    const THREE = global.THREE;
    let disposed = false;
    let w = 2;
    let h = 2;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
    });
    renderer.setPixelRatio(1);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0.1, 10);
    camera.position.z = 2;

    const geo = new THREE.PlaneGeometry(1, 1, 32, 24);
    const tex = new THREE.Texture();
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;

    const uniforms = {
      uMap: { value: tex },
      uLightDir: { value: new THREE.Vector3(-0.35, 0.45, 0.82) },
      uGrain: { value: PRESETS.matte.grain },
      uWarmth: { value: PRESETS.matte.warmth },
      uSpecular: { value: PRESETS.matte.specular },
      uCurl: { value: PRESETS.matte.curl },
      uTexel: { value: new THREE.Vector2(1 / 512, 1 / 512) },
    };

    const mat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
    });

    const mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);

    function resize(wPx, hPx) {
      if (wPx < 2 || hPx < 2) return;
      w = wPx;
      h = hPx;
      const aspect = w / h;
      if (aspect >= 1) {
        camera.left = -0.5 * aspect;
        camera.right = 0.5 * aspect;
        camera.top = 0.5;
        camera.bottom = -0.5;
      } else {
        camera.left = -0.5;
        camera.right = 0.5;
        camera.top = 0.5 / aspect;
        camera.bottom = -0.5 / aspect;
      }
      camera.updateProjectionMatrix();
      mesh.scale.set(w, h, 1);
      renderer.setSize(w, h, false);
      wrap.style.width = `${w}px`;
      wrap.style.height = `${h}px`;
      uniforms.uTexel.value.set(1 / w, 1 / h);
    }

    function setParams(opts) {
      const base = presetParams(opts.preset || 'matte');
      uniforms.uGrain.value = opts.grain != null ? opts.grain : base.grain;
      uniforms.uWarmth.value = opts.warmth != null ? opts.warmth : base.warmth;
      uniforms.uSpecular.value = opts.specular != null ? opts.specular : base.specular;
      uniforms.uCurl.value = opts.curl != null ? opts.curl : base.curl;
      if (opts.light != null) {
        const s = opts.light;
        uniforms.uLightDir.value.set(-0.25 - s * 0.35, 0.35 + s * 0.25, 0.78).normalize();
      }
    }

    function setLight(rxDeg, ryDeg) {
      const rx = (rxDeg * Math.PI) / 180;
      const ry = (ryDeg * Math.PI) / 180;
      const x = Math.sin(ry) * 0.65 - 0.2;
      const y = Math.sin(rx) * 0.55 + 0.35;
      const z = 0.72 + Math.cos(rx) * 0.15 + Math.cos(ry) * 0.1;
      uniforms.uLightDir.value.set(x, y, z).normalize();
    }

    function updateFromCanvas(sourceCanvas) {
      if (disposed || !sourceCanvas) return false;
      tex.image = sourceCanvas;
      tex.needsUpdate = true;
      resize(sourceCanvas.width, sourceCanvas.height);
      renderer.render(scene, camera);
      wrap.classList.add('is-ready');
      if (busyEl) busyEl.hidden = true;
      return true;
    }

    function renderFrame() {
      if (!disposed) renderer.render(scene, camera);
    }

    function setBusy(on) {
      if (busyEl) busyEl.hidden = !on;
    }

    function show() {
      wrap.hidden = false;
    }

    function hide() {
      wrap.hidden = true;
      wrap.classList.remove('is-ready');
    }

    function dispose() {
      disposed = true;
      tex.dispose();
      geo.dispose();
      mat.dispose();
      renderer.dispose();
    }

    function capturePngFromCanvas(sourceCanvas, params) {
      setParams(params || {});
      updateFromCanvas(sourceCanvas);
      return renderer.domElement.toDataURL('image/png');
    }

    return {
      setParams,
      setLight,
      updateFromCanvas,
      renderFrame,
      setBusy,
      show,
      hide,
      dispose,
      capturePngFromCanvas,
      resize,
    };
  }

  async function rasterizeNode(node, htmlToImage, pixelRatio) {
    if (!htmlToImage || !node) throw new Error('rasterize');
    const opts = {
      pixelRatio: pixelRatio || 1,
      cacheBust: true,
      backgroundColor: null,
    };
    // 字体以 data: 预内联，离线容器里不必再去取字体文件
    if (global.__FONT_EMBED_CSS) opts.fontEmbedCSS = global.__FONT_EMBED_CSS;
    return htmlToImage.toCanvas(node, opts);
  }

  global.TicketPaper = {
    PRESETS,
    DEBOUNCE_MS: 250,
    attach,
    rasterizeNode,
  };
})(typeof window !== 'undefined' ? window : globalThis);
