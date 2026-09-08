import { NeonRiderGame } from '../v10/game.js';
import { commerceState } from './backend.js';
import { installPremiumRuntime } from './premium-loadout.js';

if (!NeonRiderGame.prototype.__waeV12RuntimeHook) {
  NeonRiderGame.prototype.__waeV12RuntimeHook = true;
  const baseInit = NeonRiderGame.prototype.init;

  NeonRiderGame.prototype.init = function waeV12Init(...args) {
    window.__waeNeonRiderGame = this;
    installPremiumRuntime(this, commerceState);
    return baseInit.apply(this, args);
  };
}
