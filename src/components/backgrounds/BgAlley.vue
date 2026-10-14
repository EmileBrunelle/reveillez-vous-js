<template>
  <div class="fixed inset-0 z-0 pointer-events-none alley" aria-hidden="true">
    <div class="absolute w-0 h-0 [border-left:1.4rem_solid_transparent] [border-right:1.4rem_solid_transparent] [border-bottom:3.6rem_solid_#ff7a00] bottom-[8%] left-[14%]"/><div class="absolute w-0 h-0 [border-left:1.4rem_solid_transparent] [border-right:1.4rem_solid_transparent] [border-bottom:3.6rem_solid_#ff7a00] bottom-[14%] left-[62%] [transform:scale(.8)]"/><div class="absolute w-0 h-0 [border-left:1.4rem_solid_transparent] [border-right:1.4rem_solid_transparent] [border-bottom:3.6rem_solid_#ff7a00] bottom-[5%] left-[80%] [transform:scale(1.2)_rotate(8deg)]"/>
  </div>
</template>

<style scoped>
.alley { background: radial-gradient(ellipse 90% 100% at 50% 60%, #2a2a2a 0%, #222 55%, #111 100%), #222; }
.alley::before { content: ""; position: absolute; inset: 0; background: linear-gradient(#000 0, transparent 30%, rgb(255 140 0 / .18) 100%); }
</style>
