/** Role -> crew variants and default pose. */
export const ROLES = {
  breacher: { variants: ['miner'], pose: 'crouch' },
  hauler: { variants: ['dockworker', 'carpenter', 'grease_mechanic', 'railroad'], pose: 'air' },
  rigger: { variants: ['sailor'], pose: 'idle' },
  decoy: { variants: ['reporter'], pose: 'idle' },
  inspector: { variants: ['inspector'], pose: 'idle' },
  plain: { variants: ['runner'], pose: 'idle' }
};

/** Poses packed into the atlas. */
export const POSES = ['idle', 'crouch', 'air', 'launch', 'impact'];
