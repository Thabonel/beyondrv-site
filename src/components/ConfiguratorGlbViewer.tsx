import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { ConfiguratorVisualBinding, ConfiguratorVisualHotspot } from '../lib/configurator/types';

export default function ConfiguratorGlbViewer({ src, poster, alt, selectedOptionIds, bindings = [], hotspots = [] }: {
  src: string;
  poster?: string;
  alt: string;
  selectedOptionIds: string[];
  bindings?: ConfiguratorVisualBinding[];
  hotspots?: ConfiguratorVisualHotspot[];
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<THREE.Object3D | null>(null);
  const hotspotRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [mode, setMode] = useState<'base' | 'configured'>('configured');
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [activeHotspot, setActiveHotspot] = useState('');

  useEffect(() => {
    const root = modelRef.current;
    if (!root) return;
    const selected = new Set(mode === 'configured' ? selectedOptionIds : []);
    for (const binding of bindings) {
      const visible = binding.visibleWhenSelected ? selected.has(binding.optionId) : !selected.has(binding.optionId);
      for (const nodeName of binding.nodeNames) {
        const node = root.getObjectByName(nodeName);
        if (node) node.visible = visible;
      }
    }
  }, [bindings, mode, selectedOptionIds, state]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !src) return;
    setState('loading');
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0b0b);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 2000);
    camera.position.set(4, 2.4, 5);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.domElement.setAttribute('aria-label', alt);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    host.prepend(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.minDistance = 0.25;
    controls.maxDistance = 100;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x333333, 2.4));
    const key = new THREE.DirectionalLight(0xffffff, 3.1);
    key.position.set(4, 8, 5);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffb079, 1.4);
    fill.position.set(-5, 3, -4);
    scene.add(fill);

    const draco = new DRACOLoader();
    draco.setDecoderPath('/draco/');
    const loader = new GLTFLoader();
    loader.setDRACOLoader(draco);
    let frame = 0;
    let disposed = false;
    loader.load(src, gltf => {
      if (disposed) return;
      modelRef.current = gltf.scene;
      scene.add(gltf.scene);
      const bounds = new THREE.Box3().setFromObject(gltf.scene);
      const size = bounds.getSize(new THREE.Vector3());
      const centre = bounds.getCenter(new THREE.Vector3());
      gltf.scene.position.sub(centre);
      const radius = Math.max(size.x, size.y, size.z, 0.5);
      camera.near = Math.max(radius / 1000, 0.01);
      camera.far = radius * 100;
      camera.position.set(radius * 1.25, radius * 0.72, radius * 1.45);
      camera.updateProjectionMatrix();
      controls.target.set(0, 0, 0);
      controls.update();
      setState('ready');
    }, undefined, () => setState('error'));

    const hotspotVector = new THREE.Vector3();
    const render = () => {
      controls.update();
      renderer.render(scene, camera);
      for (const hotspot of hotspots) {
        const element = hotspotRefs.current[hotspot.id];
        if (!element) continue;
        hotspotVector.set(...hotspot.position);
        modelRef.current?.localToWorld(hotspotVector);
        hotspotVector.project(camera);
        element.style.left = `${(hotspotVector.x * 0.5 + 0.5) * 100}%`;
        element.style.top = `${(-hotspotVector.y * 0.5 + 0.5) * 100}%`;
        element.style.display = hotspotVector.z > 1 ? 'none' : 'block';
      }
      frame = requestAnimationFrame(render);
    };
    render();
    const resize = new ResizeObserver(entries => {
      const box = entries[0]?.contentRect;
      if (!box?.width || !box.height) return;
      renderer.setSize(box.width, box.height, false);
      camera.aspect = box.width / box.height;
      camera.updateProjectionMatrix();
    });
    resize.observe(host);

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      resize.disconnect();
      controls.dispose();
      draco.dispose();
      scene.traverse(object => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose?.();
        const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
        materials.forEach(material => material.dispose());
      });
      renderer.dispose();
      renderer.domElement.remove();
      modelRef.current = null;
    };
  }, [alt, hotspots, src]);

  return (
    <div ref={hostRef} style={{ position: 'relative', width: '100%', minHeight: '390px', height: '100%', overflow: 'hidden', background: poster ? `#0b0b0b url(${JSON.stringify(poster)}) center/cover no-repeat` : '#0b0b0b' }}>
      <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 3, display: 'flex', gap: 6 }}>
        <button type="button" onClick={() => setMode('base')} style={{ background: mode === 'base' ? '#E8540A' : '#222', color: '#fff', border: '1px solid #555', borderRadius: 999, padding: '0.38rem 0.65rem', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 800 }}>Base</button>
        <button type="button" onClick={() => setMode('configured')} style={{ background: mode === 'configured' ? '#E8540A' : '#222', color: '#fff', border: '1px solid #555', borderRadius: 999, padding: '0.38rem 0.65rem', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 800 }}>Configured</button>
      </div>
      {hotspots.map(hotspot => <button key={hotspot.id} ref={element => { hotspotRefs.current[hotspot.id] = element; }} type="button" onClick={() => setActiveHotspot(current => current === hotspot.id ? '' : hotspot.id)} aria-label={hotspot.label} style={{ position: 'absolute', zIndex: 4, transform: 'translate(-50%,-50%)', width: 25, height: 25, borderRadius: '50%', border: '2px solid white', background: '#E8540A', color: '#fff', cursor: 'pointer', boxShadow: '0 2px 12px #000' }}>+</button>)}
      {activeHotspot && <div style={{ position: 'absolute', right: 12, bottom: 12, zIndex: 4, maxWidth: 260, padding: '0.65rem', borderRadius: 8, background: 'rgba(0,0,0,.88)', border: '1px solid #555', color: '#fff', fontSize: '0.75rem' }}>{hotspots.find(item => item.id === activeHotspot)?.label}</div>}
      {state !== 'ready' && <div style={{ position: 'absolute', inset: 0, zIndex: 2, display: 'grid', placeItems: 'center', color: '#ddd', background: state === 'error' ? 'rgba(40,10,10,.8)' : 'rgba(0,0,0,.55)', fontSize: '0.78rem' }}>{state === 'error' ? '3D model could not be loaded. The drawing files remain available below.' : 'Loading interactive 3D model…'}</div>}
      <div style={{ position: 'absolute', left: 12, bottom: 10, zIndex: 3, color: '#aaa', fontSize: '0.65rem', pointerEvents: 'none' }}>Drag to rotate · scroll or pinch to zoom</div>
    </div>
  );
}
