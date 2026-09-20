'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as T from 'three';
import { dressedWorker } from '../rendering/cosmetics/dress';
import { liveKid, playerKid, type KidId } from '../rendering/avatars/kid';
import { SEAT_KITS } from '../rendering/palette';
import { buildStandaloneItem } from '../rendering/cosmetics/standalone-item';
import { disposeGeometry } from '../rendering/primitives';
import { poseWorker, type WorkerPose } from '../rendering/worker-pose';
import type { Look } from './look';

export type WardrobePreviewMode = 'avatar' | 'item';

export type WardrobePreviewHandle = {
  turnBy: (radians: number) => void;
  faceFront: () => void;
};

export type WardrobePreviewProps = {
  look: Look;
  /** The kid to dress; the shared worker when unset. */
  kid?: KidId;
  /** The kid's jersey colour. */
  kit?: string;
  mode?: WardrobePreviewMode;
  itemId?: string | null;
  pose?: WorkerPose;
  spinning?: boolean;
  className?: string;
};

const WardrobePreview = forwardRef<WardrobePreviewHandle, WardrobePreviewProps>(
  function WardrobePreview(
    {
      look,
      kid,
      kit = SEAT_KITS[0],
      mode = 'avatar',
      itemId,
      pose = 'walk',
      spinning = true,
      className,
    },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const lookRef = useRef(look);
    const kidRef = useRef(kid);
    const kitRef = useRef(kit);
    const modeRef = useRef(mode);
    const itemIdRef = useRef(itemId);
    const poseRef = useRef(pose);
    const spinningRef = useRef(spinning);
    const applyViewRef = useRef<(() => void) | null>(null);

    const turnByRef = useRef<(rad: number) => void>(() => {});
    const faceFrontRef = useRef<() => void>(() => {});

    useImperativeHandle(ref, () => ({
      turnBy: (rad: number) => turnByRef.current(rad),
      faceFront: () => faceFrontRef.current(),
    }));

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      let currentW = container.clientWidth || 240;
      let currentH = container.clientHeight || 280;

      const scene = new T.Scene();
      const camera = new T.PerspectiveCamera(34, 1, 0.1, 50);

      const renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.outputColorSpace = T.SRGBColorSpace;
      container.appendChild(renderer.domElement);

      let modelBbox = new T.Box3();

      function fitCamera(w: number, h: number) {
        if (w <= 0 || h <= 0) return;
        currentW = w;
        currentH = h;
        const aspect = w / h;
        camera.aspect = aspect;
        const halfFovRad = (camera.fov * Math.PI) / 360;
        const tanFov = Math.tan(halfFovRad);

        if (modeRef.current === 'item') {
          const size = modelBbox.getSize(new T.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z, 0.35);
          const targetH = maxDim * 1.55;
          const targetW = maxDim * 1.55;
          const distH = targetH / (2 * tanFov);
          const distW = targetW / (2 * aspect * tanFov);
          const dist = Math.max(distH, distW);
          camera.position.set(0, 0.04, dist);
          camera.lookAt(0, 0, 0);
        } else {
          // Avatar framing: full worker (feet at 0, top of hat at ~2.2, width ~1.3)
          const targetH = 2.65;
          const targetW = 1.8;
          const distH = targetH / (2 * tanFov);
          const distW = targetW / (2 * aspect * tanFov);
          const dist = Math.max(distH, distW);
          camera.position.set(0, 1.2, dist);
          camera.lookAt(0, 1.02, 0);
        }
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }

      const ambient = new T.AmbientLight(0xfff6ea, 2.0);
      scene.add(ambient);

      const sun = new T.DirectionalLight(0xffffff, 2.3);
      sun.position.set(2.5, 4.5, 3.5);
      scene.add(sun);

      const fill = new T.DirectionalLight(0xd9e5ff, 1.2);
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

      function applyView() {
        if (currentModel) {
          turn.remove(currentModel);
          disposeTree(currentModel);
          currentModel = null;
        }

        if (modeRef.current === 'item' && itemIdRef.current) {
          const itemModel = buildStandaloneItem(
            itemIdRef.current,
            kitRef.current,
          );
          itemModel.position.set(0, 0, 0);
          turn.add(itemModel);
          currentModel = itemModel;
          modelBbox = new T.Box3().setFromObject(itemModel);
          shadow.scale.set(0.65, 0.65, 0.65);
          shadow.position.y = modelBbox.min.y - 0.02;
        } else {
          const { model } = kidRef.current
            ? playerKid(
                kidRef.current,
                { jersey: kitRef.current },
                lookRef.current,
              )
            : dressedWorker(0, {}, lookRef.current);
          model.position.set(0, 0, 0);
          turn.add(model);
          currentModel = model;
          modelBbox = new T.Box3().setFromObject(model);
          shadow.scale.set(1, 1, 1);
          shadow.position.y = 0.005;
        }

        fitCamera(currentW, currentH);
      }

      applyViewRef.current = applyView;
      applyView();

      let frameId: number;
      let rotation = 0.25;
      let dragging = false;
      let previousX = 0;

      turnByRef.current = (rad: number) => {
        rotation += rad;
      };
      faceFrontRef.current = () => {
        rotation = 0;
      };

      const onPointerDown = (e: PointerEvent) => {
        if (!e.isPrimary || e.button !== 0) return;
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
      renderer.domElement.addEventListener('pointercancel', onPointerUp);
      renderer.domElement.addEventListener('lostpointercapture', onPointerUp);

      let previousTime = performance.now();
      const render = () => {
        const time = performance.now();
        const delta = Math.min((time - previousTime) / 1000, 0.05);
        previousTime = time;
        const now = time / 1000;
        if (spinningRef.current && !dragging) {
          rotation += delta * (modeRef.current === 'item' ? 0.72 : 0.42);
        }
        turn.rotation.y = rotation;

        if (modeRef.current === 'avatar' && currentModel) {
          poseWorker(currentModel, now, poseRef.current);
          if (kidRef.current)
            liveKid(currentModel, now, poseRef.current === 'walk');
        }

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
        renderer.domElement.removeEventListener('pointercancel', onPointerUp);
        renderer.domElement.removeEventListener(
          'lostpointercapture',
          onPointerUp,
        );
        if (currentModel) {
          disposeTree(currentModel);
        }
        shadow.geometry.dispose();
        (shadow.material as T.Material).dispose();
        renderer.dispose();
        if (renderer.domElement.parentNode) {
          renderer.domElement.parentNode.removeChild(renderer.domElement);
        }
        applyViewRef.current = null;
        turnByRef.current = () => {};
        faceFrontRef.current = () => {};
      };
    }, []);

    useEffect(() => {
      lookRef.current = look;
      kidRef.current = kid;
      kitRef.current = kit;
      modeRef.current = mode;
      itemIdRef.current = itemId;
      applyViewRef.current?.();
    }, [look, kid, kit, mode, itemId]);

    useEffect(() => {
      poseRef.current = pose;
    }, [pose]);

    useEffect(() => {
      spinningRef.current = spinning;
    }, [spinning]);

    return (
      <div
        ref={containerRef}
        className={className}
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          touchAction: 'pan-y',
          cursor: 'grab',
        }}
        title="Drag horizontally to rotate 3D preview"
      />
    );
  },
);

export default WardrobePreview;
