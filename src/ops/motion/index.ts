import { registerSB3InputBlock } from "../../sb3_ops";
import { op_const } from "../core/const";
import { op_change_x } from "./change_x";
import { op_change_y } from "./change_y";
import { op_get_direction } from "./get_direction";
import { op_get_x } from "./get_x";
import { op_get_y } from "./get_y";
import { op_goto } from "./goto";
import { op_goto_xy } from "./goto_xy";
import { op_glide_secs_to_xy } from "./glide_secs_to_xy";
import { op_glide_to } from "./glide_to";
import { op_if_on_edge_bounce } from "./if_on_edge_bounce";
import { op_movesteps } from "./movesteps";
import { op_point_direction } from "./point_direction";
import { op_point_towards } from "./point_towards";
import { op_set_rotation_style } from "./set_rotation_style";
import { op_set_x } from "./set_x";
import { op_set_y } from "./set_y";
import { op_turn_left } from "./turn_left";
import { op_turn_right } from "./turn_right";

// The dropdowns of "go to" / "glide to" / "point towards" arrive as shadow
// blocks whose field carries the selection (a sprite name, _mouse_, or
// _random_); the value flows into the block as a constant string.
registerSB3InputBlock("motion_goto_menu", (ctx, block) => op_const.create({
    value: block.fields.TO[0]
}));

registerSB3InputBlock("motion_pointtowards_menu", (ctx, block) => op_const.create({
    value: block.fields.TOWARDS[0]
}));

export default {
    motion_goto_xy: op_goto_xy,
    motion_goto: op_goto,
    motion_set_x: op_set_x,
    motion_set_y: op_set_y,
    motion_get_x: op_get_x,
    motion_get_y: op_get_y,
    motion_get_direction: op_get_direction,
    motion_change_x: op_change_x,
    motion_change_y: op_change_y,
    motion_movesteps: op_movesteps,
    motion_turn_right: op_turn_right,
    motion_turn_left: op_turn_left,
    motion_point_direction: op_point_direction,
    motion_point_towards: op_point_towards,
    motion_glide_to: op_glide_to,
    motion_glide_secs_to_xy: op_glide_secs_to_xy,
    motion_if_on_edge_bounce: op_if_on_edge_bounce,
    motion_set_rotation_style: op_set_rotation_style,
}
