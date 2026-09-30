
#ifndef CATNIP_SENSING_H_INCLUDED
#define CATNIP_SENSING_H_INCLUDED

#include "./catnip.h"
#include "./catnip_target.h"

/* "ask and wait": the queue Scratch keeps for simultaneous questions. One
   question is on screen (and in the asker's say bubble) at a time; the rest
   wait their turn. Tickets identify an asker's place in the queue and stay
   valid across answers. */

catnip_ui32_t catnip_sensing_ask(catnip_hstring *question, catnip_target *target);
catnip_bool_t catnip_sensing_ask_done(catnip_ui32_t ticket);

void catnip_sensing_answer_set(catnip_hstring *answer);
catnip_hstring *catnip_sensing_answer_get(void);

/* Green flag: forget the queue, the answers and any prompt on screen. */
void catnip_sensing_ask_reset(void);

/* sensing distanceto: distance from `self` to the mouse or another sprite
   (stage, missing sprite and stage-asking all give scratch's 10000). */
catnip_f64_t catnip_sensing_distance_to(const catnip_hstring *option, catnip_target *self);

/* sensing of: (property) of (object) — scratch getAttributeOf, returning a
   NaN-boxed string or a plain number. */
catnip_f64_t catnip_sensing_of(const catnip_hstring *object, const catnip_hstring *property, catnip_target *self);

/* sensing set drag mode: 1.0 = draggable, 0.0 = not draggable. */
void catnip_sensing_set_drag_mode(catnip_f64_t mode, catnip_target *self);

#endif
