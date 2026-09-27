#ifndef CATNIP_MOTION_H_INCLUDED
#define CATNIP_MOTION_H_INCLUDED

#include "./catnip.h"

/* Motion blocks, transcribed from scratch-vm's scratch3_motion.js. Each one
   behaves exactly like its Scratch counterpart — including the quirks (the
   fence clamping, direction wrapping, and bounce's two-step fence). */

/* move (steps): advances along the current direction through setXY. */
void catnip_motion_movesteps(catnip_target *target, catnip_f64_t steps);
/* turn right/left (degrees): setDirection(dir +/- degrees). */
void catnip_motion_turnright(catnip_target *target, catnip_f64_t degrees);
void catnip_motion_turnleft(catnip_target *target, catnip_f64_t degrees);
/* point in direction (degrees) */
void catnip_motion_point_direction(catnip_target *target, catnip_f64_t direction);
/* point towards (sprite|_mouse_|_random_): resolves the menu at runtime. */
void catnip_motion_point_towards(catnip_target *target, catnip_hstring *towards);
/* go to (sprite|_mouse_|_random_): resolves the menu at runtime. */
void catnip_motion_goto(catnip_target *target, catnip_hstring *to);
/* if on edge, bounce: edge test + direction change + scratch-vm's keepInFence
   (which runs before the usual 15px setXY fence — both are applied, exactly
   as scratch does). */
void catnip_motion_bounce(catnip_target *target);
/* set rotation style ("all around" | "left-right" | "don't rotate"); an
   unknown style leaves the current one alone, like setRotationStyle. */
void catnip_motion_set_rotation_style(catnip_target *target, catnip_hstring *style);

/* glide: the begin records the start/end/time (menu versions resolve the
   target name once, at the start); each tick one glide_step runs. The step
   returns the milliseconds still to go — 0 means the glide is over and the
   end position has been snapped to. A duration <= 0 or an unresolvable menu
   ends the glide on the first step without ever moving, so the block
   completes immediately like scratch's. */
void catnip_motion_glide_begin_xy(catnip_target *target, catnip_f64_t x, catnip_f64_t y, catnip_f64_t secs);
void catnip_motion_glide_begin_to(catnip_target *target, catnip_hstring *to, catnip_f64_t secs);
catnip_f64_t catnip_motion_glide_step(catnip_target *target);

#endif
