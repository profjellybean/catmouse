<script setup lang="ts">
import type { Entity } from '@/services/game/ecs';
import type { PositionComponent } from '@/services/game/ecs/components';
import type { GameService } from '@/services/game/game';
import { useIntervalFn, useMagicKeys } from '@vueuse/core';
import { computed, ref, watch } from 'vue';

const props = defineProps<{
  player: Entity;
  controllable?: boolean;
  gameService: GameService;
}>();

// const player = toRef(props, 'player');

const position = computed(() => {
  const pos = props.player.getComponent<PositionComponent>('pos')
  // i dont know why this is necessary but it seems that for the player the x and y are swapped
  return document.getElementById(pos.x!.toString() + ' ' + pos.y!.toString())?.getBoundingClientRect();
});

// init vue use magic key listeners when controllable is true
// emit an event to a game service event bus when a key is pressed
// the game service will then update the player position
const updateInterval = ref(30);

const mover = (dir: string) => {
  props.gameService.emit(props.player.id, 'move', dir);
}

const moveLeft = useIntervalFn(() => mover('left'), updateInterval, { immediate: false });
const moveDown = useIntervalFn(() => mover('down'), updateInterval, { immediate: false });
const moveRight = useIntervalFn(() => mover('right'), updateInterval, { immediate: false });
const moveUp = useIntervalFn(() => mover('up'), updateInterval, { immediate: false });

if (props.controllable) {
  const { arrowleft, arrowdown, arrowright, arrowup } = useMagicKeys();

  watch(arrowleft, (value) => {
    if (value) {
      moveLeft.resume();
    } else {
      moveLeft.pause();
    }
  });
  watch(arrowdown, (value) => {
    if (value) {
      moveDown.resume();
    } else {
      moveDown.pause();
    }
  });
  watch(arrowright, (value) => {
    if (value) {
      moveRight.resume();
    } else {
      moveRight.pause();
    }
  });
  watch(arrowup, (value) => {
    if (value) {
      moveUp.resume();
    } else {
      moveUp.pause();
    }
  });
}

</script>

<template>
  <div class="absolute h-6 w-6" :style="{
    top: `${position?.y ?? '0'}px`,
    left: `${position?.x ?? '0'}px`
  }"><v-icon name="fa-cat" scale="1"></v-icon>

  </div>
</template>

<style></style>
