'use client';

import { useEffect, useRef } from 'react';
import * as T from 'three';
import { dressedWorker } from '../rendering/cosmetics/dress';
import { disposeGeometry } from '../rendering/primitives';
import type { Look } from './look';

export default function WardrobePreview({
  look,
  className,
}: {
  look: Look;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lookRef = useRef(look);
  const applyLookRef = useRef<((l: Look) => void) | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 240;
    const height = container.clientHeight || 280;

    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(34, 1, 0.1, 50);

    const renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = T.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    function fitCamera(w: number, h: number) {
      if (w <= 0 || h <= 0) return;
      const aspect = w / h;
      camera.aspect = aspect;
      const halfFovRad = (camera.fov * Math.PI) / 360;
      const tanFov = Math.tan(halfFovRad);
      // Ensure the whole model (feet at 0, top of hat at ~2.2, width ~1.3) is completely framed:
      const targetH = 2.65;
      const targetW = 1.80;
      const distH = targetH / (2 * tanFov);
      const distW = targetW / (2 * aspect * tanFov);
      const dist = Math.max(distH, distW);
      camera.position.set(0, 1.20, dist);
      camera.lookAt(0, 1.02, 0);
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }

    fitCamera(width, height);

    const ambient = new T.AmbientLight(0xfff6ea, 1.9);
    scene.add(ambient);

    const sun = new T.DirectionalLight(0xffffff, 2.2);
    sun.position.set(2.5, 4.5, 3.5);
    scene.add(sun);

    const fill = new T.DirectionalLight(0xd9e5ff, 1.1);
    fill.position.set(-3, 2, -2);
    scene.add(fill);

    const turn = new T.Group();
    scene.add(turn);

    const shadow = new T.Mesh(
      new T.RingGeometry(0, 0.65, 32),
      new T.MeshBasicMaterial({
        color: 0x22352b,
        transparent: true,
        opacity: 0.12,
        side: T.DoubleSide,
      }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.005;
    turn.add(shadow);

    let currentModel: T.Object3D | null = null;

    function disposeTree(object: T.Object3D) {
      object.traverse((child) => {
        if (child instanceof T.Mesh) {
          disposeGeometry(child.geometry);
        }
      });
    }

    function applyLook(newLook: Look) {
      if (currentModel) {
        turn.remove(currentModel);
        disposeTree(currentModel);
        currentModel = null;
      }
      const { model } = dressedWorker(0, {}, newLook);
      model.position.set(0, 0, 0);
      turn.add(model);
      currentModel = model;
    }

    applyLookRef.current = applyLook;
    applyLook(lookRef.current);

    let frameId: number;
    let rotation = 0.25;
    let dragging = false;
    let previousX = 0;

    const onPointerDown = (e: PointerEvent) => {
      dragging = true;
      previousX = e.clientX;
      renderer.domElement.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      const delta = e.clientX - previousX;
      previousX = e.clientX;
      rotation += delta * 0.018;
    };

    const onPointerUp = (e: PointerEvent) => {
      dragging = false;
      try {
        renderer.domElement.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore if already released
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    const render = () => {
      if (!dragging) {
        rotation += 0.006;
      }
      turn.rotation.y = rotation;
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(render);
    };

    render();

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        const h = entry.contentRect.height;
        if (w > 0 && h > 0) {
          fitCamera(w, h);
        }
      }
    });
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      if (currentModel) {
        disposeTree(currentModel);
      }
      shadow.geometry.dispose();
      (shadow.material as T.Material).dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      applyLookRef.current = null;
    };
  }, []);

  useEffect(() => {
    lookRef.current = look;
    applyLookRef.current?.(look);
  }, [look]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        touchAction: 'none',
        cursor: 'grab',
      }}
      title="Drag horizontally to spin character"
    />
  );
}
