#ifndef CATNIPR_CANVAS_H_INCLUDED
#define CATNIPR_CANVAS_H_INCLUDED

#include "catnip.h"

struct catnip_costume {
    catnip_hstring *name;

    /* The costume's bounding box relative to its rotation center, in stage
       units (pixels / bitmap resolution), y up — the box scratch-render's
       skin reports before any transform. Callers scale it by size / 100 and
       rotate it for the direction to get stage-space bounds. Zero until the
       host measures the asset (CatnipProject.loadCostumeBounds). */
    catnip_f32_t aabb_left;
    catnip_f32_t aabb_right;
    catnip_f32_t aabb_top;
    catnip_f32_t aabb_bottom;

    /* The costume's natural size in stage units (pixels / bitmap resolution),
       before any transform — what scratch-render's getCurrentSkinSize returns.
       The size block clamps against this (see catnip_target_set_size); zero
       until the host measures the asset. */
    catnip_f32_t natural_width;
    catnip_f32_t natural_height;
};

#endif
