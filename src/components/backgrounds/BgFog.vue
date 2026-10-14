<template>
  <div class="fixed inset-0 z-0 pointer-events-none fog" aria-hidden="true">
    <div class="stones absolute inset-x-0 bottom-0 h-[40%]"/>
  </div>
</template>

<style scoped>
.fog { background: linear-gradient(#10101a, #2a3a3a); }
.stones { background:
  radial-gradient(ellipse at 15% 100%, #000 0 18%, transparent 19%),
  radial-gradient(ellipse at 40% 100%, #000 0 12%, transparent 13%),
  radial-gradient(ellipse at 70% 100%, #000 0 20%, transparent 21%),
  radial-gradient(ellipse at 90% 100%, #000 0 14%, transparent 15%); }
.fog::after { content: ""; position: absolute; inset: 0 -6%; will-change: transform, opacity;  background: linear-gradient(to top, rgb(200 220 220 / .55), transparent 70%); animation: drift 12s ease-in-out -5s infinite alternate; }
/* Oversized (112%) so the translate never exposes an edge; alternate+ease-in-out is a smooth there-and-back. */
@keyframes drift { from { transform: translate3d(0,0,0); opacity: 1; } to { transform: translate3d(-4%,0,0); opacity: .7; } }
</style>
