#ifndef CATNIP_LOOKS_H_INCLUDED
#define CATNIP_LOOKS_H_INCLUDED

#include "./catnip.h"

/* Looks blocks, transcribed from scratch-vm's scratch3_looks.js and
   sprites/rendered-target.js. Sprites-only behaviour (size, visibility) is a
   no-op on the stage exactly like RenderedTarget's guards. */

/* The project's stage target, or 0 if the project has none. */
catnip_target *catnip_looks_stage(catnip_runtime *runtime);

/* show / hide: sets the IS_VISIBLE flag; the stage ignores both. */
void catnip_looks_set_visible(catnip_target *target, catnip_bool_t visible);

/* set size to / change size by: clamped like RenderedTarget.setSize — the
   scale is limited by the costume's natural size (5px minimum on the short
   axis, 1.5 stage widths/heights maximum); the stage ignores both. */
void catnip_looks_set_size(catnip_target *target, catnip_f64_t size);
void catnip_looks_change_size(catnip_target *target, catnip_f64_t delta);

/* size: the size field rounded like scratch's Math.round. */
catnip_f64_t catnip_looks_get_size(catnip_target *target);

/* Effect indices, matching the field order of struct catnip_target and the
   key order of RenderedTarget's effects object. */
#define CATNIP_EFFECT_COLOR 0
#define CATNIP_EFFECT_FISHEYE 1
#define CATNIP_EFFECT_WHIRL 2
#define CATNIP_EFFECT_PIXELATE 3
#define CATNIP_EFFECT_MOSAIC 4
#define CATNIP_EFFECT_BRIGHTNESS 5
#define CATNIP_EFFECT_GHOST 6

/* set effect to / change effect by: ghost clamps to [0,100] and brightness to
   [-100,100] like Scratch3LooksBlocks.clampEffect, other effects are free. */
void catnip_looks_set_effect(catnip_target *target, catnip_i32_t effect, catnip_f64_t value);
void catnip_looks_change_effect(catnip_target *target, catnip_i32_t effect, catnip_f64_t delta);

/* clear graphic effects: every effect back to 0. */
void catnip_looks_clear_effects(catnip_target *target);

/* next costume: currentCostume + 1, wrapped. */
void catnip_looks_next_costume(catnip_target *target);

/* switch backdrop to / next backdrop: the same costume switch, applied to the
   stage whatever script calls it. switch backdrop ... and wait runs the switch
   immediately; the wait-for-backdrop-hats part needs event_whenbackdropswitches
   first (not implemented yet). */
void catnip_looks_backdrop_set(catnip_runtime *runtime, catnip_hstring *backdrop);
void catnip_looks_next_backdrop(catnip_runtime *runtime);

/* backdrop (number|name): reads the stage's current costume. */
catnip_f64_t catnip_looks_backdrop_number(catnip_runtime *runtime);
catnip_hstring *catnip_looks_backdrop_name(catnip_runtime *runtime);

/* Layer ops: reordering happens among sprites only (RenderedTarget's
   goToFront/goToBack/goForwardLayers/goBackwardLayers are documented
   sprites-only; the stage ignores them). layer_rank is a 1-based position
   within the sprite layer, higher = closer to the viewer; every op renumbers
   the whole sprite ordering and bumps target->layer_gen so frame() notices.
   change_layer takes the layer count as scratch passes it (a double: NaN
   falls back to 0, out-of-range clamps like the renderer's splice). */
void catnip_looks_goto_front(catnip_target *target);
void catnip_looks_goto_back(catnip_target *target);
void catnip_looks_change_layer(catnip_target *target, catnip_f64_t n);

#endif
