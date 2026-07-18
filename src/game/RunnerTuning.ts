export const RUN_SPEED = {
  base: 10.8,
  max: 18.5,
  acceleration: 0.075,
} as const;

export const TRAIN_SPEED_MULTIPLIER = 1.86;
export const TRAIN_RELATIVE_SPEED = TRAIN_SPEED_MULTIPLIER - 1;
