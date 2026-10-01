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
   stage whatever script calls it (the backdrop vocabulary — next/previous/
   random backdrop — differs from the costume one). Both return the stage's
   backdrop name after the switch: the value when-backdrop-switches-to hats
   match against, 0 when there is no stage or no backdrop. */
catnip_hstring *catnip_looks_backdrop_set(catnip_runtime *runtime, catnip_hstring *backdrop);
catnip_hstring *catnip_looks_next_backdrop(catnip_runtime *runtime);

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

/* clone creation only: puts `clone` immediately behind `source` — the layer
   splice RenderedTarget.goBehindOther performs, renumbering ranks and
   bumping the clone's layer_gen. */
void catnip_looks_go_behind(catnip_target *clone, catnip_target *source);

/* Say/think bubbles. bubble_type is one of these; an empty message clears
   the bubble the way Scratch3LooksBlocks._updateBubble does with ''. */
#define CATNIP_BUBBLE_NONE 0
#define CATNIP_BUBBLE_SAY 1
#define CATNIP_BUBBLE_THINK 2

/* say / think: replaces the target's bubble text (truncated to Scratch's
   330-character limit) and bumps bubble_gen. */
void catnip_looks_say(catnip_hstring *text, catnip_ui32_t type, catnip_target *target);

/* The transient usage id behind sayforsecs/thinkforsecs: clears the bubble
   only when no other say/think happened meanwhile (Scratch compares
   usageId). */
void catnip_looks_clear_if_unchanged(catnip_ui32_t usage, catnip_target *target);

/* Formats a number the way Scratch3LooksBlocks._formatBubbleText does —
   non-integers with |x| >= 0.01 show exactly two decimals, everything else
   the shortest round-trip form. Strings skip this (they arrive already as
   hstrings). */
catnip_hstring *catnip_looks_bubble_format(catnip_f64_t value, catnip_runtime *runtime);

#endif
