import { registerSB3InputBlock } from "../../sb3_ops";
import { op_const } from "../core/const";
import { op_ask, op_answer } from "./ask";
import { op_current } from "./current";
import { op_days_since_2000 } from "./days_since_2000";
import { op_distanceto } from "./distanceto";
import { op_get_mouse_x } from "./get_mouse_x";
import { op_get_mouse_y } from "./get_mouse_y";
import { op_is_key_down } from "./is_key_down";
import { op_is_mouse_down } from "./is_mouse_down";
import { op_timer_get } from "./timer_get";
import { op_timer_reset } from "./timer_reset";
import { op_username } from "./username";
import "./loudness";

registerSB3InputBlock("sensing_keyoptions", (ctx, block) =>
    op_const.create({
        value: block.fields.KEY_OPTION[0]
    })
);

registerSB3InputBlock("sensing_distancetomenu", (ctx, block) =>
    op_const.create({
        value: block.fields.DISTANCETOMENU[0]
    })
);

registerSB3InputBlock("sensing_of_object_menu", (ctx, block) =>
    op_const.create({
        value: block.fields.OBJECT[0]
    })
);

export default {
    sensing_days_since_2000: op_days_since_2000,
    sensing_is_key_pressed: op_is_key_down,
    sensing_get_mouse_x: op_get_mouse_x,
    sensing_get_mouse_y: op_get_mouse_y,
    sensing_is_mouse_down: op_is_mouse_down,
    sensing_timer_get: op_timer_get,
    sensing_timer_reset: op_timer_reset,
    sensing_current: op_current,
    sensing_username: op_username,
    sensing_ask: op_ask,
    sensing_answer: op_answer,
    sensing_distanceto: op_distanceto,
};
