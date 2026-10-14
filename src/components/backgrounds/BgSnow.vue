<template>
  <div class="fixed inset-0 z-0 pointer-events-none overflow-hidden snow" aria-hidden="true"></div>
</template>

<style scoped>
.snow {
  background: linear-gradient(#202060, #8080c0);
}
/* Each layer: ONE tile size T for both dot patterns, element oversized by T on every side and translated by
   exactly (-T, +T) = one tile period, so the last frame equals the first (no seam). transform = GPU compositing. */
.snow::before,
.snow::after {
  content: '';
  position: absolute;
  inset: -90px;
  will-change: transform;
  background-repeat: repeat;
  animation: fall-a 4s linear infinite;
  opacity: 0.85;
  background-image: radial-gradient(circle, #fff 1.5px, transparent 2px), radial-gradient(circle, #fff 1px, transparent 1.5px);
  background-size:
    90px 90px,
    90px 90px;
  background-position:
    0 0,
    45px 30px;
}
.snow::after {
  inset: -130px;
  background-size:
    130px 130px,
    130px 130px;
  background-position:
    20px 10px,
    85px 75px;
  animation-name: fall-b;
  animation-duration: 7s;
  animation-delay: -3s;
  opacity: 0.5;
}
@keyframes fall-a {
  to {
    transform: translate3d(-90px, 90px, 0);
  }
}
@keyframes fall-b {
  to {
    transform: translate3d(-130px, 130px, 0);
  }
}
</style>
