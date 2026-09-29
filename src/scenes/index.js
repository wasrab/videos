import { SCENES } from '../timeline.js';
import { placeholder } from './placeholder.js';
import * as S01 from './s01.js';
import * as S02 from './s02.js';
import * as S03 from './s03.js';

const BUILT = { S01, S02, S03 };
export const SCENE_MODULES = Object.fromEntries(SCENES.map(s => [s.id, BUILT[s.id] || placeholder(s)]));
export const isBuilt = id => id in BUILT;
