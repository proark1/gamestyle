/** Own one contact for its entire lifetime, independently of React renders or viewport changes. */
export function bindJoystick(
  pad: HTMLElement,
  onMove: (x: number, z: number) => void,
  joystickVector: (x: number, z: number) => { x: number; z: number },
) {
  const doc = pad.ownerDocument;
  const win = doc.defaultView!;
  const controller = new AbortController();
  const options = { signal: controller.signal, passive: false };
  let contact: { id: number; x: number; y: number; radius: number } | null =
    null;

  function reset() {
    const id = contact?.id;
    contact = null;
    onMove(0, 0);
    pad.removeAttribute('data-active');
    pad.style.setProperty('--stick-x', '0px');
    pad.style.setProperty('--stick-y', '0px');
    if (id !== undefined && pad.hasPointerCapture(id))
      pad.releasePointerCapture(id);
  }

  function own(event: PointerEvent) {
    if (event.cancelable) event.preventDefault();
    event.stopPropagation();
  }

  pad.addEventListener(
    'pointerdown',
    (event) => {
      if (contact || event.button !== 0) return;
      own(event);
      contact = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        radius: Math.max(24, pad.getBoundingClientRect().width * 0.35),
      };
      onMove(0, 0);
      pad.setAttribute('data-active', 'true');
      // Window listeners continue tracking if the browser cannot retain capture.
      try {
        pad.setPointerCapture(event.pointerId);
      } catch {
        /* Contact is still tracked. */
      }
    },
    options,
  );

  win.addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerId !== contact?.id) return;
      own(event);
      if (event.pointerType === 'mouse' && event.buttons === 0) {
        reset();
        return;
      }
      const value = joystickVector(
        (event.clientX - contact.x) / contact.radius,
        (event.clientY - contact.y) / contact.radius,
      );
      onMove(value.x, value.z);
      pad.style.setProperty(
        '--stick-x',
        `${value.x * contact.radius * 0.72}px`,
      );
      pad.style.setProperty(
        '--stick-y',
        `${value.z * contact.radius * 0.72}px`,
      );
    },
    { ...options, capture: true },
  );

  function end(event: PointerEvent) {
    if (event.pointerId !== contact?.id) return;
    own(event);
    reset();
  }
  win.addEventListener('pointerup', end, { ...options, capture: true });
  win.addEventListener('pointercancel', end, { ...options, capture: true });
  win.addEventListener('blur', reset, options);
  win.addEventListener('pagehide', reset, options);
  doc.addEventListener(
    'visibilitychange',
    () => {
      if (doc.hidden) reset();
    },
    options,
  );
  pad.addEventListener(
    'contextmenu',
    (event) => event.preventDefault(),
    options,
  );

  return () => {
    controller.abort();
    reset();
  };
}
