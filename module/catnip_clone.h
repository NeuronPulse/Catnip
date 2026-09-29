#ifndef CATNIP_CLONE_H_INCLUDED
#define CATNIP_CLONE_H_INCLUDED

#include "./catnip.h"

/* Clones, transcribed from scratch-vm's scratch3_control.js (createClone,
   deleteClone) and sprites/rendered-target.js (makeClone / dispose). */

/* Resolves the CLONE_OPTION menu to the target to clone from: "_myself_" is
   the target the running script belongs to, anything else is looked up by
   sprite name the way runtime.getSpriteTargetByName does (first target with
   that name wins). Returns 0 when the name matches nothing. */
catnip_target *catnip_clone_resolve_source(catnip_hstring *option, catnip_runtime *runtime, catnip_target *current);

/* Creates a clone of `source` and links it into the runtime and sprite
   chains: scratch-vm's makeClone copies position/direction/size/costume/
   rotation style/effects plus the variable values and list entries (lists get
   their own buffer, exactly like duplicateVariable's value.slice(0)). Returns
   0 when the source is the stage or the 300-clone limit
   (runtime.clonesAvailable) is reached. The caller runs the start-as-clone
   hats and then catnip_looks_go_behind, in scratch's order. */
catnip_target *catnip_clone_create(catnip_target *source);

/* Deletes a clone: scratch-vm's deleteClone (a no-op on the original),
   which disposes the target — every thread on it stops, the target is
   unlinked from both chains and its allocations are freed. The calling
   thread is left alone: the IR terminates it after this returns when the
   result is 1, mirroring how scratch's stopForTarget lets the current step
   finish. Returns 1 when the target was a clone and is now gone. */
catnip_i32_t catnip_clone_delete(catnip_target *target);

/* Disposes every clone — runtime.stopAll's "dispose all clones" pass, run
   before green flag and "stop all". */
void catnip_clone_dispose_all(catnip_runtime *runtime);

#endif
