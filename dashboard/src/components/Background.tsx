import { Mesh, Program, Renderer, Triangle } from 'ogl';
import { useEffect, useRef } from 'react';
import { useTheme } from '../lib/theme';

const vertex = /* glsl */ `
attribute vec2 position;
varying vec2 vUv;
void main() { vUv = position * 0.5 + 0.5; gl_Position = vec4(position, 0.0, 1.0); }
`;

// Slow domain-warped noise in the theme colours, with a faint grid and film grain on top.
const fragment = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform vec2 uRes;
uniform vec2 uMouse;
uniform vec3 uA;
uniform vec3 uB;
uniform vec3 uC;
uniform vec3 uBg;
uniform float uStrength;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.02 + 17.0; a *= 0.5; }
  return v;
}
void main() {
  vec2 uv = vUv;
  vec2 p = (uv - 0.5) * vec2(uRes.x / uRes.y, 1.0) * 1.6;
  float t = uTime * 0.045;
  vec2 m = (uMouse - 0.5) * 0.25;
  vec2 q = vec2(fbm(p + t + m), fbm(p + vec2(5.2, 1.3) - t));
  vec2 r = vec2(fbm(p + 3.0 * q + vec2(1.7, 9.2) + t * 0.6), fbm(p + 3.0 * q + vec2(8.3, 2.8) - t * 0.4));
  float f = fbm(p + 3.2 * r);
  vec3 col = mix(uBg, uA, smoothstep(0.15, 0.75, f));
  col = mix(col, uB, smoothstep(0.35, 0.95, length(q)) * 0.75);
  col = mix(col, uC, smoothstep(0.55, 1.1, length(r)) * 0.55);
  col = mix(uBg, col, uStrength);
  // keep the edges calm so content stays readable
  float vig = smoothstep(1.25, 0.2, length((uv - 0.5) * vec2(1.1, 1.0)));
  col = mix(uBg, col, 0.35 + 0.65 * vig);
  // hairline grid that fades toward the edges
  vec2 g = abs(fract((uv * uRes) / 56.0) - 0.5);
  float grid = smoothstep(0.495, 0.5, max(g.x, g.y)) * 0.05 * vig;
  col += grid;
  col += (hash(uv * uRes + uTime) - 0.5) * 0.028;
  gl_FragColor = vec4(col, 1.0);
}
`;

function hexToVec3(hex: string): [number, number, number] {
  const h = hex.trim().replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function Background() {
  const ref = useRef<HTMLDivElement>(null);
  const theme = useTheme();
  const uniforms = useRef<{ uA: { value: number[] }; uB: { value: number[] }; uC: { value: number[] }; uBg: { value: number[] }; uStrength: { value: number } } | null>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let renderer: Renderer;
    try {
      renderer = new Renderer({ alpha: false, antialias: false, dpr: Math.min(window.devicePixelRatio, 1) * 0.6 });
    } catch {
      return; // no WebGL: the plain page background still works
    }
    const gl = renderer.gl;
    host.appendChild(gl.canvas);
    gl.canvas.style.cssText = 'width:100%;height:100%;display:block';

    const css = getComputedStyle(document.documentElement);
    const read = () => ({
      a: hexToVec3(css.getPropertyValue('--shader-a')),
      b: hexToVec3(css.getPropertyValue('--shader-b')),
      c: hexToVec3(css.getPropertyValue('--shader-c')),
      bg: hexToVec3(css.getPropertyValue('--bg')),
      s: parseFloat(css.getPropertyValue('--shader-strength')) || 0.9,
    });
    const colors = read();
    const program = new Program(gl, {
      vertex,
      fragment,
      uniforms: {
        uTime: { value: 0 },
        uRes: { value: [1, 1] },
        uMouse: { value: [0.5, 0.5] },
        uA: { value: colors.a },
        uB: { value: colors.b },
        uC: { value: colors.c },
        uBg: { value: colors.bg },
        uStrength: { value: colors.s },
      },
    });
    uniforms.current = program.uniforms as never;
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
      m[0] += (target[0] - m[0]) * 0.04;
      m[1] += (target[1] - m[1]) * 0.04;
      program.uniforms.uTime.value = (now - start) / 1000;
      renderer.render({ scene: mesh });
      if (!reduce && !document.hidden) raf = requestAnimationFrame(frame);
      else raf = 0;
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

  // Theme changes only swap colours; the renderer keeps running.
  useEffect(() => {
    const u = uniforms.current;
    if (!u) return;
    const css = getComputedStyle(document.documentElement);
    u.uA.value = hexToVec3(css.getPropertyValue('--shader-a'));
    u.uB.value = hexToVec3(css.getPropertyValue('--shader-b'));
    u.uC.value = hexToVec3(css.getPropertyValue('--shader-c'));
    u.uBg.value = hexToVec3(css.getPropertyValue('--bg'));
    u.uStrength.value = parseFloat(css.getPropertyValue('--shader-strength')) || 0.9;
  }, [theme]);

  return <div ref={ref} aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-bg" />;
}
