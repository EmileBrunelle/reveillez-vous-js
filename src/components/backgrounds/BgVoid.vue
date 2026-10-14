<template>
  <div class="fixed inset-0 z-0 pointer-events-none void" aria-hidden="true"></div>
</template>

<style scoped>
.void { background: radial-gradient(ellipse at 30% 40%, #1a0030, #000 70%), #000; }
/* Two star layers with unrelated periods and negative delays so they never pulse in sync or start together at t=0.
   `alternate` + ease-in-out on opacity is continuous (no snap): it is a smooth there-and-back, not a restart. */
.void::before, .void::after { content: ""; position: absolute; inset: 0; will-change: opacity; animation: twinkle 3s ease-in-out infinite alternate; }
.void::before { background-image: radial-gradient(circle, #fff 1px, transparent 1.5px); background-size: 140px 140px; background-position: 10px 20px; animation-delay: -1.3s; }
.void::after { background-image: radial-gradient(circle, #aaf 1px, transparent 1.5px); background-size: 97px 97px; background-position: 60px 70px; animation-duration: 4.3s; animation-delay: -2.9s; }
@keyframes twinkle { from { opacity: 1; } to { opacity: .35; } }
</style>
