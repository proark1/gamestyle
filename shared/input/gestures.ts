// Shared by the touch UI and scene so narrow windows offer the same controls.
export const TOUCH_CONTROLS_QUERY = '(pointer: coarse), (max-width: 900px)';

export function joystickVector(x: number, y: number, radius = 35) {
  const distance = Math.hypot(x, y);
  const deadZone = Math.min(5, radius / 3);
  if (distance <= deadZone) return { x: 0, z: 0 };
  const strength = Math.min(1, (distance - deadZone) / (radius - deadZone));
  return { x: (x / distance) * strength, z: (y / distance) * strength };
}

/** A thumb owns one drag, anchored at touch-down rather than a changing DOM rect. */
export class JoystickGesture {
  owner: number | null = null;
  origin = { x: 0, y: 0 };
  radius = 35;
  vector = { x: 0, z: 0 };
  down(id: number, x: number, y: number, radius = 35) {
    if (this.owner !== null) return false;
    this.owner = id;
    this.origin = { x, y };
    this.radius = Math.max(12, radius);
    this.vector = { x: 0, z: 0 };
    return true;
  }
  move(id: number, x: number, y: number) {
    if (this.owner !== id) return null;
    this.vector = joystickVector(
      x - this.origin.x,
      y - this.origin.y,
      this.radius,
    );
    return this.vector;
  }
  up(id: number) {
    if (this.owner !== id) return false;
    this.clear();
    return true;
  }
  clear() {
    this.owner = null;
    this.vector = { x: 0, z: 0 };
  }
}

type Contact = {
  x: number;
  y: number;
  originX: number;
  originY: number;
  moved: boolean;
};

/** A second finger always makes this a gesture, never a tap or placement. */
export class YardGesture {
  contacts = new Map<number, Contact>();
  down(id: number, x: number, y: number) {
    const moved = this.contacts.size > 0;
    if (moved)
      for (const contact of this.contacts.values()) contact.moved = true;
    this.contacts.set(id, { x, y, originX: x, originY: y, moved });
  }
  move(id: number, x: number, y: number) {
    const contact = this.contacts.get(id);
    if (!contact) return { orbit: 0, zoom: 1 };
    const previous = [...this.contacts.values()];
    const distance =
      previous.length === 2
        ? Math.hypot(
            previous[0].x - previous[1].x,
            previous[0].y - previous[1].y,
          )
        : 0;
    const dx = x - contact.x;
    contact.x = x;
    contact.y = y;
    if (Math.hypot(x - contact.originX, y - contact.originY) > 7)
      contact.moved = true;
    if (this.contacts.size === 2) {
      const [a, b] = this.contacts.values();
      const next = Math.hypot(a.x - b.x, a.y - b.y);
      return {
        orbit: 0,
        zoom: distance > 10 && next > 10 ? distance / next : 1,
      };
    }
    return {
      orbit: this.contacts.size === 1 && contact.moved ? dx : 0,
      zoom: 1,
    };
  }
  up(id: number, cancelled = false) {
    const contact = this.contacts.get(id);
    const tapped =
      !!contact && !contact.moved && this.contacts.size === 1 && !cancelled;
    this.contacts.delete(id);
    for (const remaining of this.contacts.values()) remaining.moved = true;
    return tapped;
  }
  clear() {
    this.contacts.clear();
  }
}
