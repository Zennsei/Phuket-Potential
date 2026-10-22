import type { TambonProps } from "./types";

/** years of DOPA civil-registry data per sub-district (December of each year) */
export const REG_YEARS = [2552, 2559, 2563, 2565, 2568] as const;
export type RegYear = (typeof REG_YEARS)[number];

export const regPop = (p: TambonProps, y: number) => p[`reg_pop_${y}`];
export const regHouse = (p: TambonProps, y: number) => p[`reg_house_${y}`];
