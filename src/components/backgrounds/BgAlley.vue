<template>
  <div class="bg alley" aria-hidden="true">
    <div class="cone c1"/><div class="cone c2"/><div class="cone c3"/>
  </div>
</template>

<style scoped>
.bg { position: fixed; inset: 0; z-index: 0; pointer-events: none; }
.alley { background: radial-gradient(ellipse 90% 100% at 50% 60%, #2a2a2a 0%, #222 55%, #111 100%), #222; }
.alley::before { content: ""; position: absolute; inset: 0; background: linear-gradient(#000 0, transparent 30%, rgb(255 140 0 / .18) 100%); }
.cone { position: absolute; bottom: 8%; width: 0; height: 0; border-left: 1.4rem solid transparent; border-right: 1.4rem solid transparent; border-bottom: 3.6rem solid #ff7a00; }
.c1 { left: 14%; } .c2 { left: 62%; bottom: 14%; transform: scale(.8); } .c3 { left: 80%; bottom: 5%; transform: scale(1.2) rotate(8deg); }
</style>
