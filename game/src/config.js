// Valley Rings — the numbers that shape the game.
//
// The course runs down a valley along -Z: home strip at the
// north end, eight rings strung down the middle, the far
// runway waiting at the south end. Everything is in metres.

export const WORLD = {
  valleyHalfWidth: 260, // flat floor runs this far each side of the centre line
  length: 6200, // from the home strip to just past the far runway
  ridgeHeight: 210, // how high the side ridges climb
  floorY: 0,
};

export const RUNWAY = {
  width: 26,
  homeZ: 120, // the home strip's near end; the plane starts parked before it
  homeLength: 420,
  farZ: -5480, // the far runway's near end — land here to finish
  farLength: 460,
};

export const RING_COUNT = 8;
export const RING_RADIUS = 17;

export const PLANE = {
  startZ: 330, // parked on the home strip, facing -Z (heading 180)
  cruiseSpeed: 44, // m/s the throttle settles at on its own
  minSpeed: 0,
  maxSpeed: 78,
  stallSpeed: 19, // below this the nose drops and she sinks
  takeOffSpeed: 26,
};

export const SCORE = {
  perRing: 100,
  landingBonus: 300,
  gentleBonus: 150, // extra for a touchdown under the gentle sink rate
  gentleSink: 2.2, // m/s downward at touchdown that still counts as gentle
};

export const STEP = 1 / 120; // fixed simulation step, seconds
