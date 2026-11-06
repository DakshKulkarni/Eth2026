import { Mesh, Program, Renderer, Triangle } from 'ogl';
import { useEffect, useRef } from 'react';
import { useTheme } from '../lib/theme';

const vertex = /* glsl */ `
attribute vec2 position;
varying vec2 vUv;
void main() { vUv = position * 0.5 + 0.5; gl_Position = vec4(position, 0.0, 1.0); }
`;

// Contour lines of a slowly drifting height field, like the surface map of a part on a machine bed.
// One hairline colour at low opacity, so it reads as texture and never competes with the data.
const fragment = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform vec2 uRes;
uniform vec2 uMouse;
uniform vec3 uInk;
uniform vec3 uBg;
uniform float uAlpha;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float field(vec2 p, float t) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p + t * (1.0 + float(i) * 0.35)); p = p * 2.03 + 11.7; a *= 0.5; }
  return v;
}
void main() {
  vec2 uv = vUv;
  float aspect = uRes.x / uRes.y;
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0) * 2.2 + (uMouse - 0.5) * 0.18;
  float t = uTime * 0.012;
  float f = field(p, t);
  float e = 0.012;
  vec2 grad = vec2(field(p + vec2(e, 0.0), t) - f, field(p + vec2(0.0, e), t) - f) / e;
  float levels = 15.0;
  float v = f * levels;
  float d = abs(fract(v) - 0.5);
  float width = max(length(grad) * levels * 1.6 / uRes.y * 1.4, 0.0018);
  float line = 1.0 - smoothstep(0.5 - width, 0.5, 0.5 - d + width * 0.0);
  float major = 1.0 - smoothstep(0.0, width * 1.3, abs(fract(v / 5.0 + 0.5) - 0.5) * 5.0);
  float vig = smoothstep(1.2, 0.15, length((uv - 0.5) * vec2(1.15, 1.0)));
  float strength = (line * 0.55 + major * 0.5) * vig;
  vec3 col = mix(uBg, uInk, clamp(strength * uAlpha * 5.0, 0.0, 1.0));
  col += (hash(uv * uRes + uTime) - 0.5) * 0.012;
  gl_FragColor = vec4(col, 1.0);
}
`;

function rgbFromVar(value: string): [number, number, number] {
  const parts = value.trim().split(/\s+/).map(Number);
  return [parts[0] / 255, parts[1] / 255, parts[2] / 255];
}
function hexToVec3(hex: string): [number, number, number] {
  const h = hex.trim().replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

type Uniforms = { uInk: { value: number[] }; uBg: { value: number[] }; uAlpha: { value: number } };

export function Background() {
  const ref = useRef<HTMLDivElement>(null);
  const theme = useTheme();
  const uniforms = useRef<Uniforms | null>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let renderer: Renderer;
    try {
      renderer = new Renderer({ alpha: false, antialias: false, dpr: Math.min(window.devicePixelRatio, 1.25) });
    } catch {
      return; // no WebGL: the plain page colour still works
    }
    const gl = renderer.gl;
    host.appendChild(gl.canvas);
    gl.canvas.style.cssText = 'width:100%;height:100%;display:block';

    const css = getComputedStyle(document.documentElement);
    const program = new Program(gl, {
      vertex,
      fragment,
      uniforms: {
        uTime: { value: 0 },
        uRes: { value: [1, 1] },
        uMouse: { value: [0.5, 0.5] },
        uInk: { value: rgbFromVar(css.getPropertyValue('--contour')) },
        uBg: { value: hexToVec3(css.getPropertyValue('--bg')) },
        uAlpha: { value: parseFloat(css.getPropertyValue('--contour-alpha')) || 0.08 },
      },
    });
    uniforms.current = program.uniforms as unknown as Uniforms;
    const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });

    const resize = () => {
      renderer.setSize(host.clientWidth, host.clientHeight);
      program.uniforms.uRes.value = [gl.canvas.width, gl.canvas.height];
    };
    resize();
    window.addEventListener('resize', resize);

    const target = [0.5, 0.5];
    const onMove = (e: PointerEvent) => {
      target[0] = e.clientX / window.innerWidth;
      target[1] = 1 - e.clientY / window.innerHeight;
    };
    window.addEventListener('pointermove', onMove, { passive: true });

    let raf = 0;
    const start = performance.now();
    const frame = (now: number) => {
      const m = program.uniforms.uMouse.value as number[];
      m[0] += (target[0] - m[0]) * 0.03;
      m[1] += (target[1] - m[1]) * 0.03;
      program.uniforms.uTime.value = (now - start) / 1000;
      renderer.render({ scene: mesh });
      raf = !reduce && !document.hidden ? requestAnimationFrame(frame) : 0;
    };
    raf = requestAnimationFrame(frame);
    const onVisible = () => {
      if (!document.hidden && !raf && !reduce) raf = requestAnimationFrame(frame);
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('visibilitychange', onVisible);
      host.removeChild(gl.canvas);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, []);

  // A theme change only swaps colours; the renderer keeps running.
  useEffect(() => {
    const u = uniforms.current;
    if (!u) return;
    const css = getComputedStyle(document.documentElement);
    u.uInk.value = rgbFromVar(css.getPropertyValue('--contour'));
    u.uBg.value = hexToVec3(css.getPropertyValue('--bg'));
    u.uAlpha.value = parseFloat(css.getPropertyValue('--contour-alpha')) || 0.08;
  }, [theme]);

  return <div ref={ref} aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-bg" />;
}
